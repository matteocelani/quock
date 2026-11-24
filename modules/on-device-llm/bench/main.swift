import Foundation
@testable import OnDeviceLLMCore
import MLX
import MLXLLM
import MLXLMCommon
import MLXNN

// quock-llm-bench: measures the on-device engine on a Mac with the exact sources the app ships.
//   pull  <model>                          download an Ollama MLX build into QUOCK_LLM_MODELS_DIR
//   speed <model> [tokens] [runs]          greedy decode on fixed prompts: tok/s, prefill, peak memory
//   text  <model> <prompt> [tokens] [think] one greedy reply, printed in full
//   variant <model> <bits> <group>         copy <model> as <tag>-h<bits>g<group> with the tied head quantized
//   quality <reference> <candidate> [tokens] [temperature]  teacher-forced KL / top-1 agreement vs reference
//   body <model> <bits> <group> [sensitive,fragments] [sensitiveBits]  copy with the linear layers re-quantized
//   headbench <vocab> <hidden>             GEMV of the LM head alone: BF16 vs affine 8/6/4-bit

let benchPrompts = [
  "Ciao! Spiegami in due frasi cos'è un buco nero.",
  "Write a short Python function that checks whether a number is prime, then explain it.",
  "Elenca cinque città italiane e una curiosità su ciascuna.",
  "Summarize the causes of the French Revolution in one paragraph.",
  "Scrivi una breve poesia sul mare d'inverno.",
]

final class Collector: @unchecked Sendable {
  private let lock = NSLock()
  private var text = ""
  func append(_ chunk: String) { lock.withLock { text += chunk } }
  var value: String { lock.withLock { text } }
}


// Mixed Italian/English, short and long, chat and task: the distribution the app actually serves.
let qualityPrompts = [
  "Ciao! Come stai oggi?", "Spiegami cos'è la fotosintesi in parole semplici.",
  "Quanto fa 17 per 23? Mostra il calcolo.", "Scrivi una mail formale per chiedere un appuntamento.",
  "Traduci in inglese: 'Domani andiamo al mare se non piove.'", "Qual è la capitale dell'Australia?",
  "Dammi tre consigli per dormire meglio.", "Riassumi la trama dei Promessi Sposi in quattro frasi.",
  "Scrivi una funzione JavaScript che inverte una stringa.", "Che differenza c'è tra virus e batteri?",
  "Elenca i pianeti del sistema solare in ordine.", "Racconta una barzelletta sui gatti.",
  "Come si prepara una carbonara tradizionale?", "Perché il cielo è blu?",
  "Scrivi un haiku sull'autunno.", "What is the difference between TCP and UDP?",
  "Explain recursion to a ten-year-old.", "Write a SQL query that returns the top 5 customers by revenue.",
  "List three causes of the First World War.", "How do vaccines train the immune system?",
  "Give me a short motivational quote and explain it.", "What is 12% of 250? Show your work.",
  "Describe the water cycle in four steps.", "Write a limerick about a programmer.",
  "Convert 72 degrees Fahrenheit to Celsius.", "What are the main ideas of stoicism?",
  "Suggest a name for a coffee shop and justify it.", "Explain what a black hole is in two sentences.",
  "Come funziona un motore elettrico?", "Proponi un itinerario di tre giorni a Roma.",
]

func percentile(_ values: [Double], _ p: Double) -> Double {
  let sorted = values.sorted()
  guard !sorted.isEmpty else { return 0 }
  return sorted[min(sorted.count - 1, Int((Double(sorted.count - 1) * p).rounded()))]
}

func timeIt(_ iterations: Int, _ body: () -> MLXArray) -> Double {
  for _ in 0 ..< 5 { eval(body()) }
  let start = Date()
  for _ in 0 ..< iterations { eval(body()) }
  return Date().timeIntervalSince(start) / Double(iterations)
}


struct SpeedResult {
  let decodeMedian: Double
  let decodeMin: Double
  let decodeMax: Double
  let prefillMedian: Double
  let peakMemoryMB: Int
  let samples: Int
}

func measureSpeed(_ ref: ModelReference, tokens: Int, runs: Int) async throws -> SpeedResult {
  // QUOCK_PRODUCTION_SAMPLER measures the app's own temperature / top-p path instead of greedy decoding.
  let temperature: Float? = ProcessInfo.processInfo.environment["QUOCK_PRODUCTION_SAMPLER"] == nil ? 0 : nil
  var decode: [Double] = []
  var prefill: [Double] = []
  var peak = 0
  // One warm-up so Metal kernel compilation is not charged to the first measured prompt.
  _ = try await LocalEngine.shared.generate(
    ref, turns: [LocalTurn(role: "user", content: "Hi")], think: false, maxTokens: 8, temperatureOverride: 0
  ) { _ in }
  for _ in 0 ..< runs {
    for prompt in benchPrompts {
      let stats = try await LocalEngine.shared.generate(
        ref, turns: [LocalTurn(role: "user", content: prompt)], think: false, maxTokens: tokens,
        temperatureOverride: temperature
      ) { _ in }
      if stats.generateSeconds > 0 { decode.append(Double(stats.generatedTokens) / stats.generateSeconds) }
      if stats.promptSeconds > 0 { prefill.append(Double(stats.promptTokens) / stats.promptSeconds) }
      peak = max(peak, stats.peakMemoryBytes)
    }
  }
  return SpeedResult(
    decodeMedian: median(decode), decodeMin: decode.min() ?? 0, decodeMax: decode.max() ?? 0,
    prefillMedian: median(prefill), peakMemoryMB: peak >> 20, samples: decode.count)
}

struct QualityResult {
  let meanKL: Double
  let p99KL: Double
  let maxKL: Double
  let top1: Double
  let positions: Int
}

func measureQuality(
  reference ref: ModelReference, candidate: ModelReference, tokens: Int, temperature: Float, promptCount: Int
) async throws -> QualityResult {
  // The reference can live in its own store (QUOCK_LLM_REFERENCE_DIR): an unoptimized build shares its name with the
  // optimized one the app installs.
  let referenceDirectory = ProcessInfo.processInfo.environment["QUOCK_LLM_REFERENCE_DIR"].map {
    URL(fileURLWithPath: $0, isDirectory: true).appending(path: "\(ref.namespace)/\(ref.name)/\(ref.tag)")
  } ?? LocalModelStore.directory(for: ref)
  await FlashEmbeddings.registerIfNeeded()
  FlashEmbeddings.loadingDirectory = referenceDirectory
  let reference = try await loadModelContainer(from: referenceDirectory, using: TransformersTokenizerLoader())
  FlashEmbeddings.loadingDirectory = LocalModelStore.directory(for: candidate)
  let other = try await loadModelContainer(from: LocalModelStore.directory(for: candidate), using: TransformersTokenizerLoader())
  var kls: [Double] = []
  var agree = 0
  var positions = 0
  for prompt in qualityPrompts.prefix(promptCount) {
    // The reference writes its own greedy continuation; both models are then scored on that exact sequence.
    let sequence: [Int] = try await reference.perform { context in
      let input = try await context.processor.prepare(
        input: UserInput(chat: [.user(prompt)], additionalContext: ["enable_thinking": false]))
      var ids = input.text.tokens.flattened().asArray(Int.self)
      let cache = try context.model.newCache(parameters: nil)
      var logits = context.model(MLXArray(ids)[.newAxis], cache: cache)
      for _ in 0 ..< tokens {
        let next = argMax(logits[0, -1], axis: -1).item(Int.self)
        ids.append(next)
        logits = context.model(MLXArray([next])[.newAxis], cache: cache)
      }
      return ids
    }
    let promptLength = sequence.count - tokens
    func logProbs(_ container: ModelContainer) async throws -> MLXArray {
      try await container.perform { context in
        let cache = try context.model.newCache(parameters: nil)
        let logits = context.model(MLXArray(sequence)[.newAxis], cache: cache)[0, (promptLength - 1) ..< (sequence.count - 1)]
          .asType(.float32) / temperature
        let result = logits - logSumExp(logits, axis: -1, keepDims: true)
        eval(result)
        return result
      }
    }
    let p = try await logProbs(reference)
    let q = try await logProbs(other)
    let kl = (exp(p) * (p - q)).sum(axis: -1)
    let same = (argMax(p, axis: -1) .== argMax(q, axis: -1)).asType(.int32)
    eval(kl, same)
    kls.append(contentsOf: kl.asArray(Float.self).map(Double.init))
    agree += Int(same.sum().item(Int32.self))
    positions += tokens
  }
  return QualityResult(
    meanKL: kls.reduce(0, +) / Double(max(kls.count, 1)), p99KL: percentile(kls, 0.99), maxKL: kls.max() ?? 0,
    top1: Double(agree) / Double(max(positions, 1)), positions: positions)
}

struct FunctionalCheck {
  let name: String
  let prompt: String
  let think: Bool
  let expectAny: [String]
}

// Greedy answers a model of this family gets right today; a regression shows up as a missing keyword.
let functionalChecks = [
  FunctionalCheck(name: "fact-it", prompt: "Qual è la capitale dell'Australia? Rispondi con una sola parola.", think: false, expectAny: ["Canberra"]),
  FunctionalCheck(name: "fact-en", prompt: "What is the chemical symbol for gold? Answer with the symbol only.", think: false, expectAny: ["Au"]),
  FunctionalCheck(name: "translate", prompt: "Traduci in inglese: 'Il gatto dorme sul divano.'", think: false, expectAny: ["cat"]),
  FunctionalCheck(name: "arithmetic-think", prompt: "Quanto fa 17 * 23? Rispondi solo con il numero.", think: true, expectAny: ["391"]),
  FunctionalCheck(name: "count", prompt: "Elenca i numeri da 1 a 5 separati da virgole.", think: false, expectAny: ["1, 2, 3, 4, 5", "1,2,3,4,5"]),
]

func runFunctional(_ ref: ModelReference) async throws -> [String: Bool] {
  var outcome: [String: Bool] = [:]
  // Reasoning is only demanded of builds that declare it: Ollama's gemma4:e2b-mlx does not, and answers directly.
  let canThink = LocalModelStore.installed(ref)?.capabilities?.contains("thinking") ?? true
  for check in functionalChecks {
    let answer = Collector()
    let reasoning = Collector()
    let stats = try await LocalEngine.shared.generate(
      ref, turns: [LocalTurn(role: "user", content: check.prompt)], think: check.think, maxTokens: 1024,
      temperatureOverride: 0
    ) { event in
      switch event {
      case .content(let text): answer.append(text)
      case .thinking(let text): reasoning.append(text)
      }
    }
    let passed = check.expectAny.contains { answer.value.contains($0) }
      && (!check.think || !canThink || !reasoning.value.isEmpty) && stats.generatedTokens <= 1024
    outcome[check.name] = passed
    if !passed { emit("FUNCTIONAL FAIL \(check.name): \(answer.value.prefix(200))") }
  }
  return outcome
}

func emit(_ line: String) { FileHandle.standardOutput.write(Data((line + "\n").utf8)) }

func median(_ values: [Double]) -> Double {
  let sorted = values.sorted()
  guard !sorted.isEmpty else { return 0 }
  let mid = sorted.count / 2
  return sorted.count % 2 == 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

func run() async throws {
  var args = Array(CommandLine.arguments.dropFirst())
  guard !args.isEmpty else {
    emit("usage: quock-llm-bench pull|speed|text <model> ...")
    exit(2)
  }
  let command = args.removeFirst()
  guard !args.isEmpty else { throw NSError(domain: "bench", code: 2, userInfo: [NSLocalizedDescriptionKey: "missing model"]) }
  let ref = try ModelReference(args.removeFirst())
  await MainActor.run { ForegroundGate.shared.start() }

  switch command {
  case "pull":
    var lastDecile = -1
    let start = Date()
    let installed = try await LocalModelStore.pull(ref) { completed, total in
      let decile = total > 0 ? Int(completed * 10 / total) : 0
      if ProcessInfo.processInfo.environment["QUOCK_BENCH_PROGRESS_ALL"] != nil {
        emit("progress \(completed) / \(total)")
      } else if decile != lastDecile {
        lastDecile = decile
        emit("pull \(completed >> 20)/\(total >> 20) MB")
      }
    }
    emit("pulled \(installed.reference) \(installed.bytes >> 20) MB in \(String(format: "%.1f", Date().timeIntervalSince(start)))s")

  case "speed":
    let tokens = args.first.flatMap(Int.init) ?? 256
    let runs = args.dropFirst().first.flatMap(Int.init) ?? 3
    let speed = try await measureSpeed(ref, tokens: tokens, runs: runs)
    let result: [String: Any] = [
      "model": ref.display, "samples": speed.samples, "decodeTokPerSecMedian": speed.decodeMedian,
      "decodeTokPerSecMin": speed.decodeMin, "decodeTokPerSecMax": speed.decodeMax,
      "prefillTokPerSecMedian": speed.prefillMedian, "peakMemoryMB": speed.peakMemoryMB,
    ]
    let json = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
    emit("RESULT " + String(decoding: json, as: UTF8.self))

  case "text":
    guard let prompt = args.first else { throw NSError(domain: "bench", code: 2) }
    let tokens = args.dropFirst().first.flatMap(Int.init) ?? 256
    let think = args.dropFirst(2).first == "think"
    let answer = Collector()
    let reasoning = Collector()
    let stats = try await LocalEngine.shared.generate(
      ref, turns: [LocalTurn(role: "user", content: prompt)], think: think, maxTokens: tokens, temperatureOverride: 0
    ) { event in
      switch event {
      case .content(let text): answer.append(text)
      case .thinking(let text): reasoning.append(text)
      }
    }
    if !reasoning.value.isEmpty { emit("THINKING\n\(reasoning.value)") }
    emit("ANSWER\n\(answer.value)")
    emit("STATS \(stats.dictionary)")

  case "body":
    let bits = args.first.flatMap(Int.init) ?? 4
    let group = args.dropFirst().first.flatMap(Int.init) ?? 64
    let sensitive = args.dropFirst(2).first.map { $0.split(separator: ",").map(String.init) } ?? []
    let sensitiveBits = args.dropFirst(3).first.flatMap(Int.init) ?? 8
    let label = sensitive.isEmpty
      ? "" : "-s\(sensitiveBits)-" + sensitive.joined(separator: "_").filter { $0.isLetter || $0.isNumber || $0 == "_" }
    let variant = try ModelReference("\(ref.name):\(ref.tag)-b\(bits)g\(group)\(label)")
    let target = LocalModelStore.directory(for: variant)
    try? FileManager.default.removeItem(at: target)
    try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
    try FileManager.default.copyItem(at: LocalModelStore.directory(for: ref), to: target)
    let outcome = try BodyQuantizer.quantize(
      directory: target,
      plan: .init(bits: bits, groupSize: group, sensitive: sensitive, sensitiveBits: sensitiveBits))
    if ProcessInfo.processInfo.environment["QUOCK_LLM_KEEP_HEAD"] == nil {
      _ = try HeadQuantizer.quantizeEmbedding(
        in: target, bits: InstallOptimizer.headBits, groupSize: InstallOptimizer.headGroupSize)
    }
    try LocalModelStore.recordFileHashes(in: target)
    let marker = target.appending(path: "quock-installed.json")
    var installed = try JSONSerialization.jsonObject(with: Data(contentsOf: marker)) as? [String: Any] ?? [:]
    installed["reference"] = variant.display
    try JSONSerialization.data(withJSONObject: installed).write(to: marker, options: .atomic)
    emit("body \(variant.display): \(outcome.tensors) tensors \(outcome.bytesBefore >> 20) MB -> \(outcome.bytesAfter >> 20) MB sensitive=\(sensitive)")

  case "chat":
    // chat <model> [turns]: a multi-turn conversation replayed the way the app sends it (whole history each turn),
    // greedy. Prints per-turn prefill/reuse/TTFT and the start of every answer, so a run with
    // QUOCK_LLM_NO_PREFIX_REUSE can be compared token for token.
    let userTurns = [
      "Ciao! Mi consigli un libro di fantascienza?", "Perché proprio quello? Dimmi di più sulla trama.",
      "E l'autore ha scritto altro?", "Riassumi in una frase tutto quello che mi hai detto finora.",
      "Ora dimmi tre film simili.", "Quale dei tre guarderesti stasera e perché?",
    ]
    let turns = min(userTurns.count, args.first.flatMap(Int.init) ?? userTurns.count)
    var history: [LocalTurn] = []
    for (index, message) in userTurns.prefix(turns).enumerated() {
      history.append(LocalTurn(role: "user", content: message))
      let answer = Collector()
      let stats = try await LocalEngine.shared.generate(
        ref, turns: history, think: false, maxTokens: 96, temperatureOverride: 0
      ) { event in
        if case .content(let text) = event { answer.append(text) }
      }
      history.append(LocalTurn(role: "assistant", content: answer.value))
      emit(String(
        format: "TURN %d prompt=%d prefilled=%d reused=%d ttft=%.3fs tok/s=%.0f", index + 1, stats.promptTokens,
        stats.prefilledTokens, stats.reusedTokens, stats.firstTokenSeconds,
        stats.generateSeconds > 0 ? Double(stats.generatedTokens) / stats.generateSeconds : 0))
      emit("ANSWER \(index + 1): \(answer.value.prefix(160).replacingOccurrences(of: "\n", with: " "))")
    }

  case "reusecheck":
    // reusecheck <model>: for each turn of a fixed conversation, scores the same token sequence three ways: cold (one
    // prefill of everything), as the engine reuses it (previous turn's prefix, cache copied, then the rest), and a
    // control split at the middle of the prompt with no reuse. Chunked prefill is not bit-exact on the GPU, so the
    // gate is relative: reuse may not drift from cold more than the control does (x1.25, floor 1e-3).
    let conversation: [(String, String)] = [
      ("Ciao! Mi consigli un libro di fantascienza?", "Ti consiglio Dune di Frank Herbert: un classico su politica, ecologia e religione su un pianeta desertico."),
      ("Perché proprio quello?", "Perché costruisce un mondo coerente e profondo, con personaggi memorabili e temi ancora attuali."),
      ("E l'autore ha scritto altro?", "Sì, cinque seguiti di Dune e romanzi come Il cervello verde e La macchina dei sogni."),
      ("Riassumi tutto in una frase.", "Dune è un classico profondo e Herbert ha scritto molto altro nello stesso universo."),
      ("Ora dimmi tre film simili.", ""),
    ]
    await FlashEmbeddings.registerIfNeeded()
    FlashEmbeddings.loadingDirectory = LocalModelStore.directory(for: ref)
    let container = try await loadModelContainer(from: LocalModelStore.directory(for: ref), using: TransformersTokenizerLoader())
    let parameters = GenerateParameters(maxKVSize: 8192)
    var reuseKL: [Double] = []
    var controlKL: [Double] = []
    var agree = 0
    var positions = 0
    var previousBoundary = 0
    for turn in 0 ..< conversation.count {
      var chat: [Chat.Message] = []
      for (index, pair) in conversation.prefix(turn + 1).enumerated() {
        chat.append(.user(pair.0))
        if index < turn { chat.append(.assistant(pair.1)) }
      }
      let reusePoint = previousBoundary
      let result: ([Double], [Double], Int, Int, Int) = try await container.perform { context in
        let prompt = try await context.processor.prepare(
          input: UserInput(chat: chat, additionalContext: ["enable_thinking": false])
        ).text.tokens.flattened().asArray(Int.self)
        // 32 greedy tokens of continuation, so the comparison covers generation, not just the last prompt position.
        var sequence = prompt
        let greedyCache = try context.model.newCache(parameters: parameters)
        var logits = context.model(MLXArray(sequence)[.newAxis], cache: greedyCache)
        for _ in 0 ..< 32 {
          let next = argMax(logits[0, -1], axis: -1).item(Int.self)
          sequence.append(next)
          logits = context.model(MLXArray([next])[.newAxis], cache: greedyCache)
        }
        let scored = (prompt.count - 1) ..< (sequence.count - 1)
        // Where the engine's idle-time prefill after the previous reply stops: the tokens shared by the history
        // rendered with two different next messages.
        var renderings: [[Int]] = []
        for placeholder in ["?", "Ok."] {
          renderings.append(try await context.processor.prepare(
            input: UserInput(chat: chat.dropLast() + [.user(placeholder)], additionalContext: ["enable_thinking": false])
          ).text.tokens.flattened().asArray(Int.self))
        }
        let followUp = zip(renderings[0], renderings[1]).prefix(while: { $0 == $1 }).count
        let followUpPoint = prompt.starts(with: renderings[0][..<followUp]) ? max(followUp, reusePoint) : reusePoint
        // Each split is a cache copied and resumed, as the engine does at every snapshot it restores.
        func logProbs(splits: [Int]) throws -> MLXArray {
          var cache = try context.model.newCache(parameters: parameters)
          var position = 0
          for split in splits {
            while position < split {
              let end = min(split, position + 512)
              _ = context.model(MLXArray(Array(sequence[position ..< end]))[.newAxis], cache: cache)
              eval(cache.flatMap(\.state))
              position = end
            }
            cache = cache.map { $0.copy() }
          }
          let split = position
          let all = context.model(MLXArray(Array(sequence[split...]))[.newAxis], cache: cache)
          let scaled = all[0, (scored.lowerBound - split) ..< (scored.upperBound - split)].asType(.float32) / 0.7
          return scaled - logSumExp(scaled, axis: -1, keepDims: true)
        }
        let cold = try logProbs(splits: [0])
        let reused = try logProbs(splits: [reusePoint, followUpPoint])
        let control = try logProbs(splits: [prompt.count / 2])
        let klReuse = (exp(cold) * (cold - reused)).sum(axis: -1)
        let klControl = (exp(cold) * (cold - control)).sum(axis: -1)
        let same = (argMax(cold, axis: -1) .== argMax(reused, axis: -1)).asType(.int32)
        eval(klReuse, klControl, same)
        return (
          klReuse.asArray(Float.self).map(Double.init), klControl.asArray(Float.self).map(Double.init),
          Int(same.sum().item(Int32.self)), scored.count, LocalEngine.reuseBoundary(of: prompt, tokenizer: context.tokenizer)
        )
      }
      reuseKL.append(contentsOf: result.0)
      controlKL.append(contentsOf: result.1)
      agree += result.2
      positions += result.3
      previousBoundary = result.4
    }
    let meanReuse = reuseKL.reduce(0, +) / Double(max(reuseKL.count, 1))
    let meanControl = controlKL.reduce(0, +) / Double(max(controlKL.count, 1))
    let limit = max(1e-3, meanControl * 1.25)
    emit(String(format: "REUSE meanKL=%.2e control=%.2e limit=%.2e p99=%.2e top1=%.4f positions=%d %@", meanReuse,
      meanControl, limit, percentile(reuseKL, 0.99), Double(agree) / Double(max(positions, 1)), positions,
      meanReuse <= limit ? "PASS" : "FAIL"))
    if meanReuse > limit { exit(1) }

  case "samplerbench":
    // samplerbench <vocab>: what each step of MLX's top-p sampler costs on one row of logits.
    let vocab = Int(ref.name) ?? 248_320
    let logits = (MLXRandom.normal([1, vocab]) * 3).asType(.float32)
    eval(logits)
    let iterations = 300
    let logprobs = logSoftmax(logits)
    eval(logprobs)
    let sorted = argSort(logprobs, axis: -1)
    eval(sorted)
    func report(_ name: String, _ seconds: Double) { emit(String(format: "%-28@ %.3f ms", name as NSString, seconds * 1000)) }
    report("logSoftmax", timeIt(iterations) { logSoftmax(logits) })
    report("argSort full vocab", timeIt(iterations) { argSort(logprobs, axis: -1) })
    report("takeAlong + exp + cumsum", timeIt(iterations) { cumsum(exp(takeAlong(logprobs, sorted, axis: -1)), axis: -1) })
    report("categorical full vocab", timeIt(iterations) { categorical(logprobs * (1 / 0.7)) })
    report("argPartition top 2048", timeIt(iterations) { argPartition(-logprobs, kth: 2047, axis: -1)[0..., ..<2048] })
    report("argMax (greedy)", timeIt(iterations) { argMax(logits, axis: -1) })
    let sampler = TopPSampler(temperature: 0.7, topP: 0.8)
    report("TopPSampler end to end", timeIt(iterations) { sampler.sample(logits: logits) })

  case "optimize":
    // optimize <full-precision model>: the app's install step on a copy (<tag>-opt), with its time and memory.
    let variant = try ModelReference("\(ref.name):\(ref.tag)-opt")
    let target = LocalModelStore.directory(for: variant)
    try? FileManager.default.removeItem(at: target)
    try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
    try FileManager.default.copyItem(at: LocalModelStore.directory(for: ref), to: target)
    Memory.peakMemory = 0
    let start = Date()
    let flashBytes = try InstallOptimizer.optimize(directory: target, isFullPrecision: true)
    let seconds = Date().timeIntervalSince(start)
    emit(String(format: "optimize %@: %.1f s, MLX peak %d MB, cache after %d MB, footprint %d MB, flash %d MB",
      variant.display, seconds, Memory.peakMemory >> 20, Memory.cacheMemory >> 20, AppMemory.footprint >> 20,
      Int(flashBytes >> 20)))

  case "firstturn":
    // firstturn <model> [prepare]: time to the first token of a process's first message, cold or after prepare().
    let prepareSeconds: Double
    if args.first == "prepare" {
      let start = Date()
      try await LocalEngine.shared.prepare(ref)
      prepareSeconds = Date().timeIntervalSince(start)
    } else {
      prepareSeconds = 0
    }
    let start = Date()
    var firstToken: Double?
    let stats = try await LocalEngine.shared.generate(
      ref, turns: [LocalTurn(role: "user", content: "Ciao! Spiegami in due frasi cos'è un buco nero.")], think: false,
      maxTokens: 32, temperatureOverride: 0
    ) { _ in if firstToken == nil { firstToken = Date().timeIntervalSince(start) } }
    emit(String(format: "FIRSTTURN %@ prepare=%.3fs load=%.3fs firstToken=%.3fs (from send)", ref.display, prepareSeconds,
      stats.loadSeconds, firstToken ?? 0))

  case "verify":
    // verify <model> [runs] [rehash]: time the per-session file check that runs before the first load; `rehash`
    // first re-records the digests in the current format.
    let runs = args.first.flatMap(Int.init) ?? 3
    if args.dropFirst().first == "rehash" { try LocalModelStore.recordFileHashes(in: LocalModelStore.directory(for: ref)) }
    var seconds: [Double] = []
    for _ in 0 ..< runs {
      let start = Date()
      try LocalModelStore.verifyFiles(of: ref)
      seconds.append(Date().timeIntervalSince(start))
    }
    emit(String(format: "verify %@: median %.3f s (%@)", ref.display, median(seconds), seconds.map { String(format: "%.3f", $0) }.joined(separator: ", ")))

  case "flashify":
    // flashify <model>: copy as <tag>-flash with the per-layer embedding table moved to flash (FlashEmbedding).
    let variant = try ModelReference("\(ref.name):\(ref.tag)-flash")
    let target = LocalModelStore.directory(for: variant)
    try? FileManager.default.removeItem(at: target)
    try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
    try FileManager.default.copyItem(at: LocalModelStore.directory(for: ref), to: target)
    let flashBytes = try FlashEmbeddings.prepare(in: target)
    try LocalModelStore.recordFileHashes(in: target)
    let marker = target.appending(path: "quock-installed.json")
    var installed = try JSONSerialization.jsonObject(with: Data(contentsOf: marker)) as? [String: Any] ?? [:]
    installed["reference"] = variant.display
    installed["residentBytes"] = ((installed["bytes"] as? Int) ?? 0) - Int(flashBytes)
    try JSONSerialization.data(withJSONObject: installed).write(to: marker, options: .atomic)
    emit("flashify \(variant.display): \(flashBytes >> 20) MB moved to flash")

  case "headbench":
    // Here the "model" argument is unused; vocab and hidden come next.
    let vocab = Int(ref.name) ?? 248_320
    let hidden = args.first.flatMap(Int.init) ?? 1024
    let weight = MLXRandom.normal([vocab, hidden]).asType(.bfloat16)
    let x = MLXRandom.normal([1, hidden]).asType(.bfloat16)
    eval(weight, x)
    let iterations = 300
    let bf16 = timeIt(iterations) { matmul(x, weight.T) }
    emit(String(format: "head %dx%d bf16: %.3f ms  %.1f GB/s", vocab, hidden, bf16 * 1000, Double(weight.nbytes) / bf16 / 1e9))
    for bits in [8, 6, 4] {
      let (w, scales, biases) = quantized(weight, groupSize: 64, bits: bits, mode: .affine)
      eval(w, scales)
      let bytes = w.nbytes + scales.nbytes + (biases?.nbytes ?? 0)
      let t = timeIt(iterations) {
        quantizedMatmul(x, w, scales: scales, biases: biases, transpose: true, groupSize: 64, bits: bits)
      }
      emit(String(format: "head %dx%d q%d g64: %.3f ms  %.1f GB/s  bytes %.0f MB  speedup x%.2f", vocab, hidden, bits, t * 1000, Double(bytes) / t / 1e9, Double(bytes) / 1048576, bf16 / t))
    }

  case "variant":
    let bits = args.first.flatMap(Int.init) ?? 8
    let group = args.dropFirst().first.flatMap(Int.init) ?? 64
    guard LocalModelStore.installed(ref) != nil else { throw NSError(domain: "bench", code: 3, userInfo: [NSLocalizedDescriptionKey: "pull \(ref.display) first"]) }
    let variant = try ModelReference("\(ref.namespace == "library" ? "" : ref.namespace + "/")\(ref.name):\(ref.tag)-h\(bits)g\(group)")
    let source = LocalModelStore.directory(for: ref)
    let target = LocalModelStore.directory(for: variant)
    try? FileManager.default.removeItem(at: target)
    try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
    try FileManager.default.copyItem(at: source, to: target)
    guard let outcome = try HeadQuantizer.quantizeEmbedding(in: target, bits: bits, groupSize: group) else {
      throw NSError(domain: "bench", code: 4, userInfo: [NSLocalizedDescriptionKey: "no BF16 embedding to quantize"])
    }
    try LocalModelStore.recordFileHashes(in: target)
    let marker = target.appending(path: "quock-installed.json")
    var installed = try JSONSerialization.jsonObject(with: Data(contentsOf: marker)) as? [String: Any] ?? [:]
    installed["reference"] = variant.display
    try JSONSerialization.data(withJSONObject: installed).write(to: marker, options: .atomic)
    emit("variant \(variant.display): \(outcome.modulePath) \(outcome.bytesBefore >> 20) MB -> \(outcome.bytesAfter >> 20) MB in \(outcome.file)")

  case "quality":
    guard let candidateName = args.first else { throw NSError(domain: "bench", code: 2) }
    let candidate = try ModelReference(candidateName)
    let tokens = args.dropFirst().first.flatMap(Int.init) ?? 128
    let temperature = args.dropFirst(2).first.flatMap(Float.init) ?? 0.7
    let promptCount = args.dropFirst(3).first.flatMap(Int.init) ?? qualityPrompts.count
    let quality = try await measureQuality(
      reference: ref, candidate: candidate, tokens: tokens, temperature: temperature, promptCount: promptCount)
    let result: [String: Any] = [
      "reference": ref.display, "candidate": candidate.display, "temperature": temperature,
      "positions": quality.positions, "meanKL": quality.meanKL, "p99KL": quality.p99KL, "maxKL": quality.maxKL,
      "top1Agreement": quality.top1,
    ]
    let json = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
    emit("QUALITY " + String(decoding: json, as: UTF8.self))

  case "suite":
    // suite <model> [reference]: functional answers, speed vs the stored baseline, quality vs the reference.
    // Appends one line to bench/results.jsonl and exits non-zero on any regression.
    let baselinesURL = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent()
    let benchDirectory = URL(fileURLWithPath: ProcessInfo.processInfo.environment["QUOCK_BENCH_DIR"] ?? baselinesURL.path)
    let baselines = (try? JSONSerialization.jsonObject(with: Data(contentsOf: benchDirectory.appending(path: "baselines.json")))
      as? [String: [String: Double]]) ?? [:]
    let baseline = baselines[ref.display] ?? [:]
    var failures: [String] = []
    let functional = try await runFunctional(ref)
    for (name, passed) in functional where !passed { failures.append("functional:\(name)") }
    let speed = try await measureSpeed(ref, tokens: 128, runs: 2)
    if let minimum = baseline["decodeTokPerSec"], speed.decodeMedian < minimum * 0.95 {
      failures.append(String(format: "speed %.0f < 95%% of %.0f", speed.decodeMedian, minimum))
    }
    if let maximum = baseline["peakMemoryMB"], Double(speed.peakMemoryMB) > maximum * 1.05 {
      failures.append("memory \(speed.peakMemoryMB) MB > 105% of \(Int(maximum))")
    }
    var record: [String: Any] = [
      "date": ISO8601DateFormatter().string(from: Date()),
      "commit": ProcessInfo.processInfo.environment["QUOCK_COMMIT"] ?? "unknown",
      "model": ref.display, "functional": functional, "decodeTokPerSec": speed.decodeMedian,
      "prefillTokPerSec": speed.prefillMedian, "peakMemoryMB": speed.peakMemoryMB,
    ]
    if let referenceName = args.first {
      let quality = try await measureQuality(
        reference: try ModelReference(referenceName), candidate: ref, tokens: 128, temperature: 0.7, promptCount: 12)
      record["reference"] = referenceName
      record["meanKL"] = quality.meanKL
      record["p99KL"] = quality.p99KL
      record["top1"] = quality.top1
      if let maximum = baseline["meanKL"], quality.meanKL > maximum * 1.25 + 0.0005 {
        failures.append(String(format: "meanKL %.4f > baseline %.4f", quality.meanKL, maximum))
      }
      if let minimum = baseline["top1"], quality.top1 < minimum - 0.01 {
        failures.append(String(format: "top1 %.3f < baseline %.3f", quality.top1, minimum))
      }
    }
    record["failures"] = failures
    record["passed"] = failures.isEmpty
    let line = try JSONSerialization.data(withJSONObject: record, options: [.sortedKeys])
    let results = benchDirectory.appending(path: "results.jsonl")
    if !FileManager.default.fileExists(atPath: results.path) { FileManager.default.createFile(atPath: results.path, contents: nil) }
    let handle = try FileHandle(forWritingTo: results)
    try handle.seekToEnd()
    try handle.write(contentsOf: line + Data("\n".utf8))
    try handle.close()
    emit("SUITE " + String(decoding: line, as: UTF8.self))
    if !failures.isEmpty { exit(1) }

  default:
    emit("unknown command \(command)")
    exit(2)
  }
}

do {
  try await run()
  exit(0)
} catch {
  emit("FAILED \(error.localizedDescription) | \(error)")
  exit(1)
}
