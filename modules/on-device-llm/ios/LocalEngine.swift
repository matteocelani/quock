import Foundation
import MLX
import MLXLLM
import MLXLMCommon

enum LocalEngineError: LocalizedError {
  case notInstalled(String)

  var errorDescription: String? {
    switch self {
    case .notInstalled(let ref): "\(ref) is not downloaded on this device."
    }
  }
}

struct LocalTurn: Sendable {
  let role: String
  let content: String
}

enum LocalEvent: Sendable {
  case content(String)
  case thinking(String)
}

struct LocalStats: Sendable {
  let promptTokens: Int
  let generatedTokens: Int
  let promptSeconds: Double
  let generateSeconds: Double
  let loadSeconds: Double
  let peakMemoryBytes: Int
  var events = 0

  var dictionary: [String: Any] {
    [
      "promptTokens": promptTokens,
      "generatedTokens": generatedTokens,
      "promptSeconds": promptSeconds,
      "generateSeconds": generateSeconds,
      "tokensPerSecond": generateSeconds > 0 ? Double(generatedTokens) / generateSeconds : 0,
      "loadSeconds": loadSeconds,
      "peakMemoryBytes": peakMemoryBytes,
      "events": events,
    ]
  }
}

// One model resident at a time: an iPhone cannot hold two, and reloading costs seconds, so the last one stays warm.
actor LocalEngine {
  static let shared = LocalEngine()
  // MLX keeps freed buffers for reuse; on a phone that pool competes with the weights themselves.
  private static let bufferCacheLimit = 32 << 20

  private var container: ModelContainer?
  private var loadedRef: ModelReference?

  func load(_ ref: ModelReference) async throws -> (ModelContainer, Double) {
    if let container, loadedRef == ref { return (container, 0) }
    container = nil
    loadedRef = nil
    Memory.clearCache()
    guard LocalModelStore.installed(ref) != nil else { throw LocalEngineError.notInstalled(ref.display) }
    Memory.cacheLimit = Self.bufferCacheLimit
    let start = Date()
    let loaded = try await loadModelContainer(
      from: LocalModelStore.directory(for: ref), using: TransformersTokenizerLoader())
    container = loaded
    loadedRef = ref
    return (loaded, Date().timeIntervalSince(start))
  }

  func unload() {
    container = nil
    loadedRef = nil
    Memory.clearCache()
  }

  func generate(
    _ ref: ModelReference,
    turns: [LocalTurn],
    think: Bool?,
    maxTokens: Int,
    onEvent: @escaping @Sendable (LocalEvent) -> Void
  ) async throws -> LocalStats {
    let (container, loadSeconds) = try await load(ref)
    Memory.peakMemory = 0
    let chat: [Chat.Message] = turns.map { turn in
      switch turn.role {
      case "system": .system(turn.content)
      case "assistant": .assistant(turn.content)
      default: .user(turn.content)
      }
    }
    // No preference leaves the model's own template default in charge, exactly as an omitted `think` does on the cloud.
    let input = UserInput(chat: chat, additionalContext: think.map { ["enable_thinking": $0] })
    let prepared = try await container.prepare(input: input)
    // Qwen's published sampling defaults for each mode.
    let isThinking = think ?? true
    let parameters = GenerateParameters(
      maxTokens: maxTokens, temperature: isThinking ? 0.6 : 0.7, topP: isThinking ? 0.95 : 0.8)
    let stream = try await container.generate(input: prepared, parameters: parameters)

    var info: GenerateCompletionInfo?
    for await item in stream {
      if Task.isCancelled { break }
      switch item {
      case .chunk(let text): onEvent(.content(text))
      case .reasoning(let text): onEvent(.thinking(text))
      case .info(let completion): info = completion
      default: break
      }
    }
    return LocalStats(
      promptTokens: info?.promptTokenCount ?? 0,
      generatedTokens: info?.generationTokenCount ?? 0,
      promptSeconds: info?.promptTime ?? 0,
      generateSeconds: info?.generateTime ?? 0,
      loadSeconds: loadSeconds,
      peakMemoryBytes: Memory.peakMemory)
  }
}
