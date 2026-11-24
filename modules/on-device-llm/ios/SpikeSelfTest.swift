#if DEBUG || QUOCK_SELFTEST
import Foundation
import MLX
import os

// Device harness: launched with `-QuockLLMSelfTest <model>`, it pulls, loads and runs the model with no UI and logs to
// stderr, which `devicectl ... --console` streams back to the Mac. Compiled only into Debug or QUOCK_SELFTEST builds.
enum SpikeSelfTest {
  static func log(_ message: String) {
    FileHandle.standardError.write(Data("[LLMSPIKE] \(message)\n".utf8))
  }

  static func run(model: String) async {
    do {
      log("start model=\(model) available=\(AppMemory.available >> 20)MB footprint=\(AppMemory.footprint >> 20)MB")
      let ref = try ModelReference(model)
      if LocalModelStore.installed(ref) != nil {
        do {
          try LocalModelStore.verifyFiles(of: ref)
          log("installed copy verified")
        } catch {
          log("installed copy failed verification (\(error.localizedDescription)); removing and pulling again")
          try LocalModelStore.remove(ref)
        }
      }
      let pullStart = Date()
      let decile = SpikeBox<Int>(-1)
      let installed = try await LocalModelStore.pull(ref) { completed, total in
        let current = total > 0 ? Int(completed * 10 / total) : 0
        if decile.swap(current) != current {
          log("pull \(completed >> 20)/\(total >> 20) MB")
        }
      }
      log("installed on disk \(installed.bytes >> 20) MB resident \((installed.residentBytes ?? installed.bytes) >> 20) MB in \(String(format: "%.1f", Date().timeIntervalSince(pullStart)))s available=\(AppMemory.available >> 20)MB footprint=\(AppMemory.footprint >> 20)MB mlxActive=\(Memory.activeMemory >> 20)MB mlxCache=\(Memory.cacheMemory >> 20)MB")

      // Launched from the Mac, the app may still be inactive; generation refuses until it is in the foreground.
      for _ in 0 ..< 120 where !ForegroundGate.shared.isActive {
        try await Task.sleep(nanoseconds: 500_000_000)
      }
      log("foreground=\(ForegroundGate.shared.isActive)")
      let prompts: [(String, Bool)] = [
        ("Ciao! Spiegami in due frasi cos'è un buco nero.", false),
        ("Quanto fa 17 * 23? Rispondi solo con il numero.", true),
        // Long on purpose: the Mac backgrounds the app while this one streams, to prove it stops instead of crashing.
        ("Scrivi un racconto di almeno 800 parole su un faro in Sardegna.", false),
      ]
      for (index, (prompt, think)) in prompts.enumerated() {
        log("generating #\(index + 1)")
        let answer = SpikeBox<String>("")
        let reasoning = SpikeBox<String>("")
        let stats = try await LocalEngine.shared.generate(
          ref, turns: [LocalTurn(role: "user", content: prompt)], think: think, maxTokens: 1500
        ) { event in
          switch event {
          case .content(let text): answer.append(text)
          case .thinking(let text): reasoning.append(text)
          }
        }
        log("prompt(think=\(think)): \(prompt)")
        if !reasoning.value.isEmpty { log("thinking: \(reasoning.value.prefix(600))") }
        log("answer: \(answer.value)")
        log("stats: \(stats.dictionary) available=\(os_proc_available_memory() >> 20)MB")
      }

      // Three turns of one chat, the way the app sends them: turns 2 and 3 should restore the previous prompt cache.
      var history: [LocalTurn] = []
      for (index, message) in ["Mi consigli un libro di fantascienza?", "Perché proprio quello?", "Riassumi in una frase."]
        .enumerated()
      {
        history.append(LocalTurn(role: "user", content: message))
        let answer = SpikeBox<String>("")
        let stats = try await LocalEngine.shared.generate(ref, turns: history, think: false, maxTokens: 120) { event in
          if case .content(let text) = event { answer.append(text) }
        }
        history.append(LocalTurn(role: "assistant", content: answer.value))
        log(String(
          format: "chat turn %d prompt=%d prefilled=%d reused=%d ttft=%.3fs tok/s=%.1f", index + 1, stats.promptTokens,
          stats.prefilledTokens, stats.reusedTokens, stats.firstTokenSeconds,
          stats.generateSeconds > 0 ? Double(stats.generatedTokens) / stats.generateSeconds : 0))
      }

      // A chat's first message, from send to first token: cold, then after prepare() as the app does on opening a chat.
      for prepared in [false, true] {
        await LocalEngine.shared.unload()
        let prepareStart = Date()
        if prepared { try await LocalEngine.shared.prepare(ref) }
        let prepareSeconds = Date().timeIntervalSince(prepareStart)
        let sent = Date()
        let firstToken = SpikeBox<Double>(0)
        _ = try await LocalEngine.shared.generate(
          ref, turns: [LocalTurn(role: "user", content: "Ciao! Come stai?")], think: false, maxTokens: 16
        ) { _ in if firstToken.value == 0 { _ = firstToken.swap(Date().timeIntervalSince(sent)) } }
        log(String(
          format: "first message prepared=%@ prepare=%.3fs send-to-first-token=%.3fs", prepared ? "yes" : "no",
          prepareSeconds, firstToken.value))
      }
      log("DONE")
      if ProcessInfo.processInfo.arguments.contains("-QuockLLMCleanup") {
        await LocalEngine.shared.unload()
        try? LocalModelStore.remove(ref)
        log("removed \(model) after the test")
      }
    } catch {
      // A model refused for memory would otherwise keep several GB on the test phone for nothing.
      if case LocalEngineError.insufficientMemory = error, let ref = try? ModelReference(model) {
        try? LocalModelStore.remove(ref)
        log("removed \(model) after the memory refusal")
      }
      log("FAILED: \(error.localizedDescription) | \(error) | available=\(AppMemory.available >> 20)MB footprint=\(AppMemory.footprint >> 20)MB")
    }
    // Ends the process so `devicectl --console` returns; only ever reached under the self-test launch argument.
    exit(0)
  }
}

private final class SpikeBox<T>: @unchecked Sendable {
  private let lock = NSLock()
  private var stored: T

  init(_ value: T) { stored = value }

  var value: T { lock.withLock { stored } }

  func swap(_ value: T) -> T {
    lock.withLock {
      let old = stored
      stored = value
      return old
    }
  }
}

extension SpikeBox where T == String {
  func append(_ text: String) { lock.withLock { stored += text } }
}
#endif
