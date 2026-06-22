// No-op mock of `expo-haptics`. Haptic feedback requires native bindings
// (`UIImpactFeedbackGenerator` on iOS, `Vibrator` on Android) that are not
// available under the Jest / Node runtime. We expose the same async surface
// the app uses so production code can call it without any conditional guard.

export async function impactAsync(_style?: ImpactFeedbackStyle): Promise<void> {
  // Intentionally empty: haptics are observable side-effects only and do not
  // affect any state the test would assert on.
}

export async function notificationAsync(
  _type?: NotificationFeedbackType,
): Promise<void> {
  // Intentionally empty.
}

export async function selectionAsync(): Promise<void> {
  // Intentionally empty.
}

export enum ImpactFeedbackStyle {
  Light = "light",
  Medium = "medium",
  Heavy = "heavy",
}

export enum NotificationFeedbackType {
  Success = "success",
  Warning = "warning",
  Error = "error",
}
