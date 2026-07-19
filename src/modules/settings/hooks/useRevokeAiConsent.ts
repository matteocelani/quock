// Confirmation-gated AI-data revoke (wipe chats, sign out, clear consent), extracted from AiDataView so the
// destructive action never fires on a stray tap and the published dialog node keeps a stable identity.

import { useCallback, useMemo, useRef, useState } from "react";
import { useToast } from "@/lib/hooks/useToast";
import { useSettingsStore } from "@/lib/stores/settings.store";
import { useUIStore } from "@/lib/stores/ui.store";
import { useDeleteDeviceData } from "@/modules/chat/hooks/useDeviceStorage";
import { useSignOut } from "@/modules/auth/hooks/useAuth";

export interface UseRevokeAiConsentResult {
  isConfirmOpen: boolean;
  openConfirm: () => void;
  closeConfirm: () => void;
  // Dismiss the dialog, then wipe + sign out + clear consent + close the sheet.
  confirmRevoke: () => void;
}

export function useRevokeAiConsent(): UseRevokeAiConsentResult {
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const { clearDeviceData } = useDeleteDeviceData();
  const { signOut } = useSignOut();
  const revokeAiConsent = useSettingsStore((s) => s.revokeAiConsent);
  const closeAccount = useUIStore((s) => s.closeAccount);
  const toast = useToast();
  // clearDeviceData/signOut (react-query mutations) + toast get a fresh identity each render. Behind refs so
  // `confirmRevoke` stays stable and the dialog node published to AccountSheet doesn't loop the publish effect.
  const clearDeviceDataRef = useRef(clearDeviceData);
  const signOutRef = useRef(signOut);
  const revokeAiConsentRef = useRef(revokeAiConsent);
  const closeAccountRef = useRef(closeAccount);
  const toastRef = useRef(toast);
  clearDeviceDataRef.current = clearDeviceData;
  signOutRef.current = signOut;
  revokeAiConsentRef.current = revokeAiConsent;
  closeAccountRef.current = closeAccount;
  toastRef.current = toast;
  const openConfirm = useCallback((): void => {
    setIsConfirmOpen(true);
  }, []);
  const closeConfirm = useCallback((): void => {
    setIsConfirmOpen(false);
  }, []);
  // Wipe + sign out FIRST, then clear consent and close the sheet — a failed reset surfaces a toast instead of
  // silently leaving data behind while the consent gate implies the reset succeeded.
  const confirmRevoke = useCallback((): void => {
    setIsConfirmOpen(false);
    void (async (): Promise<void> => {
      try {
        await clearDeviceDataRef.current();
        await signOutRef.current();
      } catch (err) {
        console.warn("useRevokeAiConsent: revoke reset failed", err);
        toastRef.current({ title: "Could not complete the reset", tone: "error" });
        return;
      }
      revokeAiConsentRef.current();
      closeAccountRef.current();
    })();
  }, []);
  return useMemo<UseRevokeAiConsentResult>(
    () => ({ isConfirmOpen, openConfirm, closeConfirm, confirmRevoke }),
    [isConfirmOpen, openConfirm, closeConfirm, confirmRevoke],
  );
}
