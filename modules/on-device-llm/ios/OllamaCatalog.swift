import Foundation
import MLXLLM
#if os(iOS)
  import UIKit
#endif

struct CatalogEntry: Sendable {
  let model: String
  let bytes: Int64
  let capabilities: [String]

  var dictionary: [String: Any] { ["model": model, "bytes": bytes, "capabilities": capabilities] }
}

// The models offered for download: a curated list of Ollama tags (owned by the JS side), each checked live against
// the registry for existence, size and an architecture this engine loads, then kept only if this phone can hold it.
enum OllamaCatalog {
  // A model needs its weights plus the KV cache and runtime beside them; past this share of RAM iOS kills the app.
  // That ceiling was measured on an iPhone. An iPad and a Mac have more headroom per GB, and loading still checks
  // what the process may actually use (`AppMemory.available`), so the share only decides what is worth offering.
  private static var memoryShare: Double {
    #if os(iOS)
      if ProcessInfo.processInfo.isiOSAppOnMac || UIDevice.current.userInterfaceIdiom == .pad { return 0.5 }
      return 0.35
    #else
      return 0.5
    #endif
  }
  private static let kvAllowanceBytes: Int64 = 256 << 20
  private static let concurrentRequests = 4

  static var memoryBudget: Int64 { Int64(Double(ProcessInfo.processInfo.physicalMemory) * memoryShare) }

  static func fetch(models: [String]) async throws -> [CatalogEntry] {
    let refs = models.compactMap { try? ModelReference($0) }
    var entries: [CatalogEntry] = []
    try await withThrowingTaskGroup(of: CatalogEntry?.self) { group in
      var iterator = refs.makeIterator()
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

  private struct ConfigBlob: Decodable {
    let capabilities: [String]?
    let file_type: String?
  }
  private struct ModelConfig: Decodable { let model_type: String? }

  private static func entry(for ref: ModelReference) async throws -> CatalogEntry? {
    let manifest = try await OllamaRegistry.manifest(for: ref)
    let layers = OllamaRegistry.neededLayers(of: manifest)
    let bytes = layers.reduce(Int64(0)) { $0 + $1.size }
    var blob: ConfigBlob?
    if let digest = manifest.configDigest {
      blob = try? JSONDecoder().decode(ConfigBlob.self, from: try await OllamaRegistry.blob(digest, of: ref))
    }
    // Sized as it will be after the install-time optimization, and offered only if it could load right now too: a
    // fixed share of RAM alone once offered a 2B build that the app's own memory limit then refused.
    let loadedBytes = InstallOptimizer.estimatedBytes(
      of: layers, isFullPrecision: InstallOptimizer.isFullPrecision(fileType: blob?.file_type))
    guard bytes > 0, loadedBytes + kvAllowanceBytes <= memoryBudget,
      AppMemory.neededToLoad(bytes: loadedBytes) <= AppMemory.available,
      let configLayer = layers.first(where: { $0.name == "config.json" })
    else { return nil }
    let configData = try await OllamaRegistry.blob(configLayer.digest, of: ref)
    guard let modelType = try JSONDecoder().decode(ModelConfig.self, from: configData).model_type,
      await LLMTypeRegistry.shared.contains(modelType, configuration: configData)
    else { return nil }
    var capabilities = ["completion"]
    if blob?.capabilities?.contains("thinking") == true { capabilities.append("thinking") }
    return CatalogEntry(model: ref.display, bytes: bytes, capabilities: capabilities)
  }
}
