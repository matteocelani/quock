import Foundation
import MLXLLM

struct CatalogEntry: Sendable {
  let model: String
  let bytes: Int64
  let capabilities: [String]

  var dictionary: [String: Any] { ["model": model, "bytes": bytes, "capabilities": capabilities] }
}

// What Ollama lists under its MLX category, narrowed to the builds this phone can hold and this engine can run. Every
// answer comes from ollama.com itself: the category page, each model's tag list, and each candidate's manifest.
enum OllamaCatalog {
  private static let categoryURL = URL(string: "https://ollama.com/search?c=mlx")!
  private static let libraryBase = URL(string: "https://ollama.com/library")!
  // A model needs its weights plus the KV cache and runtime beside them; past this share of RAM iOS kills the app.
  private static let memoryShare = 0.35
  // Tags named after their quantization rather than `-mlx` are the same weights again; one build per size is enough.
  private static let mlxTagSuffix = "-mlx"
  private static let concurrentRequests = 6

  static var memoryBudget: Int64 { Int64(Double(ProcessInfo.processInfo.physicalMemory) * memoryShare) }

  static func fetch() async throws -> [CatalogEntry] {
    let families = try await mlxFamilies()
    var candidates: [ModelReference] = []
    try await withThrowingTaskGroup(of: [ModelReference].self) { group in
      var iterator = families.makeIterator()
      func enqueue() {
        guard let family = iterator.next() else { return }
        group.addTask { (try? await mlxTags(of: family)) ?? [] }
      }
      for _ in 0 ..< concurrentRequests { enqueue() }
      while let refs = try await group.next() {
        candidates.append(contentsOf: refs)
        enqueue()
      }
    }

    var entries: [CatalogEntry] = []
    try await withThrowingTaskGroup(of: CatalogEntry?.self) { group in
      var iterator = candidates.makeIterator()
      func enqueue() {
        guard let ref = iterator.next() else { return }
        group.addTask { try? await entry(for: ref) }
      }
      for _ in 0 ..< concurrentRequests { enqueue() }
      while let result = try await group.next() {
        if let result { entries.append(result) }
        enqueue()
      }
    }
    return entries.sorted { $0.bytes < $1.bytes }
  }

  private static func get(_ url: URL, json: Bool) async throws -> Data {
    var request = URLRequest(url: url)
    if json { request.setValue("application/json", forHTTPHeaderField: "Accept") }
    let (data, response) = try await URLSession.shared.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard status == 200 else { throw OllamaRegistryError.http(status, url.lastPathComponent) }
    return data
  }

  // The category exists only as a page; its model links are the stable part of it.
  private static func mlxFamilies() async throws -> [String] {
    let html = String(decoding: try await get(categoryURL, json: false), as: UTF8.self)
    let regex = try NSRegularExpression(pattern: #"href="/library/([a-z0-9][a-z0-9._-]*)""#)
    var seen = Set<String>()
    return regex.matches(in: html, range: NSRange(html.startIndex..., in: html)).compactMap { match in
      guard let range = Range(match.range(at: 1), in: html) else { return nil }
      let name = String(html[range])
      return seen.insert(name).inserted ? name : nil
    }
  }

  private struct TagList: Decodable { let tags: [String] }

  // Only sizes a phone can plausibly hold are worth a manifest request: the parameter count leads each tag.
  private static func mlxTags(of family: String) async throws -> [ModelReference] {
    let data = try await get(libraryBase.appending(path: "\(family)/tags"), json: true)
    let tags = try JSONDecoder().decode(TagList.self, from: data).tags
    return tags.compactMap { tag in
      guard tag.hasSuffix(mlxTagSuffix), let billions = parameterBillions(tag),
        Double(memoryBudget) >= billions * 1e9 * 0.5
      else { return nil }
      return try? ModelReference("\(family):\(tag)")
    }
  }

  private static func parameterBillions(_ tag: String) -> Double? {
    let regex = try? NSRegularExpression(pattern: #"^e?(\d+(?:\.\d+)?)b"#)
    guard let match = regex?.firstMatch(in: tag, range: NSRange(tag.startIndex..., in: tag)),
      let range = Range(match.range(at: 1), in: tag)
    else { return nil }
    return Double(tag[range])
  }

  private struct ConfigBlob: Decodable { let capabilities: [String]? }
  private struct ModelConfig: Decodable { let model_type: String? }

  private static func entry(for ref: ModelReference) async throws -> CatalogEntry? {
    let manifest = try await OllamaRegistry.manifest(for: ref)
    let layers = OllamaRegistry.neededLayers(of: manifest)
    let bytes = layers.reduce(Int64(0)) { $0 + $1.size }
    guard bytes > 0, bytes <= memoryBudget,
      let configLayer = layers.first(where: { $0.name == "config.json" })
    else { return nil }
    let configData = try await OllamaRegistry.blob(configLayer.digest, of: ref)
    guard let modelType = try JSONDecoder().decode(ModelConfig.self, from: configData).model_type,
      await LLMTypeRegistry.shared.contains(modelType, configuration: configData)
    else { return nil }
    var capabilities = ["completion"]
    if let digest = manifest.configDigest,
      let blob = try? JSONDecoder().decode(ConfigBlob.self, from: try await OllamaRegistry.blob(digest, of: ref)),
      blob.capabilities?.contains("thinking") == true
    {
      capabilities.append("thinking")
    }
    return CatalogEntry(model: ref.display, bytes: bytes, capabilities: capabilities)
  }
}
