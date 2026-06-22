// Motion helpers wired to the design spring + base timing. Use these — never call Easing.bezier(spring[0]…) directly.

import { Easing, type WithSpringConfig } from "react-native-reanimated";
import { spring, timings } from "@/lib/design/tokens";

// Pre-built Easing function based on the Apple-style cubic-bezier.
export const springEasing = Easing.bezier(
  spring[0],
  spring[1],
  spring[2],
  spring[3],
);

// Default duration for show/hide animations (matches lib.jsx 180ms).
export const baseAnimationDurationMs = timings.base;

// Snappy press spring tuned to CASpringAnimation defaults — fast settle, no bounce.
export const pressSpring: WithSpringConfig = {
  damping: 22,
  stiffness: 320,
  mass: 0.35,
  overshootClamping: false,
};

// Toggle spring lets the thumb/indicator briefly overshoot before settling — iOS UISwitch feel.
export const toggleSpring: WithSpringConfig = {
  damping: 16,
  stiffness: 240,
  mass: 0.45,
};

// Sheet/Toast entrance spring — moderate settle so content doesn't bounce visibly.
export const surfaceSpring: WithSpringConfig = {
  damping: 22,
  stiffness: 220,
  mass: 0.6,
};

// Sheet drag-back spring — softer than surfaceSpring so the finger-release snap-back feels weighty.
export const sheetSpring: WithSpringConfig = {
  damping: 18,
  stiffness: 200,
  mass: 0.55,
};
