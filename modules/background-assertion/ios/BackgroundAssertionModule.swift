import ExpoModulesCore
import UIKit

// A suspended process cannot drain the socket an answer is still arriving on. This is the assertion Apple provides
// for finishing work the user started: no entitlement, no background mode, and a grace window rather than free rein.
public class BackgroundAssertionModule: Module {
  private var taskId: UIBackgroundTaskIdentifier = .invalid
  // Streams overlap — an edit restarts one while the old is still unwinding — so the assertion is refcounted: the
  // last release ends it, never the first.
  private var holders = 0
  // Claims left over from a window iOS already reclaimed. Their release must not close one a newer stream opened.
  private var staleHolders = 0

  public func definition() -> ModuleDefinition {
    Name("BackgroundAssertion")

    // Fire-and-forget from JS. UIApplication is main-thread only, and the hop also serialises the refcount.
    Function("hold") { [weak self] in
      DispatchQueue.main.async { self?.beginIfNeeded() }
    }

    Function("release") { [weak self] in
      DispatchQueue.main.async { self?.releaseOne() }
    }

    // A JS runtime teardown deallocates this module; an assertion outliving it is charged to a process with nobody
    // left to end it, and iOS kills an app that lets one expire.
    OnDestroy {
      DispatchQueue.main.async { [weak self] in self?.endTask() }
    }
  }

  // Taken while still in the foreground, as Apple asks. It costs nothing there: the grace clock starts at
  // backgrounding, not here, and by the time an app is told it is leaving it has seconds left.
  private func beginIfNeeded() {
    holders += 1
    guard taskId == .invalid else { return }
    var id: UIBackgroundTaskIdentifier = .invalid
    id = UIApplication.shared.beginBackgroundTask(withName: "quock.stream") { [weak self] in
      // Captured by value so the contract is honoured even once the module is gone.
      guard let self else {
        UIApplication.shared.endBackgroundTask(id)
        return
      }
      self.endTask()
    }
    taskId = id
  }

  private func releaseOne() {
    // A straggler from before an expiry: swallow it rather than close a window it never opened.
    if staleHolders > 0 {
      staleHolders -= 1
      return
    }
    holders = max(0, holders - 1)
    guard holders == 0 else { return }
    endTask()
  }

  private func endTask() {
    guard taskId != .invalid else { return }
    UIApplication.shared.endBackgroundTask(taskId)
    taskId = .invalid
    // Whoever still believes they hold a claim is now stale: remembering how many keeps their release from ending
    // the next stream's window.
    staleHolders = holders
    holders = 0
  }
}
