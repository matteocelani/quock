import Foundation
import MLX
#if canImport(UIKit)
  import UIKit
#endif

// iOS forbids GPU work from a backgrounded app and Metal reports it as a fatal error, so MLX only runs while the app
// is active. Resigning active (lock button, app switcher, Control Center) comes before backgrounding, which leaves
// time to stop between two tokens instead of inside one.
final class ForegroundGate: @unchecked Sendable {
  static let shared = ForegroundGate()

  private let lock = NSLock()
  private var isActiveValue = false
  private var observers: [NSObjectProtocol] = []

  var isActive: Bool { lock.withLock { isActiveValue } }

  @MainActor
  func start() {
    #if !canImport(UIKit)
      // The macOS benchmark host has no app lifecycle to gate on.
      set(true)
      return
    #else
    guard observers.isEmpty else { return }
    set(UIApplication.shared.applicationState == .active)
    let center = NotificationCenter.default
    observers = [
      center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) {
        [weak self] _ in self?.set(true)
      },
      center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) {
        [weak self] _ in self?.set(false)
      },
    ]
    #endif
  }

  private func set(_ value: Bool) {
    lock.withLock { isActiveValue = value }
  }
}

// MLX's default answer to any backend error is fatalError, which turns a GPU refusal into a crash. This handler records
// the failure instead; generation checks it after every token and stops with an error the chat can show.
enum MLXFailure {
  private static let lock = NSLock()
  nonisolated(unsafe) private static var message: String?

  static func install() {
    setErrorHandler({ cMessage, _ in
      MLXFailure.record(cMessage.map { String(cString: $0) } ?? "MLX error")
    })
  }

  static func record(_ text: String) {
    lock.withLock { message = text }
    FileHandle.standardError.write(Data("[OnDeviceLLM] MLX error: \(text)\n".utf8))
  }

  // Returns and clears the last failure, so one bad generation does not poison the next.
  static func take() -> String? {
    lock.withLock {
      defer { message = nil }
      return message
    }
  }
}
