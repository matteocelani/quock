import Foundation
import MLX
import MLXLLM
import MLXLMCommon
import os

enum LocalEngineError: LocalizedError {
  case notInstalled(String)
  case gpuFailed(String)
  case insufficientMemory(String, needed: UInt64, available: UInt64)

  var errorDescription: String? {
    switch self {
    case .notInstalled(let ref): "\(ref) is not downloaded on this device."
    case .gpuFailed: "The on-device model stopped because the GPU refused the work. Try again."
    case .insufficientMemory(let ref, _, _):
      "There is not enough free memory to run \(ref) right now. Close other apps and try again."
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
  // Why the reply ended: "complete", or "inactive" / "lowMemory" when it was cut short to keep the app alive.
  var stopReason = "complete"
  var events = 0
  // Prompt tokens actually run this turn, the ones restored from the previous turn's snapshot instead, and the time
  // from the call to the first streamed token.
  var prefilledTokens = 0
  var reusedTokens = 0
  var firstTokenSeconds = 0.0

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
      "stopReason": stopReason,
      "prefilledTokens": prefilledTokens,
      "reusedTokens": reusedTokens,
      "firstTokenSeconds": firstTokenSeconds,
    ]
  }
}

// The cache as it stood after a turn's history, up to the assistant marker: the next turn of the same chat starts with
// exactly these tokens, so it restores this state and runs only what was added (the reply and the new message).
private final class PromptSnapshot: @unchecked Sendable {
  let ref: ModelReference
  let tokens: [Int]
  let cache: [KVCache]

  init(ref: ModelReference, tokens: [Int], cache: [KVCache]) {
    self.ref = ref
    self.tokens = tokens
    self.cache = cache
  }
}

private struct TurnOutcome: @unchecked Sendable {
  let stats: LocalStats
  let snapshot: PromptSnapshot?
}

// One model resident at a time: an iPhone cannot hold two, and reloading costs seconds, so the last one stays warm.
actor LocalEngine {
  static let shared = LocalEngine()
  // MLX keeps freed buffers for reuse; on a phone that pool competes with the weights themselves.
  private static let bufferCacheLimit = 32 << 20
  // Caps the KV cache: a long chat would otherwise grow it until iOS kills the app. Older turns rotate out first.
  private static let maxKVTokens = 8192
  // A phone-sized model asked to reason can reason forever: qwen3.5:0.8b spent 1,500 tokens (37 s) on 17 × 23 without
  // answering. Past this budget the reasoning block is closed and the model must answer.
  private static let thinkingBudgetTokens = 768

  private var container: ModelContainer?
  private var loadedRef: ModelReference?
  // Models whose files passed their hash check in this process; once is enough until the app restarts.
  private var verified = Set<ModelReference>()
  private var snapshot: PromptSnapshot?
  // Prompt tokens prefilled per model call before the snapshot point.
  private static let prefillChunk = 512
  private static let assistantMarker = "<|im_start|>assistant"

  func load(_ ref: ModelReference) async throws -> (ModelContainer, Double) {
    if let container, loadedRef == ref { return (container, 0) }
    container = nil
    loadedRef = nil
    snapshot = nil
    Memory.clearCache()
    guard let installed = LocalModelStore.installed(ref) else { throw LocalEngineError.notInstalled(ref.display) }
    // Offering uses a fixed share of RAM; loading checks what is actually free now, which other apps can shrink.
    let needed = AppMemory.neededToLoad(bytes: installed.bytes)
    let available = AppMemory.available
    guard needed <= available else {
      throw LocalEngineError.insufficientMemory(ref.display, needed: needed, available: available)
    }
    Memory.cacheLimit = Self.bufferCacheLimit
    let start = Date()
    if !verified.contains(ref) {
      try LocalModelStore.verifyFiles(of: ref)
      verified.insert(ref)
    }
    let loaded = try await loadModelContainer(
      from: LocalModelStore.directory(for: ref), using: TransformersTokenizerLoader())
    container = loaded
    loadedRef = ref
    return (loaded, Date().timeIntervalSince(start))
  }

  func unload() {
    container = nil
    loadedRef = nil
    snapshot = nil
    Memory.clearCache()
  }

  func generate(
    _ ref: ModelReference,
    turns: [LocalTurn],
    think: Bool?,
    maxTokens: Int,
    // Benchmarks pin sampling (0 = greedy) so two variants of a model can be compared token for token.
    temperatureOverride: Float? = nil,
    onEvent: @escaping @Sendable (LocalEvent) -> Void
  ) async throws -> LocalStats {
    // Loading moves the weights to the GPU too, so it waits for the foreground like generation does.
    guard ForegroundGate.shared.isActive else {
      return LocalStats(
        promptTokens: 0, generatedTokens: 0, promptSeconds: 0, generateSeconds: 0, loadSeconds: 0,
        peakMemoryBytes: 0, stopReason: "inactive")
    }
    _ = MLXFailure.take()
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
    // Qwen's published sampling defaults for each mode.
    let isThinking = think ?? true
    let parameters = GenerateParameters(
      maxTokens: maxTokens, maxKVSize: Self.maxKVTokens,
      temperature: temperatureOverride ?? (isThinking ? 0.6 : 0.7),
      topP: temperatureOverride == nil ? (isThinking ? 0.95 : 0.8) : 1.0)

    // QUOCK_LLM_NO_PREFIX_REUSE lets the benchmark measure the cold path against the reusing one.
    let previous = ProcessInfo.processInfo.environment["QUOCK_LLM_NO_PREFIX_REUSE"] == nil ? snapshot : nil
    snapshot = nil
    let outcome: TurnOutcome = try await container.perform { context in
      let start = Date()
      let prepared = try await context.processor.prepare(input: input)
      let promptTokens = prepared.text.tokens.flattened().asArray(Int.self)
      let boundary = Self.reuseBoundary(of: promptTokens, tokenizer: context.tokenizer)
      var cache: [KVCache]
      var position = 0
      if let previous, previous.ref == ref, previous.tokens.count <= boundary,
        promptTokens.starts(with: previous.tokens)
      {
        cache = previous.cache.map { $0.copy() }
        position = previous.tokens.count
      } else {
        cache = try context.model.newCache(parameters: parameters)
      }
      let reused = position
      while position < boundary {
        let end = min(boundary, position + Self.prefillChunk)
        _ = context.model(MLXArray(Array(promptTokens[position ..< end]))[.newAxis], cache: cache)
        eval(cache.flatMap(\.state))
        position = end
      }
      // A cache that already dropped old tokens no longer describes the whole prefix, so it is not kept.
      let nextSnapshot =
        cache.contains(where: { $0.evictedTokenCount > 0 })
        ? nil
        : PromptSnapshot(ref: ref, tokens: Array(promptTokens[..<boundary]), cache: cache.map { $0.copy() })
      // Templates that open the reasoning block themselves leave the model already inside it; without this the
      // whole reasoning would be routed to the answer.
      let isPrimedInsideReasoning =
        context.configuration.reasoningConfig.map {
          ReasoningEventEmitter.promptEndsInsideReasoning(
            promptTokens: promptTokens, config: $0, tokenizer: context.tokenizer)
        } ?? false
      var components = GenerationComponents()
      if think == true, let reasoning = context.configuration.reasoningConfig,
        let budget = try? ThinkingBudgetConfiguration(maximumTokenCount: Self.thinkingBudgetTokens),
        let processor = try? ThinkingBudgetProcessor(
          configuration: budget, reasoning: reasoning, tokenizer: context.tokenizer)
      {
        components = components.appendingLogitProcessor { processor }
      }
      let iterator = try TokenIterator(
        input: LMInput(tokens: MLXArray(Array(promptTokens[boundary...]))), model: context.model, cache: cache,
        parameters: parameters, components: components)
      // generateTask hands back the producer as well as the stream: stopping reading is not enough, the producer
      // finishes its token on the GPU, so it is cancelled and awaited before this returns.
      let (stream, producer) = generateTask(
        promptTokenCount: promptTokens.count, modelConfiguration: context.configuration,
        tokenizer: context.tokenizer, iterator: iterator, toolCallPolicy: parameters.toolCallPolicy,
        reasoningPrimedInside: isPrimedInsideReasoning)

      var info: GenerateCompletionInfo?
      var stopReason = "complete"
      var failure: String?
      var firstToken: Double?
      for await item in stream {
        if Task.isCancelled { break }
        if let message = MLXFailure.take() {
          failure = message
          break
        }
        if !ForegroundGate.shared.isActive {
          stopReason = "inactive"
          break
        }
        if AppMemory.available < AppMemory.generationFloorBytes {
          stopReason = "lowMemory"
          break
        }
        switch item {
        case .chunk(let text):
          if firstToken == nil { firstToken = Date().timeIntervalSince(start) }
          onEvent(.content(text))
        case .reasoning(let text):
          if firstToken == nil { firstToken = Date().timeIntervalSince(start) }
          onEvent(.thinking(text))
        case .info(let completion): info = completion
        default: break
        }
      }
      producer.cancel()
      await producer.value
      if let failure { throw LocalEngineError.gpuFailed(failure) }
      var stats = LocalStats(
        promptTokens: promptTokens.count,
        generatedTokens: info?.generationTokenCount ?? 0,
        promptSeconds: info?.promptTime ?? 0,
        generateSeconds: info?.generateTime ?? 0,
        loadSeconds: loadSeconds,
        peakMemoryBytes: Memory.peakMemory, stopReason: stopReason)
      stats.prefilledTokens = promptTokens.count - reused
      stats.reusedTokens = reused
      stats.firstTokenSeconds = firstToken ?? 0
      return TurnOutcome(stats: stats, snapshot: nextSnapshot)
    }
    snapshot = outcome.snapshot
    return outcome.stats
  }

  // Where this turn's snapshot ends: just after the last assistant marker (the start of the reply being generated),
  // which is where the next turn's prompt stops matching. At least one token is always left for the generator.
  static func reuseBoundary(of tokens: [Int], tokenizer: any Tokenizer) -> Int {
    let last = max(0, tokens.count - 1)
    let marker = tokenizer.encode(text: assistantMarker, addSpecialTokens: false)
    guard !marker.isEmpty, tokens.count > marker.count else { return last }
    var index = tokens.count - marker.count
    while index >= 0 {
      if tokens[index ..< index + marker.count].elementsEqual(marker) {
        return min(index + marker.count, last)
      }
      index -= 1
    }
    return last
  }
}
