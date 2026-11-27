// Tablet and desktop layout switch: from this window width up (an iPad in portrait is 744pt, a Mac window starts
// wherever the user drags it) the chats list stays beside the conversation instead of sliding over it.

import { useWindowDimensions } from "react-native";

export const WIDE_LAYOUT_MIN_WIDTH = 744;
// The chats column beside the conversation.
export const SIDEBAR_WIDTH = 340;
// A reading column: lines past this get hard to follow, and a Mac window can be several times wider.
export const CONTENT_MAX_WIDTH = 820;
// Full-screen forms (consent, sign-in) read like a card, not a banner, on a wide display.
export const FORM_MAX_WIDTH = 520;
// Bottom sheets keep a phone-card proportion instead of stretching across the whole display.
export const SHEET_MAX_WIDTH = 640;

export function useWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return width >= WIDE_LAYOUT_MIN_WIDTH;
}
