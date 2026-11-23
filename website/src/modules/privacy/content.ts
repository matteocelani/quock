import type { ComponentType, SVGProps } from "react";
import { EyeOffIcon, GlobeIcon, KeyIcon, LockIcon, MemoryIcon, PhoneIcon } from "@/components/ui/icons";

interface Principle {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: string;
}

export const PRIVACY_UPDATED = "2026-11-24";

export const PRIVACY_LEAD =
  "Quock is built so your conversations stay yours: they live on your iPhone and go only where you send them.";

// A plain-language digest of docs/PRIVACY.md; the policy itself stays the controlling text.
export const PRINCIPLES: readonly Principle[] = [
  {
    icon: PhoneIcon,
    title: "Your chats live on your iPhone.",
    body: "Conversations are kept in a local database on your phone. The author runs no backend that receives, stores or processes your data.",
  },
  {
    icon: GlobeIcon,
    title: "Messages go straight to Ollama Cloud.",
    body: "Each message travels with the earlier turns of that chat, directly to Ollama Cloud over HTTPS. Ollama, Inc. handles it under its own privacy policy.",
  },
  {
    icon: KeyIcon,
    title: "Signed, without a password.",
    body: "Quock creates a key pair on your phone and signs every request with it. The secret stays in the iOS Keychain and is never sent anywhere.",
  },
  {
    icon: MemoryIcon,
    title: "Memory you control.",
    body: "Memory is on by default. Remembered facts are stored on your phone and travel with every message while it is on. Turn it off any time, or revoke consent to delete them all.",
  },
  {
    icon: EyeOffIcon,
    title: "Private by default.",
    body: "No analytics, no advertising identifiers, no crash reporters, no profiling. This website sets no cookies and loads no trackers.",
  },
  {
    icon: LockIcon,
    title: "Clear it any time.",
    body: "Clear all chats from Settings whenever you like. Signing out or clearing chats keeps memory; revoking consent deletes it.",
  },
];

export const PRIVACY_NOTE =
  "This page is a summary. The full privacy policy is the controlling text, covering legal bases, retention and your rights under GDPR and similar laws.";

export const PRIVACY_LINKS = {
  ollama: "Ollama's privacy policy",
  full: "Read the full policy",
} as const;
