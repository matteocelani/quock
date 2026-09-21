import ExpoModulesCore
import UIKit

// iOS suspends a backgrounded app within seconds, and a suspended process cannot drain the socket an answer is still
// arriving on. This is the assertion Apple provides for finishing work the user started; it needs no entitlement and
// no background mode, and it buys a grace window rather than unlimited time.
public class BackgroundAssertionModule: Module {
  private var taskId: UIBackgroundTaskIdentifier = .invalid
  // Streams can overlap (an edit restarts one while the old is still unwinding), so the assertion is refcounted:
  // the last release ends it, never the first.
  private var holders = 0

  public func definition() -> ModuleDefinition {
    Name("BackgroundAssertion")

    // Fire-and-forget from JS. UIApplication is main-thread only, and hopping there also serialises the refcount.
    Function("hold") { [weak self] in
      DispatchQueue.main.async { self?.beginIfNeeded() }
    }

    Function("release") { [weak self] in
      DispatchQueue.main.async { self?.releaseOne() }
    }
  }

  // Taken while still in the foreground, as Apple asks — by the time an app is told it is backgrounding it has
  // seconds left, which is too late to start asking.
  private func beginIfNeeded() {
    holders += 1
    guard taskId == .invalid else { return }
    taskId = UIApplication.shared.beginBackgroundTask(withName: "quock.stream") { [weak self] in
      // iOS is about to reclaim the time. Ending the task here is mandatory: an assertion left open past its expiry
      // gets the app killed, and a kill loses the partial answer the pipeline has already flushed to SQLite.
      self?.endTask()
    }
  }

  private func releaseOne() {
    holders = max(0, holders - 1)
    guard holders == 0 else { return }
    endTask()
  }

  private func endTask() {
    guard taskId != .invalid else { return }
    UIApplication.shared.endBackgroundTask(taskId)
    taskId = .invalid
    holders = 0
  }
}
