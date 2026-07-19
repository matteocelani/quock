// Orchestrates the About view's logic: external legal/support links (toast on failure) + the app version label.
// Extracted from SettingsView so About's concerns stay separate from Settings' and the view stays lean.

import * as Application from "expo-application";
import * as WebBrowser from "expo-web-browser";
import { useCallback } from "react";
import { LEGAL_URLS } from "@/lib/api/config";
import { useToast } from "@/lib/hooks/useToast";

export interface UseAboutResult {
  openPrivacy: () => void;
  openTerms: () => void;
  openSupport: () => void;
  versionLabel: string;
}

export function useAbout(): UseAboutResult {
  const toast = useToast();
  const openExternal = useCallback(
    (url: string, label: string): void => {
      WebBrowser.openBrowserAsync(url).catch((err: unknown) => {
        console.warn(`useAbout: failed to open ${label}`, err);
        toast({ title: "Could not open link", tone: "error" });
      });
    },
    [toast],
  );
  const openPrivacy = useCallback((): void => {
    openExternal(LEGAL_URLS.privacy, "privacy");
  }, [openExternal]);
  const openTerms = useCallback((): void => {
    openExternal(LEGAL_URLS.terms, "terms");
  }, [openExternal]);
  const openSupport = useCallback((): void => {
    openExternal(LEGAL_URLS.support, "support");
  }, [openExternal]);
  const versionLabel = `v${Application.nativeApplicationVersion ?? "?"} (build ${Application.nativeBuildVersion ?? "?"})`;
  return { openPrivacy, openTerms, openSupport, versionLabel };
}
