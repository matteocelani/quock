import Foundation

struct InstalledModel: Codable, Sendable {
  let reference: String
  let bytes: Int64
  let installedAt: Date
  let capabilities: [String]?
}

enum LocalModelStore {
  private static let markerName = "quock-installed.json"
  private static let concurrentDownloads = 4

  static var root: URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return base.appending(path: "OnDeviceLLM/models", directoryHint: .isDirectory)
  }

  static func directory(for ref: ModelReference) -> URL {
    root.appending(path: "\(ref.namespace)/\(ref.name)/\(ref.tag)", directoryHint: .isDirectory)
  }

  static func installed(_ ref: ModelReference) -> InstalledModel? {
    let marker = directory(for: ref).appending(path: markerName)
    guard let data = try? Data(contentsOf: marker) else { return nil }
    return try? JSONDecoder().decode(InstalledModel.self, from: data)
  }

  static func list() -> [InstalledModel] {
    guard let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil) else {
      return []
    }
    return enumerator.compactMap { item in
      guard let url = item as? URL, url.lastPathComponent == markerName,
        let data = try? Data(contentsOf: url)
      else { return nil }
      return try? JSONDecoder().decode(InstalledModel.self, from: data)
    }
  }

  static func remove(_ ref: ModelReference) throws {
    let directory = directory(for: ref)
    if FileManager.default.fileExists(atPath: directory.path) {
      try FileManager.default.removeItem(at: directory)
    }
  }

  // Pulls an MLX build from the Ollama registry into a directory mlx-swift-lm can load as is. Files already on disk
  // from an interrupted pull are kept, so a retry resumes at file granularity.
  static func pull(
    _ ref: ModelReference,
    progress: @escaping @Sendable (_ completed: Int64, _ total: Int64) -> Void
  ) async throws -> InstalledModel {
    if let installed = installed(ref) { return installed }
    let manifest = try await OllamaRegistry.manifest(for: ref)
    let layers = OllamaRegistry.neededLayers(of: manifest)
    let capabilities = await capabilities(of: manifest, ref: ref)
    let directory = directory(for: ref)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    var excluded = root
    try? excluded.setResourceValues(values)

    let total = layers.reduce(Int64(0)) { $0 + $1.size }
    let counter = ByteCounter()
    progress(0, total)

    var jobs: [(OllamaLayer, URL)] = []
    var tensorIndex = 0
    for layer in layers {
      let filename: String
      if layer.mediaType.hasSuffix(".tensor") {
        tensorIndex += 1
        filename = String(format: "model-%05d.safetensors", tensorIndex)
      } else {
        filename = layer.name ?? layer.digest
      }
      let destination = directory.appending(path: filename)
      let done = directory.appending(path: ".\(filename).\(layer.digest.suffix(12))")
      if FileManager.default.fileExists(atPath: done.path) {
        progress(await counter.add(layer.size), total)
      } else {
        jobs.append((layer, destination))
      }
    }

    try await withThrowingTaskGroup(of: Int64.self) { group in
      var iterator = jobs.makeIterator()
      func enqueue() {
        guard let (layer, destination) = iterator.next() else { return }
        group.addTask {
          try Task.checkCancellation()
          try await OllamaRegistry.download(layer, of: ref, to: destination)
          let done = destination.deletingLastPathComponent()
            .appending(path: ".\(destination.lastPathComponent).\(layer.digest.suffix(12))")
          FileManager.default.createFile(atPath: done.path, contents: nil)
          return layer.size
        }
      }
      for _ in 0 ..< concurrentDownloads { enqueue() }
      while let size = try await group.next() {
        progress(await counter.add(size), total)
        enqueue()
      }
    }

    try patchConfiguration(in: directory)
    let model = InstalledModel(
      reference: ref.display, bytes: total, installedAt: Date(), capabilities: capabilities)
    try JSONEncoder().encode(model).write(to: directory.appending(path: markerName), options: .atomic)
    return model
  }

  private struct ConfigBlob: Decodable { let capabilities: [String]? }

  // Ollama's own config blob says what the build can do; only what this engine runs is kept (no vision tower).
  private static func capabilities(of manifest: OllamaManifest, ref: ModelReference) async -> [String] {
    var result = ["completion"]
    if let digest = manifest.configDigest,
      let data = try? await OllamaRegistry.blob(digest, of: ref),
      let blob = try? JSONDecoder().decode(ConfigBlob.self, from: data),
      blob.capabilities?.contains("thinking") == true
    {
      result.append("thinking")
    }
    return result
  }

  private static func patchConfiguration(in directory: URL) throws {
    let url = directory.appending(path: "config.json")
    let data = try Data(contentsOf: url)
    guard var config = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw OllamaRegistryError.malformedTensor("config.json")
    }
    if config["quantization"] == nil, let quantization = try OllamaRegistry.quantization(ofTensorsIn: directory) {
      config["quantization"] = quantization
      try JSONSerialization.data(withJSONObject: config, options: [.prettyPrinted, .sortedKeys])
        .write(to: url, options: .atomic)
    }
  }
}

private actor ByteCounter {
  private var value: Int64 = 0

  func add(_ bytes: Int64) -> Int64 {
    value += bytes
    return value
  }
}
