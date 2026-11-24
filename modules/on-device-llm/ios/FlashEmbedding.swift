import Foundation
import MLX
import MLXLLM
import MLXLMCommon
import MLXNN

// Gemma 4's per-layer embedding table (embed_tokens_per_layer) is 4.5 GB of BF16 on e2b, larger than everything else
// combined, yet each token reads one 17.5 KB row of it. Left on flash and read per token (the ds4 "Engram" pattern),
// the model's resident memory drops by the whole table: e2b goes from ~6.4 GB to about 2 GB, which an 8 GB iPhone
// can hold. The bytes are the ones the build shipped, so outputs are unchanged.
final class FlashEmbedding: Embedding {
  private let descriptor: Int32
  private let offset: Int
  private let rows: Int
  private let dims: Int
  private let rowBytes: Int

  init(file: URL, offset: Int, rows: Int, dims: Int) throws {
    let descriptor = open(file.path(percentEncoded: false), O_RDONLY)
    guard descriptor >= 0 else { throw FlashEmbeddingError.unreadable(file.lastPathComponent) }
    // Rows are read once per token and never again soon; caching them would only push weights out of memory.
    _ = fcntl(descriptor, F_NOCACHE, 1)
    self.descriptor = descriptor
    self.offset = offset
    self.rows = rows
    self.dims = dims
    self.rowBytes = dims * 2
    // The real table stays on disk; this placeholder is what the checkpoint carries in its place.
    super.init(weight: MLXArray.zeros([1, dims], dtype: .bfloat16))
    freeze()
  }

  deinit {
    close(descriptor)
  }

  override func callAsFunction(_ x: MLXArray) -> MLXArray {
    let ids = x.asType(.int32).asArray(Int32.self)
    var data = Data(count: ids.count * rowBytes)
    let isComplete = data.withUnsafeMutableBytes { buffer -> Bool in
      guard let base = buffer.baseAddress else { return false }
      for (index, id) in ids.enumerated() {
        let row = min(max(Int(id), 0), rows - 1)
        var done = 0
        while done < rowBytes {
          let read = pread(
            descriptor, base + index * rowBytes + done, rowBytes - done, off_t(offset + row * rowBytes + done))
          if read <= 0 { return false }
          done += read
        }
      }
      return true
    }
    // A failed read must never become silent zeros: it ends the reply as an engine error instead.
    if !isComplete { MLXFailure.record("flash embedding read failed") }
    return MLXArray(data, x.shape + [dims], dtype: .bfloat16)
  }
}

enum FlashEmbeddingError: LocalizedError {
  case unreadable(String)

  var errorDescription: String? {
    switch self {
    case .unreadable(let file): "The model file \(file) could not be opened."
    }
  }
}

enum FlashEmbeddings {
  static let configKey = "quock_flash_embedding"
  static let rowsFile = "flash-rows.bin"
  private static let tableSuffix = "embed_tokens_per_layer.weight"

  // The directory of the model being loaded: the model creator only sees config.json, and the app's container path
  // changes across updates, so the config stores a file name and this supplies the folder. LocalEngine sets it
  // before each load, which the actor already serializes.
  nonisolated(unsafe) static var loadingDirectory: URL?

  // At install: keeps the per-layer table's file as is but out of the loader's sight, puts a one-row placeholder in
  // the checkpoint, and records where the rows start. Returns the bytes now left on flash.
  @discardableResult
  static func prepare(in directory: URL) throws -> Int64 {
    let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
      .filter { $0.pathExtension == "safetensors" && !$0.lastPathComponent.hasPrefix(".") }
    for file in files {
      let (header, headerLength) = try readHeader(file)
      guard let key = header.keys.first(where: { $0.hasSuffix(tableSuffix) }),
        let entry = header[key] as? [String: Any], entry["dtype"] as? String == "BF16",
        let shape = entry["shape"] as? [Int], shape.count == 2,
        let offsets = entry["data_offsets"] as? [Int], offsets.count == 2
      else { continue }
      let rowsURL = directory.appending(path: rowsFile)
      try? FileManager.default.removeItem(at: rowsURL)
      try FileManager.default.moveItem(at: file, to: rowsURL)
      try save(arrays: [key: MLXArray.zeros([1, shape[1]], dtype: .bfloat16)], url: file)

      let configURL = directory.appending(path: "config.json")
      guard var config = try JSONSerialization.jsonObject(with: Data(contentsOf: configURL)) as? [String: Any] else {
        throw OllamaRegistryError.malformedTensor("config.json")
      }
      config[configKey] = [
        "file": rowsFile, "offset": 8 + headerLength + offsets[0], "rows": shape[0], "dims": shape[1],
      ]
      try JSONSerialization.data(withJSONObject: config, options: [.prettyPrinted, .sortedKeys])
        .write(to: configURL, options: .atomic)
      return Int64((try? rowsURL.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
    }
    return 0
  }

  private struct Spec: Decodable {
    let file: String
    let offset: Int
    let rows: Int
    let dims: Int
  }

  private struct Envelope: Decodable {
    let quock_flash_embedding: Spec?
  }

  private static var isRegistered = false

  // Replaces the stock gemma4 creator with one that builds the same model and, when the checkpoint was prepared
  // above, swaps the per-layer table for a FlashEmbedding before the weights load.
  static func registerIfNeeded() async {
    guard !isRegistered else { return }
    isRegistered = true
    await LLMTypeRegistry.shared.registerModelType("gemma4") { data in
      let configuration = try JSONDecoder().decode(Gemma4Configuration.self, from: data)
      let model = Gemma4Model(configuration)
      guard let spec = try JSONDecoder().decode(Envelope.self, from: data).quock_flash_embedding,
        let directory = loadingDirectory
      else { return model }
      let modules = model.leafModules().flattened()
      guard let path = modules.first(where: { $0.0.hasSuffix("embed_tokens_per_layer") })?.0 else { return model }
      let flash = try FlashEmbedding(
        file: directory.appending(path: spec.file), offset: spec.offset, rows: spec.rows, dims: spec.dims)
      model.update(modules: ModuleChildren.unflattened([(path, flash)]))
      return model
    }
  }

  private static func readHeader(_ url: URL) throws -> ([String: Any], Int) {
    let handle = try FileHandle(forReadingFrom: url)
    defer { try? handle.close() }
    guard let lengthData = try handle.read(upToCount: 8), lengthData.count == 8 else { return ([:], 0) }
    let length = Int(lengthData.withUnsafeBytes { $0.loadUnaligned(as: UInt64.self) }.littleEndian)
    guard length < 64 << 20, let data = try handle.read(upToCount: length),
      let header = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return ([:], 0) }
    return (header, length)
  }
}
