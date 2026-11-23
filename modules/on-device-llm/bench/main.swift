import Foundation
import MLX
import MLXLLM
import MLXLMCommon

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
      if decile != lastDecile {
        lastDecile = decile
        emit("pull \(completed >> 20)/\(total >> 20) MB")
      }
    }
    emit("pulled \(installed.reference) \(installed.bytes >> 20) MB in \(String(format: "%.1f", Date().timeIntervalSince(start)))s")

  case "speed":
    let tokens = args.first.flatMap(Int.init) ?? 256
    let runs = args.dropFirst().first.flatMap(Int.init) ?? 3
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
          temperatureOverride: 0
        ) { _ in }
        if stats.generateSeconds > 0 { decode.append(Double(stats.generatedTokens) / stats.generateSeconds) }
        if stats.promptSeconds > 0 { prefill.append(Double(stats.promptTokens) / stats.promptSeconds) }
        peak = max(peak, stats.peakMemoryBytes)
      }
    }
    let result: [String: Any] = [
      "model": ref.display, "samples": decode.count,
      "decodeTokPerSecMedian": median(decode), "decodeTokPerSecMin": decode.min() ?? 0,
      "decodeTokPerSecMax": decode.max() ?? 0, "prefillTokPerSecMedian": median(prefill),
      "peakMemoryMB": peak >> 20,
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
        in: target, bits: LocalModelStore.headBits, groupSize: LocalModelStore.headGroupSize)
    }
    try LocalModelStore.recordFileHashes(in: target)
    let marker = target.appending(path: "quock-installed.json")
    var installed = try JSONSerialization.jsonObject(with: Data(contentsOf: marker)) as? [String: Any] ?? [:]
    installed["reference"] = variant.display
    try JSONSerialization.data(withJSONObject: installed).write(to: marker, options: .atomic)
    emit("body \(variant.display): \(outcome.tensors) tensors \(outcome.bytesBefore >> 20) MB -> \(outcome.bytesAfter >> 20) MB sensitive=\(sensitive)")

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
    let reference = try await loadModelContainer(from: LocalModelStore.directory(for: ref), using: TransformersTokenizerLoader())
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
    let mean = kls.reduce(0, +) / Double(max(kls.count, 1))
    let result: [String: Any] = [
      "reference": ref.display, "candidate": candidate.display, "temperature": temperature,
      "positions": positions, "meanKL": mean, "p99KL": percentile(kls, 0.99), "maxKL": kls.max() ?? 0,
      "top1Agreement": Double(agree) / Double(max(positions, 1)),
    ]
    let json = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
    emit("QUALITY " + String(decoding: json, as: UTF8.self))

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
