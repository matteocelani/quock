import Foundation
import MLX

// Ollama's MLX builds keep the token embedding in BF16, and Qwen-style models tie it to the LM head, so that one
// matrix is read in full for the logits of every generated token: half of a 0.8B model's bytes per token. Quantizing
// it once at install cuts that traffic without touching the quantized body.
enum HeadQuantizer {
  struct Outcome: Sendable {
    let file: String
    let modulePath: String
    let bytesBefore: Int
    let bytesAfter: Int
  }

  static let embeddingSuffix = "embed_tokens.weight"
  // Returns nil when the build has no full-precision embedding to quantize (already quantized, or none found).
  static func quantizeEmbedding(in directory: URL, bits: Int, groupSize: Int) throws -> Outcome? {
    for file in try safetensorFiles(in: directory) {
      let keys = try tensorKeys(of: file)
      guard let key = keys.first(where: { $0.hasSuffix(embeddingSuffix) }) else { continue }
      let base = String(key.dropLast(".weight".count))
      if keys.contains(base + ".scales") { return nil }

      // CPU stream: this runs right after a download, possibly in the background, where iOS forbids GPU work.
      let arrays = try loadArrays(url: file, stream: .cpu)
      guard let weight = arrays[key], [DType.bfloat16, .float16, .float32].contains(weight.dtype) else { return nil }
      let (packed, scales, biases) = quantized(
        weight, groupSize: groupSize, bits: bits, mode: .affine, stream: .cpu)
      // Whatever else shares the file is carried over unchanged.
      var output = arrays
      output[key] = packed
      output[base + ".scales"] = scales
      output[base + ".biases"] = biases
      eval(Array(output.values))

      let temporary = file.deletingLastPathComponent().appending(path: ".requantized-\(file.lastPathComponent)")
      try save(arrays: output, url: temporary, stream: .cpu)
      let before = weight.nbytes
      let after = packed.nbytes + scales.nbytes + (biases?.nbytes ?? 0)
      _ = try FileManager.default.replaceItemAt(file, withItemAt: temporary)

      let modulePath = Self.modulePath(forCheckpointKey: base)
      try addLayerQuantization(
        in: directory, modulePath: modulePath, bits: bits, groupSize: groupSize)
      return Outcome(file: file.lastPathComponent, modulePath: modulePath, bytesBefore: before, bytesAfter: after)
    }
    return nil
  }

  // Checkpoint keys name the language model either `model.language_model.*` (Hugging Face layout) or
  // `language_model.model.*` (already mapped); the per-layer quantization entry needs the model's module path.
  static func modulePath(forCheckpointKey base: String) -> String {
    if base.hasPrefix("model.language_model.") {
      return "language_model.model." + base.dropFirst("model.language_model.".count)
    }
    return base
  }

  private static func addLayerQuantization(in directory: URL, modulePath: String, bits: Int, groupSize: Int) throws {
    let url = directory.appending(path: "config.json")
    guard var config = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any] else {
      throw OllamaRegistryError.malformedTensor("config.json")
    }
    var quantization = config["quantization"] as? [String: Any] ?? [:]
    quantization[modulePath] = ["group_size": groupSize, "bits": bits, "mode": "affine"]
    config["quantization"] = quantization
    try JSONSerialization.data(withJSONObject: config, options: [.prettyPrinted, .sortedKeys])
      .write(to: url, options: .atomic)
  }

  private static func safetensorFiles(in directory: URL) throws -> [URL] {
    try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
      .filter { $0.pathExtension == "safetensors" && !$0.lastPathComponent.hasPrefix(".") }
  }

  private static func tensorKeys(of file: URL) throws -> [String] {
    let handle = try FileHandle(forReadingFrom: file)
    defer { try? handle.close() }
    guard let lengthData = try handle.read(upToCount: 8), lengthData.count == 8 else { return [] }
    let length = lengthData.withUnsafeBytes { $0.loadUnaligned(as: UInt64.self) }.littleEndian
    guard length < 64 << 20, let data = try handle.read(upToCount: Int(length)),
      let header = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return [] }
    return header.keys.filter { $0 != "__metadata__" }
  }
}
