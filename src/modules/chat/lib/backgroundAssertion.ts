// Asks iOS not to suspend the app while an answer is still streaming. Optional on purpose: the module ships for Apple
// only, and Android neither needs it (the activity stops without the process being frozen) nor provides it.

import { requireOptionalNativeModule } from "expo";

interface BackgroundAssertionModule {
  hold: () => void;
  release: () => void;
}

const native =
  requireOptionalNativeModule<BackgroundAssertionModule>("BackgroundAssertion");

/** Keeps the process running after the app backgrounds. Refcounted natively, so overlapping streams are safe. */
export function holdBackgroundAssertion(): void {
  native?.hold();
}

/** Releases this stream's claim. The assertion ends when the last holder lets go. */
export function releaseBackgroundAssertion(): void {
  native?.release();
}
