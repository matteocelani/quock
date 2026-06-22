// Compose a hex color token with an opacity into an 8-digit hex (#RRGGBBAA). Keeps alpha out of inline strings: callers pass an opacity token, never a raw hex suffix.

// 8-bit channel maximum for the alpha byte.
const HEX_CHANNEL_MAX = 255;

export function withAlpha(hexColor: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const channel = Math.round(clamped * HEX_CHANNEL_MAX)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${hexColor}${channel}`;
}
