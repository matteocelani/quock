import Foundation

struct InstalledModel: Codable, Sendable {
  let reference: String
  let bytes: Int64
  let installedAt: Date
  let capabilities: [String]?
  // Which manifest the files came from, and in which format: the registry digest tells a republished tag apart, and
  // the format is what a second engine would route on instead of the tag name.
  let manifestDigest: String?
  let format: String?
  // What has to fit in memory: the files on disk minus tables streamed from flash per token.
  let residentBytes: Int64?
}

enum LocalModelStore {
  private static let markerName = "quock-installed.json"
  // sha256 of every file as written to disk, checked before the weights are first loaded in a session.
  static let fileHashesName = "quock-files.json"
  static let mlxFormat = "mlx"
  private static let concurrentDownloads = 4
  // A phone drops connections all the time (Wi-Fi handoff, sleep, a flaky CDN edge); one lost file must not end a pull.
  private static let downloadAttempts = 4
  private static let retryBaseDelay: UInt64 = 1_000_000_000
  // Room the install needs beyond the download: the optimizer writes each rewritten file next to the original, and
  // the largest (a BF16 embedding table) is under 1 GB.
  static let installScratchBytes: Int64 = 1 << 30

  static var root: URL {
    // The macOS benchmark points this at its own cache so it never touches a real install.
    if let override = ProcessInfo.processInfo.environment["QUOCK_LLM_MODELS_DIR"] {
      return URL(fileURLWithPath: override, isDirectory: true)
    }
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
    var licenseIndex = 0
    for layer in layers {
      let filename: String
      if layer.mediaType.hasSuffix(".tensor") {
        tensorIndex += 1
        filename = String(format: "model-%05d.safetensors", tensorIndex)
      } else if layer.mediaType.hasSuffix(".license") {
        licenseIndex += 1
        filename = "LICENSE-\(licenseIndex).txt"
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

    // Checked before the first byte: a full disk would otherwise end the pull halfway with a generic write error.
    let remaining = jobs.reduce(Int64(0)) { $0 + $1.0.size }
    if let free = availableDiskBytes(at: directory), free < remaining + installScratchBytes {
      throw LocalModelStoreError.insufficientSpace(needed: remaining + installScratchBytes, free: free)
    }

    try await withThrowingTaskGroup(of: Int64.self) { group in
      var iterator = jobs.makeIterator()
      func enqueue() {
        guard let (layer, destination) = iterator.next() else { return }
        group.addTask {
          try await downloadWithRetry(layer, of: ref, to: destination)
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

    // The resume markers end here: the steps below rewrite the downloaded files, so a retry after an interrupted
    // install must download again rather than treat rewritten files as fresh ones (and quantize them twice).
    try removeResumeMarkers(in: directory)

    // Read before patching: an unquantized build has no quantization to derive.
    let isFullPrecision = try OllamaRegistry.quantization(ofTensorsIn: directory) == nil
    try patchConfiguration(in: directory)
    try ChatTemplates.installIfMissing(in: directory)
    // The macOS benchmark keeps its full-precision reference this way; the app always optimizes.
    var flashBytes: Int64 = 0
    if ProcessInfo.processInfo.environment["QUOCK_LLM_KEEP_HEAD"] == nil {
      flashBytes = try InstallOptimizer.optimize(directory: directory, isFullPrecision: isFullPrecision)
    }
    try recordFileHashes(in: directory)
    // What is on disk now, not what was downloaded: the memory checks need the size of the weights that load.
    let installedBytes = try modelFiles(in: directory).reduce(Int64(0)) { total, file in
      total + Int64((try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
    }
    let model = InstalledModel(
      reference: ref.display, bytes: installedBytes, installedAt: Date(), capabilities: capabilities,
      manifestDigest: manifest.digest, format: mlxFormat, residentBytes: installedBytes - flashBytes)
    try JSONEncoder().encode(model).write(to: directory.appending(path: markerName), options: .atomic)
    return model
  }

  private static func downloadWithRetry(
    _ layer: OllamaLayer, of ref: ModelReference, to destination: URL
  ) async throws {
    var attempt = 0
    var resumeData: Data?
    while true {
      try Task.checkCancellation()
      do {
        _ = try await OllamaRegistry.download(layer, of: ref, to: destination, resumeData: resumeData)
        return
      } catch {
        attempt += 1
        guard attempt < downloadAttempts, isTransient(error) else { throw error }
        // A dropped connection hands back where it stopped; the next attempt continues from there with a Range request.
        resumeData = (error as? URLError)?.downloadTaskResumeData
        try await Task.sleep(nanoseconds: retryBaseDelay << UInt64(attempt - 1))
      }
    }
  }

  private static func modelFiles(in directory: URL) throws -> [URL] {
    try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
      .filter { !$0.lastPathComponent.hasPrefix(".") && !$0.lastPathComponent.hasPrefix("quock-") }
      .sorted { $0.lastPathComponent < $1.lastPathComponent }
  }

  // What the system will free up for a user-initiated download (purgeable caches included), not just empty blocks.
  static func availableDiskBytes(at url: URL) -> Int64? {
    let values = try? url.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
    return values?.volumeAvailableCapacityForImportantUsage
  }

  // Markers are the empty ".<file>.<digest prefix>" files written as each layer finishes downloading.
  static func removeResumeMarkers(in directory: URL) throws {
    let markers = try FileManager.default.contentsOfDirectory(
      at: directory, includingPropertiesForKeys: [.fileSizeKey]
    ).filter { url in
      url.lastPathComponent.hasPrefix(".") && (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) == 0
    }
    for marker in markers { try FileManager.default.removeItem(at: marker) }
  }

  static func recordFileHashes(in directory: URL) throws {
    let files = try modelFiles(in: directory)
    let hashes = Dictionary(uniqueKeysWithValues: zip(files.map(\.lastPathComponent), try FileDigest.digests(of: files)))
    try JSONEncoder().encode(hashes).write(to: directory.appending(path: fileHashesName), options: .atomic)
  }

  // Weights sit on disk for months; a file changed or truncated since it was verified must never reach the loader.
  static func verifyFiles(of ref: ModelReference) throws {
    let directory = directory(for: ref)
    let data = try Data(contentsOf: directory.appending(path: fileHashesName))
    let expected = try JSONDecoder().decode([String: String].self, from: data)
    let present = try modelFiles(in: directory)
    guard Set(present.map(\.lastPathComponent)) == Set(expected.keys) else {
      throw LocalModelStoreError.corrupted(ref.display)
    }
    // Installs recorded before FileDigest carry one plain SHA-256 per file.
    let chunked = present.filter { expected[$0.lastPathComponent]?.hasPrefix(FileDigest.prefix) == true }
    for (file, digest) in zip(chunked, try FileDigest.digests(of: chunked))
    where digest != expected[file.lastPathComponent] {
      throw LocalModelStoreError.corrupted(ref.display)
    }
    for file in present where !chunked.contains(file) {
      guard try OllamaRegistry.sha256(of: file) == expected[file.lastPathComponent] else {
        throw LocalModelStoreError.corrupted(ref.display)
      }
    }
  }

  private static func isTransient(_ error: Error) -> Bool {
    if let urlError = error as? URLError {
      return [.networkConnectionLost, .timedOut, .notConnectedToInternet, .cannotConnectToHost, .dnsLookupFailed]
        .contains(urlError.code)
    }
    if case OllamaRegistryError.http(let status, _) = error { return status >= 500 || status == 429 }
    // A corrupted transfer fails its checksum; fetching it again is the fix.
    if case OllamaRegistryError.digestMismatch = error { return true }
    return false
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

enum LocalModelStoreError: LocalizedError {
  case corrupted(String)
  case insufficientSpace(needed: Int64, free: Int64)

  var errorDescription: String? {
    switch self {
    case .corrupted(let ref): "The files of \(ref) are damaged. Remove the model and download it again."
    case .insufficientSpace(let needed, let free):
      "This model needs \(Self.gigabytes(needed)) of free storage and \(Self.gigabytes(free)) is available."
    }
  }

  private static func gigabytes(_ bytes: Int64) -> String {
    ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file)
  }
}

private actor ByteCounter {
  private var value: Int64 = 0

  func add(_ bytes: Int64) -> Int64 {
    value += bytes
    return value
  }
}
