import Foundation
import MLX

// Re-quantizes every linear layer of a downloaded model to a chosen affine width, with per-layer exceptions picked by
// sensitivity. Works from full-precision weights or, when the build is already quantized, from its dequantized form.
enum BodyQuantizer {
  struct Plan: Sendable {
    let bits: Int
    let groupSize: Int
    // Module-path fragments kept at `sensitiveBits` (e.g. "mlp.down_proj", "layers.0.").
    let sensitive: [String]
    let sensitiveBits: Int

    func bits(forModule path: String) -> Int {
      sensitive.contains(where: path.contains) ? sensitiveBits : bits
    }
  }

  struct Outcome: Sendable {
    let tensors: Int
    let bytesBefore: Int
    let bytesAfter: Int
  }

  private static let skippedFragments = ["norm", "embed_tokens", "conv1d", "A_log", "dt_bias", "visual", "vision"]

  // Whether a checkpoint tensor name is a linear layer's weight this quantizer would convert.
  static func isLinearWeight(_ name: String) -> Bool {
    name.hasSuffix(".weight") && !skippedFragments.contains(where: name.contains)
  }

  // `skipping` names files an earlier, interrupted run already rewrote; `onFileDone` is told after each file is
  // replaced, which is where a caller records progress (and where a test simulates a kill by throwing).
  static func quantize(
    directory: URL, plan: Plan, skipping: Set<String> = [], onFileDone: (String) throws -> Void = { _ in }
  ) throws -> Outcome {
    let configURL = directory.appending(path: "config.json")
    guard var config = try JSONSerialization.jsonObject(with: Data(contentsOf: configURL)) as? [String: Any] else {
      throw OllamaRegistryError.malformedTensor("config.json")
    }
    let existing = config["quantization"] as? [String: Any] ?? [:]
    var perLayer: [String: Any] = [:]
    var tensors = 0
    var before = 0
    var after = 0
    let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
      .filter { $0.pathExtension == "safetensors" && !$0.lastPathComponent.hasPrefix(".") }
    for file in files where !skipping.contains(file.lastPathComponent) {
      try autoreleasepool {
        let arrays = try loadArrays(url: file, stream: .cpu)
        // A file may hold one tensor (Ollama's layout) or several: every linear weight is converted and everything
        // else is carried over unchanged, so nothing sharing a file with a weight is ever dropped.
        var output = arrays
        var converted = 0
        for weightKey in arrays.keys.sorted() where weightKey.hasSuffix(".weight") {
          guard let weight = arrays[weightKey], weight.ndim == 2,
            !skippedFragments.contains(where: weightKey.contains)
          else { continue }
          let base = String(weightKey.dropLast(".weight".count))
          let module = HeadQuantizer.modulePath(forCheckpointKey: base)
          let bits = plan.bits(forModule: module)
          let dense: MLXArray
          if let scales = arrays[base + ".scales"] {
            // Already quantized by Ollama: undo it with the format it was written in, then quantize again.
            guard let source = existing[module] as? [String: Any] ?? existingDefault(existing) else { continue }
            let mode = QuantizationMode(rawValue: source["mode"] as? String ?? "affine") ?? .affine
            dense = dequantized(
              weight, scales: scales, biases: arrays[base + ".biases"],
              groupSize: source["group_size"] as? Int, bits: source["bits"] as? Int, mode: mode, stream: .cpu
            ).asType(.bfloat16)
          } else {
            dense = weight
          }
          guard dense.dim(-1) % plan.groupSize == 0 else { continue }
          let (packed, scales, biases) = quantized(
            dense, groupSize: plan.groupSize, bits: bits, mode: .affine, stream: .cpu)
          output[weightKey] = packed
          output[base + ".scales"] = scales
          output[base + ".biases"] = biases
          eval([packed, scales] + (biases.map { [$0] } ?? []))
          converted += 1
          perLayer[module] = ["group_size": plan.groupSize, "bits": bits, "mode": "affine"]
        }
        guard converted > 0 else { return }
        eval(Array(output.values))
        let temporary = file.deletingLastPathComponent().appending(path: ".body-\(file.lastPathComponent)")
        try save(arrays: output, url: temporary, stream: .cpu)
        _ = try FileManager.default.replaceItemAt(file, withItemAt: temporary)
        before += arrays.values.reduce(0) { $0 + $1.nbytes }
        after += output.values.reduce(0) { $0 + $1.nbytes }
        tensors += converted
        try onFileDone(file.lastPathComponent)
      }
    }
    // The body is now uniformly affine; per-layer entries carry the exceptions, and the head keeps its own entry.
    var quantization: [String: Any] = ["group_size": plan.groupSize, "bits": plan.bits, "mode": "affine"]
    for (module, entry) in existing where module.contains("embed_tokens") { quantization[module] = entry }
    for (module, entry) in perLayer where (entry as? [String: Any])?["bits"] as? Int != plan.bits {
      quantization[module] = entry
    }
    config["quantization"] = quantization
    try JSONSerialization.data(withJSONObject: config, options: [.prettyPrinted, .sortedKeys])
      .write(to: configURL, options: .atomic)
    return Outcome(tensors: tensors, bytesBefore: before, bytesAfter: after)
  }

  private static func existingDefault(_ existing: [String: Any]) -> [String: Any]? {
    guard existing["bits"] != nil else { return nil }
    return existing.filter { !($0.value is [String: Any]) }
  }
}
