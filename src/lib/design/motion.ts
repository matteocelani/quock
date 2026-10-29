// Motion helpers wired to the design spring + base timing. Use these — never call Easing.bezier(spring[0]…) directly.

import {
  Easing,
  LinearTransition,
  type WithSpringConfig,
} from "react-native-reanimated";
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

// Decelerating curve (easeOutQuint): leaves fast, lands soft. For TAP-driven travel; a finger release keeps a spring,
// because a gesture that ends in a fixed curve feels detached from the hand.
export const decelerateEasing = Easing.bezier(0.22, 1, 0.36, 1);

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

const SURFACE_SPRING = { damping: 22, stiffness: 220, mass: 0.6 } as const;
// Sheet/Toast entrance spring — moderate settle so content doesn't bounce visibly.
export const surfaceSpring: WithSpringConfig = SURFACE_SPRING;
// A list row changing place (pinned to the top, or back) settles on the same spring a surface enters with.
export const surfaceLayoutTransition = LinearTransition.springify()
  .damping(SURFACE_SPRING.damping)
  .stiffness(SURFACE_SPRING.stiffness)
  .mass(SURFACE_SPRING.mass);

// Sheet drag-back spring — softer than surfaceSpring so the finger-release snap-back feels weighty.
export const sheetSpring: WithSpringConfig = {
  damping: 18,
  stiffness: 200,
  mass: 0.55,
};
