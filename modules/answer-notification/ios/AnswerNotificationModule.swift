import ExpoModulesCore
import UserNotifications

private let chatIdKey = "chatId"

// Holds a tapped chat until JS takes it: a tap that cold-starts the app lands before any listener exists.
// Main-thread only, which is where the notification center delivers and where the module reads it.
enum AnswerNotificationTaps {
  static var pendingChatId: String?
  static var onTap: (() -> Void)?

  static func record(_ chatId: String) {
    pendingChatId = chatId
    onTap?()
  }
}

// Owns the notification-center delegate from launch, so a tap is caught even before the JS runtime starts.
public class AnswerNotificationAppDelegate: BaseExpoAppDelegateSubscriber, ExpoAppDelegateSubscriberProtocol,
  UNUserNotificationCenterDelegate
{
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    return true
  }

  // The user is already back in the app, where the answer is on screen: a banner over it would only repeat it.
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([])
  }

  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    if let chatId = response.notification.request.content.userInfo[chatIdKey] as? String {
      AnswerNotificationTaps.record(chatId)
    }
    completionHandler()
  }
}

public class AnswerNotificationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AnswerNotification")

    Events("onOpenChat")

    OnStartObserving {
      DispatchQueue.main.async { [weak self] in
        AnswerNotificationTaps.onTap = { self?.sendEvent("onOpenChat") }
      }
    }

    OnStopObserving {
      DispatchQueue.main.async { AnswerNotificationTaps.onTap = nil }
    }

    // Local notifications only: nothing registers with APNs, so the app carries no push entitlement.
    AsyncFunction("requestPermission") { () async throws -> Bool in
      try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
    }

    // Resolves once iOS has the request, so the caller can hold the background window open until then.
    AsyncFunction("post") { (body: String, chatId: String) async throws in
      let content = UNMutableNotificationContent()
      content.body = body
      content.sound = .default
      content.userInfo = [chatIdKey: chatId]
      // Keyed by chat, so a second answer in the same chat replaces its banner instead of stacking another.
      let request = UNNotificationRequest(identifier: "answer.\(chatId)", content: content, trigger: nil)
      try await UNUserNotificationCenter.current().add(request)
    }

    AsyncFunction("takeOpenedChatId") { () -> String? in
      let chatId = AnswerNotificationTaps.pendingChatId
      AnswerNotificationTaps.pendingChatId = nil
      return chatId
    }.runOnQueue(.main)
  }
}
