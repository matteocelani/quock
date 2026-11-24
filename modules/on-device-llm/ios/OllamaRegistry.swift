import CryptoKit
import Foundation

enum OllamaRegistryError: LocalizedError {
  case badReference(String)
  case http(Int, String)
  case noMLXBuild(String)
  case digestMismatch(String)
  case malformedTensor(String)

  var errorDescription: String? {
    switch self {
    case .badReference(let ref): "\(ref) is not a valid model name."
    case .http(let status, let what): "The model registry answered \(status) for \(what)."
    case .noMLXBuild(let ref): "\(ref) has no build that runs on this device. Pick a tag ending in -mlx."
    case .digestMismatch(let digest): "A downloaded file did not match its checksum (\(digest))."
    case .malformedTensor(let name): "The model file \(name) is not in the expected format."
    }
  }
}

struct ModelReference: Sendable, Hashable {
  let namespace: String
  let name: String
  let tag: String

  var display: String { namespace == "library" ? "\(name):\(tag)" : "\(namespace)/\(name):\(tag)" }

  // Same grammar `ollama pull` accepts: [namespace/]name[:tag], tag defaulting to latest.
  init(_ raw: String) throws {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let parts = trimmed.split(separator: ":", maxSplits: 1).map(String.init)
    guard let path = parts.first, !path.isEmpty else { throw OllamaRegistryError.badReference(raw) }
    // Empty segments are kept so "a//b" is rejected instead of silently read as "a/b".
    let segments = path.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
    guard segments.count <= 2, segments.allSatisfy({ !$0.isEmpty }) else {
      throw OllamaRegistryError.badReference(raw)
    }
    namespace = segments.count == 2 ? segments[0] : "library"
    name = segments.last!
    tag = parts.count == 2 && !parts[1].isEmpty ? parts[1] : "latest"
  }
}

struct OllamaLayer: Decodable, Sendable {
  let mediaType: String
  let digest: String
  let size: Int64
  let name: String?
}

struct OllamaManifest: Decodable, Sendable {
  let mediaType: String?
  let config: OllamaLayer?
  let layers: [OllamaLayer]?
  let manifests: [Child]?
  // sha256 of the manifest bytes: it changes whenever Ollama republishes the tag, so an installed copy can tell it is
  // stale, and it pins exactly which files a model on disk came from.
  var digest = ""

  var configDigest: String? { config?.digest }

  private enum CodingKeys: String, CodingKey { case mediaType, config, layers, manifests }

  struct Child: Decodable, Sendable {
    let digest: String
    let runner: String?
    let format: String?
  }
}

enum OllamaRegistry {
  static let host = URL(string: "https://registry.ollama.ai")!
  private static let manifestAccept =
    "application/vnd.ollama.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json"
  private static let tensorMediaType = "application/vnd.ollama.image.tensor"
  private static let jsonMediaType = "application/vnd.ollama.image.json"
  // Kept beside the weights: the model's own terms differ by family and travel with the copy on the phone.
  private static let licenseMediaType = "application/vnd.ollama.image.license"
  // The text model only reads these; the vision tower and video preprocessor are skipped to save the download.
  private static let neededJSON: Set<String> = [
    "config.json", "tokenizer.json", "tokenizer_config.json", "generation_config.json",
  ]
  // Towers the text model never runs (vision, audio) and Gemma 4's bundled draft model: skipping them saves about 1 GB
  // of download on gemma4:e2b.
  private static let skippedTensorPrefixes = [
    "model.visual.", "visual.", "vision_tower.", "model.vision_tower.", "model.audio_tower.", "audio_tower.",
    "model.embed_vision.", "model.embed_audio.", "draft.",
  ]

  static func manifest(for ref: ModelReference) async throws -> OllamaManifest {
    let base = host.appending(path: "v2/\(ref.namespace)/\(ref.name)")
    var manifest = try await fetchManifest(base.appending(path: "manifests/\(ref.tag)"), what: ref.display)
    // A multi-format tag lists one child per runner; the MLX child is fetched as a blob, the way Ollama does.
    if let children = manifest.manifests {
      guard let child = children.first(where: { $0.runner == "mlx" || $0.format == "safetensors" }) else {
        throw OllamaRegistryError.noMLXBuild(ref.display)
      }
      manifest = try await fetchManifest(base.appending(path: "blobs/\(child.digest)"), what: ref.display)
    }
    guard manifest.layers?.contains(where: { $0.mediaType == tensorMediaType }) == true else {
      throw OllamaRegistryError.noMLXBuild(ref.display)
    }
    return manifest
  }

  static func neededLayers(of manifest: OllamaManifest) -> [OllamaLayer] {
    (manifest.layers ?? []).filter { layer in
      switch layer.mediaType {
      case tensorMediaType:
        let name = layer.name ?? ""
        return !skippedTensorPrefixes.contains(where: name.hasPrefix)
      case jsonMediaType:
        return neededJSON.contains(layer.name ?? "")
      case licenseMediaType:
        return true
      default:
        return false
      }
    }
  }

  static func layers(for ref: ModelReference) async throws -> [OllamaLayer] {
    neededLayers(of: try await manifest(for: ref))
  }

  // Small JSON blobs only (configs); weights go through `download`, which verifies and streams to disk.
  static func blob(_ digest: String, of ref: ModelReference) async throws -> Data {
    let url = host.appending(path: "v2/\(ref.namespace)/\(ref.name)/blobs/\(digest)")
    let (data, response) = try await URLSession.shared.data(from: url)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard status == 200 else { throw OllamaRegistryError.http(status, digest) }
    guard sha256(of: data) == digest else { throw OllamaRegistryError.digestMismatch(digest) }
    return data
  }

  private static func fetchManifest(_ url: URL, what: String) async throws -> OllamaManifest {
    var request = URLRequest(url: url)
    request.setValue(manifestAccept, forHTTPHeaderField: "Accept")
    let (data, response) = try await URLSession.shared.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard status == 200 else { throw OllamaRegistryError.http(status, what) }
    var manifest = try JSONDecoder().decode(OllamaManifest.self, from: data)
    manifest.digest = sha256(of: data)
    return manifest
  }

  // The blob as the background downloader keys it: by digest, so a transfer from an earlier launch is recognised.
  static func blobRequest(_ layer: OllamaLayer, of ref: ModelReference, resumeData: Data? = nil)
    -> BackgroundDownloads.Request
  {
    .init(
      key: layer.digest, url: host.appending(path: "v2/\(ref.namespace)/\(ref.name)/blobs/\(layer.digest)"),
      resumeData: resumeData)
  }

  // Downloads one blob, checks it against its digest, and writes it to `destination`, returning the sha256 of what
  // was written (a rewritten tensor no longer matches the registry digest, so it gets its own). The registry answers
  // with a redirect to a signed CDN URL, which URLSession follows; `resumeData` continues an interrupted transfer.
  static func download(
    _ layer: OllamaLayer, of ref: ModelReference, to destination: URL, resumeData: Data? = nil,
    onWritten: (@Sendable (Int64) -> Void)? = nil
  ) async throws -> String {
    let request = blobRequest(layer, of: ref, resumeData: resumeData)
    await BackgroundDownloads.shared.start([request])
    let temporary = try await BackgroundDownloads.shared.collect(request, onWritten: onWritten ?? { _ in })
    defer { try? FileManager.default.removeItem(at: temporary) }
    guard try sha256(of: temporary) == layer.digest else {
      throw OllamaRegistryError.digestMismatch(layer.digest)
    }
    if layer.mediaType == tensorMediaType {
      try rewriteTensorHeader(from: temporary, to: destination)
      return try sha256(of: destination)
    }
    try? FileManager.default.removeItem(at: destination)
    try FileManager.default.moveItem(at: temporary, to: destination)
    return layer.digest
  }

  static func sha256(of data: Data) -> String {
    "sha256:" + SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }

  static func sha256(of url: URL) throws -> String {
    let handle = try FileHandle(forReadingFrom: url)
    defer { try? handle.close() }
    var hasher = SHA256()
    // Each chunk is released before the next is read; without the pool a multi-GB file piles up in memory until the
    // whole loop returns, which is what left a 2B model too little room to load right after its download.
    var isDone = false
    while !isDone {
      try autoreleasepool {
        guard let chunk = try handle.read(upToCount: 4 << 20), !chunk.isEmpty else {
          isDone = true
          return
        }
        hasher.update(data: chunk)
      }
    }
    return "sha256:" + hasher.finalize().map { String(format: "%02x", $0) }.joined()
  }

  // Ollama stores an MLX quantized tensor's scales as `<name>.weight.scale`; mlx-swift-lm looks for `<name>.scales`.
  // Only the JSON header changes, and data offsets are relative to its end, so the tensor bytes copy over untouched.
  static func rewriteTensorHeader(from source: URL, to destination: URL) throws {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    guard let lengthData = try input.read(upToCount: 8), lengthData.count == 8 else {
      throw OllamaRegistryError.malformedTensor(source.lastPathComponent)
    }
    let headerLength = lengthData.withUnsafeBytes { $0.loadUnaligned(as: UInt64.self) }.littleEndian
    guard headerLength > 0, headerLength < 64 << 20,
      let headerData = try input.read(upToCount: Int(headerLength)), headerData.count == Int(headerLength),
      var header = try JSONSerialization.jsonObject(with: headerData) as? [String: Any]
    else {
      throw OllamaRegistryError.malformedTensor(source.lastPathComponent)
    }
    for key in Array(header.keys) where key.hasSuffix(".weight.scale") {
      header[String(key.dropLast(".weight.scale".count)) + ".scales"] = header.removeValue(forKey: key)
    }
    var newHeader = try JSONSerialization.data(withJSONObject: header, options: [.sortedKeys])
    // safetensors keeps the data section 8-byte aligned; JSON allows trailing spaces as padding.
    let padding = (8 - newHeader.count % 8) % 8
    newHeader.append(contentsOf: [UInt8](repeating: 0x20, count: padding))

    try? FileManager.default.removeItem(at: destination)
    FileManager.default.createFile(atPath: destination.path, contents: nil)
    let output = try FileHandle(forWritingTo: destination)
    defer { try? output.close() }
    var length = UInt64(newHeader.count).littleEndian
    try output.write(contentsOf: Data(bytes: &length, count: 8))
    try output.write(contentsOf: newHeader)
    var isDone = false
    while !isDone {
      try autoreleasepool {
        guard let chunk = try input.read(upToCount: 8 << 20), !chunk.isEmpty else {
          isDone = true
          return
        }
        try output.write(contentsOf: chunk)
      }
    }
  }

  // MLX-format Ollama builds ship the original config.json without a `quantization` entry, and the loader only swaps
  // in quantized layers when that entry exists. The values come from the tensors' own safetensors metadata.
  static func quantization(ofTensorsIn directory: URL) throws -> [String: Any]? {
    let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
      .filter { $0.pathExtension == "safetensors" }
    // Each blob carries its own format; a build can mix them (an 8-bit layer inside a 4-bit body), so the most common
    // one becomes the default and every tensor that differs gets its own per-layer entry.
    var byModule: [String: [String: AnyHashable]] = [:]
    for file in files {
      let handle = try FileHandle(forReadingFrom: file)
      defer { try? handle.close() }
      guard let lengthData = try handle.read(upToCount: 8), lengthData.count == 8 else { continue }
      let length = lengthData.withUnsafeBytes { $0.loadUnaligned(as: UInt64.self) }.littleEndian
      guard length < 64 << 20, let data = try handle.read(upToCount: Int(length)),
        let header = try JSONSerialization.jsonObject(with: data) as? [String: Any],
        let metadata = header["__metadata__"] as? [String: String],
        let mode = metadata["quant_type"], let group = metadata["group_size"].flatMap(Int.init),
        let weightKey = header.keys.first(where: { $0.hasSuffix(".weight") })
      else { continue }
      let bits: Int
      switch mode {
      case "mxfp8": bits = 8
      case "mxfp4", "nvfp4": bits = 4
      default: bits = Int(metadata["bits"] ?? "") ?? 4
      }
      let entry: [String: AnyHashable] = [
        "group_size": group, "bits": bits, "mode": mode == "affine" || mode.hasPrefix("q") ? "affine" : mode,
      ]
      byModule[HeadQuantizer.modulePath(forCheckpointKey: String(weightKey.dropLast(".weight".count)))] = entry
    }
    var counts: [[String: AnyHashable]: Int] = [:]
    for entry in byModule.values { counts[entry, default: 0] += 1 }
    guard let common = counts.max(by: { $0.value < $1.value })?.key else { return nil }
    var result: [String: Any] = common
    for (module, entry) in byModule where entry != common {
      result[module] = entry
    }
    return result
  }
}
