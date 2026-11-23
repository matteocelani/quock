import ExpoModulesCore
import Foundation
import Metal
import UIKit
import MLX

public class OnDeviceLLMModule: Module {
  private let jobs = JobRegistry()
  private var backgroundObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("OnDeviceLLM")

    Events("onPullProgress", "onGenerateEvent")

    // iOS refuses GPU work from a backgrounded app and the failure is fatal inside Metal, so a reply stops at the
    // last token it finished instead; the cloud path keeps streaming in the background, a local one cannot.
    OnCreate { [weak self] in
      if let self {
        self.backgroundObserver = NotificationCenter.default.addObserver(
          forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main
        ) { [jobs = self.jobs] _ in
          Task { await jobs.cancelAll() }
        }
      }
      #if DEBUG || QUOCK_SELFTEST
        if let index = ProcessInfo.processInfo.arguments.firstIndex(of: "-QuockLLMSelfTest") {
          let args = ProcessInfo.processInfo.arguments
          let model = args.count > index + 1 ? args[index + 1] : "qwen3.5:0.8b-mlx"
          Task.detached(priority: .userInitiated) { await SpikeSelfTest.run(model: model) }
        }
      #endif
    }

    Function("isSupported") { () -> Bool in
      // MLX needs a real Metal GPU; the simulator and very old devices have none it can use.
      #if targetEnvironment(simulator)
        return false
      #else
        return MTLCreateSystemDefaultDevice() != nil
      #endif
    }

    Function("listInstalled") { () -> [[String: Any]] in
      LocalModelStore.list().map {
        [
          "model": $0.reference, "bytes": $0.bytes, "installedAt": $0.installedAt.timeIntervalSince1970 * 1000,
          "capabilities": $0.capabilities ?? ["completion"],
        ]
      }
    }

    AsyncFunction("catalog") { (models: [String]) -> [[String: Any]] in
      try await OllamaCatalog.fetch(models: models).map(\.dictionary)
    }

    AsyncFunction("pull") { [weak self] (model: String) -> [String: Any] in
      let ref = try ModelReference(model)
      // Leaving the app mid-download keeps the transfer alive for the grace window iOS allows; past it, the next tap
      // resumes from the files already verified.
      let grace = await BackgroundGrace.begin(name: "quock.model-pull")
      defer { Task { @MainActor in grace.end() } }
      let installed = try await LocalModelStore.pull(ref) { completed, total in
        self?.sendEvent("onPullProgress", ["model": ref.display, "completed": completed, "total": total])
      }
      return ["model": installed.reference, "bytes": installed.bytes]
    }

    AsyncFunction("remove") { (model: String) in
      let ref = try ModelReference(model)
      await LocalEngine.shared.unload()
      try LocalModelStore.remove(ref)
    }

    AsyncFunction("unload") {
      await LocalEngine.shared.unload()
    }

    AsyncFunction("generate") {
      [weak self] (requestId: String, model: String, messages: [[String: String]], think: Bool?, maxTokens: Int)
        -> [String: Any] in
      guard let self else { return [:] }
      let ref = try ModelReference(model)
      let turns = messages.map { LocalTurn(role: $0["role"] ?? "user", content: $0["content"] ?? "") }
      let counter = EventCounter()
      let task = Task {
        try await LocalEngine.shared.generate(ref, turns: turns, think: think, maxTokens: maxTokens) {
          [weak self] event in
          counter.increment()
          switch event {
          case .content(let text):
            self?.sendEvent("onGenerateEvent", ["requestId": requestId, "kind": "content", "text": text])
          case .thinking(let text):
            self?.sendEvent("onGenerateEvent", ["requestId": requestId, "kind": "thinking", "text": text])
          }
        }
      }
      await self.jobs.add(requestId, task)
      defer { Task { await self.jobs.remove(requestId) } }
      var stats = try await task.value
      // Events and this promise reach JS on different paths; the count lets the caller wait for the stragglers.
      stats.events = counter.value
      return stats.dictionary
    }

    AsyncFunction("cancel") { [weak self] (requestId: String) in
      await self?.jobs.cancel(requestId)
    }
  }
}

private actor JobRegistry {
  private var tasks: [String: Task<LocalStats, Error>] = [:]

  func add(_ id: String, _ task: Task<LocalStats, Error>) { tasks[id] = task }
  func remove(_ id: String) { tasks[id] = nil }
  func cancel(_ id: String) { tasks.removeValue(forKey: id)?.cancel() }
  func cancelAll() {
    tasks.values.forEach { $0.cancel() }
    tasks.removeAll()
  }
}

private final class EventCounter: @unchecked Sendable {
  private let lock = NSLock()
  private var count = 0

  var value: Int { lock.withLock { count } }
  func increment() { lock.withLock { count += 1 } }
}

// A background task iOS lets expire without being ended gets the app killed, so expiry ends it too; the pull itself
// then fails on the dropped connection and resumes on the next tap.
@MainActor
private final class BackgroundGrace {
  private var id: UIBackgroundTaskIdentifier = .invalid

  static func begin(name: String) -> BackgroundGrace {
    let grace = BackgroundGrace()
    grace.id = UIApplication.shared.beginBackgroundTask(withName: name) { [weak grace] in grace?.end() }
    return grace
  }

  func end() {
    guard id != .invalid else { return }
    UIApplication.shared.endBackgroundTask(id)
    id = .invalid
  }
}
