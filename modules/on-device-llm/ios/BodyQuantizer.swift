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

  static func quantize(directory: URL, plan: Plan) throws -> Outcome {
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
    for file in files {
      try autoreleasepool {
        let arrays = try loadArrays(url: file, stream: .cpu)
        guard let weightKey = arrays.keys.first(where: { $0.hasSuffix(".weight") }),
          let weight = arrays[weightKey], weight.ndim == 2,
          !skippedFragments.contains(where: weightKey.contains)
        else { return }
        let base = String(weightKey.dropLast(".weight".count))
        let module = HeadQuantizer.modulePath(forCheckpointKey: base)
        let bits = plan.bits(forModule: module)
        let dense: MLXArray
        if let scales = arrays[base + ".scales"] {
          // Already quantized by Ollama: undo it with the format it was written in, then quantize again.
          guard let source = existing[module] as? [String: Any] ?? existingDefault(existing) else { return }
          let mode = QuantizationMode(rawValue: source["mode"] as? String ?? "affine") ?? .affine
          dense = dequantized(
            weight, scales: scales, biases: arrays[base + ".biases"],
            groupSize: source["group_size"] as? Int, bits: source["bits"] as? Int, mode: mode, stream: .cpu
          ).asType(.bfloat16)
        } else {
          dense = weight
        }
        guard dense.dim(-1) % plan.groupSize == 0 else { return }
        let (packed, scales, biases) = quantized(
          dense, groupSize: plan.groupSize, bits: bits, mode: .affine, stream: .cpu)
        var output = [weightKey: packed, base + ".scales": scales]
        if let biases { output[base + ".biases"] = biases }
        eval(Array(output.values))
        let temporary = file.deletingLastPathComponent().appending(path: ".body-\(file.lastPathComponent)")
        try save(arrays: output, url: temporary, stream: .cpu)
        _ = try FileManager.default.replaceItemAt(file, withItemAt: temporary)
        before += arrays.values.reduce(0) { $0 + $1.nbytes }
        after += output.values.reduce(0) { $0 + $1.nbytes }
        tensors += 1
        perLayer[module] = ["group_size": plan.groupSize, "bits": bits, "mode": "affine"]
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
