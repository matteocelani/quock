import ExpoModulesCore
import UIKit

// iOS relaunches the app in the background when model downloads it was running finish while it was closed; the
// session must be recreated and its completion handler called once the events are delivered.
public class OnDeviceLLMAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication, handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    guard identifier == BackgroundDownloads.identifier else { return }
    BackgroundDownloads.shared.handleEvents(completion: completionHandler)
  }
}
