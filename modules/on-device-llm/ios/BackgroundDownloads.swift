import Foundation

// Model files download through a background URLSession: iOS's own transfer daemon keeps going while the phone is
// locked or the app is suspended, and finishes even after the app is closed. Gemma 4 is 8.9 GB, half an hour or more
// on a home connection; with an ordinary session the transfer stopped the moment the screen locked.
//
// Every file of a pull is queued at once (`start`), so the daemon keeps transferring while the app sleeps; the pull
// then collects them (`collect`) a few at a time for hashing. A file that finished while nobody was waiting, even in
// an earlier launch, waits in the staging folder under its digest.
final class BackgroundDownloads: NSObject, URLSessionDownloadDelegate, @unchecked Sendable {
  static let shared = BackgroundDownloads()
  static var identifier: String { (Bundle.main.bundleIdentifier ?? "quock") + ".model-downloads" }

  struct Request: Sendable {
    let key: String
    let url: URL
    let resumeData: Data?
  }

  private struct Waiter {
    let continuation: CheckedContinuation<URL, Error>
    let onWritten: @Sendable (Int64) -> Void
  }

  private let lock = NSLock()
  private var waiters: [String: Waiter] = [:]
  private var failures: [String: Error] = [:]
  private var progress: [String: Int64] = [:]
  // Files with a transfer in the daemon; read from it once per launch, then kept up to date here.
  private var active: Set<String> = []
  private var hasAdoptedEarlierTasks = false
  // Handed over by the app delegate when iOS relaunches the app for this session's events; called once they are in.
  private var systemCompletion: (() -> Void)?

  private(set) lazy var session: URLSession = {
    #if os(iOS)
      let configuration = URLSessionConfiguration.background(withIdentifier: Self.identifier)
      configuration.sessionSendsLaunchEvents = true
      configuration.isDiscretionary = false
    #else
      // The macOS benchmark is a command-line tool, which background sessions do not serve; the delegate path is the same.
      let configuration = URLSessionConfiguration.default
    #endif
    configuration.timeoutIntervalForResource = 7 * 24 * 3600
    return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
  }()

  static var stagingDirectory: URL { LocalModelStore.root.appending(path: ".staging", directoryHint: .isDirectory) }

  static func stagedFile(for key: String) -> URL {
    stagingDirectory.appending(path: key.replacingOccurrences(of: ":", with: "-"))
  }

  // Queues every request that is neither staged already nor transferring in the daemon (from this launch or one
  // before it). Cheap to call again for a single file.
  func start(_ requests: [Request]) async {
    try? FileManager.default.createDirectory(at: Self.stagingDirectory, withIntermediateDirectories: true)
    if !lock.withLock({ hasAdoptedEarlierTasks }) {
      let running = await session.allTasks.filter { $0.state == .running || $0.state == .suspended }
        .compactMap(\.taskDescription)
      lock.withLock {
        active.formUnion(running)
        hasAdoptedEarlierTasks = true
      }
    }
    for request in requests {
      let isNew = lock.withLock { active.insert(request.key).inserted }
      guard isNew else { continue }
      if FileManager.default.fileExists(atPath: Self.stagedFile(for: request.key).path) {
        lock.withLock { _ = active.remove(request.key) }
        continue
      }
      let task = request.resumeData.map { session.downloadTask(withResumeData: $0) }
        ?? session.downloadTask(with: request.url)
      task.taskDescription = request.key
      task.resume()
    }
  }

  // Waits for one queued file and hands back its staged copy; the caller moves it into place or deletes it.
  func collect(_ request: Request, onWritten: @escaping @Sendable (Int64) -> Void) async throws -> URL {
    let staged = Self.stagedFile(for: request.key)
    return try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { continuation in
        lock.lock()
        if FileManager.default.fileExists(atPath: staged.path) {
          lock.unlock()
          continuation.resume(returning: staged)
        } else if let failure = failures.removeValue(forKey: request.key) {
          lock.unlock()
          continuation.resume(throwing: failure)
        } else {
          waiters[request.key] = Waiter(continuation: continuation, onWritten: onWritten)
          let written = progress[request.key]
          lock.unlock()
          if let written { onWritten(written) }
        }
      }
    } onCancel: {
      session.getAllTasks { tasks in tasks.filter { $0.taskDescription == request.key }.forEach { $0.cancel() } }
    }
  }

  // Stops every transfer of the given files (a pull abandoned or a model removed) and drops what they staged.
  func cancel(keys: Set<String>) async {
    for task in await session.allTasks where task.taskDescription.map(keys.contains) == true { task.cancel() }
    for key in keys { try? FileManager.default.removeItem(at: Self.stagedFile(for: key)) }
  }

  func handleEvents(completion: @escaping () -> Void) {
    lock.withLock { systemCompletion = completion }
    _ = session
  }

  // MARK: URLSessionDownloadDelegate

  func urlSession(
    _ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64,
    totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64
  ) {
    guard let key = downloadTask.taskDescription else { return }
    let onWritten = lock.withLock { () -> ((Int64) -> Void)? in
      progress[key] = totalBytesWritten
      return waiters[key]?.onWritten
    }
    onWritten?(totalBytesWritten)
  }

  // The file must leave the system's location before this returns, so it is staged here, under its digest.
  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
    guard let key = downloadTask.taskDescription else { return }
    let status = (downloadTask.response as? HTTPURLResponse)?.statusCode ?? 0
    guard status == 200 || status == 206 else {
      finish(key, with: .failure(OllamaRegistryError.http(status, key)))
      return
    }
    let staged = Self.stagedFile(for: key)
    do {
      try? FileManager.default.removeItem(at: staged)
      try FileManager.default.moveItem(at: location, to: staged)
      finish(key, with: .success(staged))
    } catch {
      finish(key, with: .failure(error))
    }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    guard let error, let key = task.taskDescription else { return }
    finish(key, with: .failure(error))
  }

  func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    let completion = lock.withLock { () -> (() -> Void)? in
      defer { systemCompletion = nil }
      return systemCompletion
    }
    DispatchQueue.main.async { completion?() }
  }

  private func finish(_ key: String, with result: Result<URL, Error>) {
    lock.lock()
    progress[key] = nil
    active.remove(key)
    let waiter = waiters.removeValue(forKey: key)
    if waiter == nil, case .failure(let error) = result { failures[key] = error }
    lock.unlock()
    switch result {
    case .success(let url): waiter?.continuation.resume(returning: url)
    case .failure(let error): waiter?.continuation.resume(throwing: error)
    }
  }
}
