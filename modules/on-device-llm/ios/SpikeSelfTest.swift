import Foundation
import MLX
import os

// Spike-only harness: launched with `-QuockLLMSelfTest <model>`, it pulls, loads and runs the model with no UI and
// logs to stderr, which `devicectl ... --console` streams back to the Mac. Removed before the feature ships.
enum SpikeSelfTest {
  static func log(_ message: String) {
    FileHandle.standardError.write(Data("[LLMSPIKE] \(message)\n".utf8))
  }

  static func run(model: String) async {
    do {
      log("start model=\(model) available=\(os_proc_available_memory() >> 20)MB")
      let ref = try ModelReference(model)
      let pullStart = Date()
      let decile = SpikeBox<Int>(-1)
      let installed = try await LocalModelStore.pull(ref) { completed, total in
        let current = total > 0 ? Int(completed * 10 / total) : 0
        if decile.swap(current) != current {
          log("pull \(completed >> 20)/\(total >> 20) MB")
        }
      }
      log("pulled \(installed.bytes >> 20) MB in \(String(format: "%.1f", Date().timeIntervalSince(pullStart)))s")

      let prompts: [(String, Bool)] = [
        ("Ciao! Spiegami in due frasi cos'è un buco nero.", false),
        ("Quanto fa 17 * 23? Rispondi solo con il numero.", true),
      ]
      for (prompt, think) in prompts {
        let answer = SpikeBox<String>("")
        let reasoning = SpikeBox<String>("")
        let stats = try await LocalEngine.shared.generate(
          ref, turns: [LocalTurn(role: "user", content: prompt)], think: think, maxTokens: 400
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
      log("DONE")
    } catch {
      log("FAILED: \(error.localizedDescription) | \(error)")
    }
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
