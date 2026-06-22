// `useAuth` is a read-only accessor for the AuthContext. `useSignIn` runs the connect-URL handshake: load the device keypair, build the `${baseURL}/connect?name&key&launch=true` URL, hand off to Safari, and on close re-probe `/api/me` to discover whether the server bound the key. `useSignOut` clears the session.

import * as AuthSession from "expo-auth-session";
import * as Application from "expo-application";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { Platform } from "react-native";
import { User } from "@/gotypes";
import { CLOUD_BASE_URL } from "@/lib/api/config";
import { fetchCurrentUser } from "@/modules/auth/api/auth";
import { buildConnectUrl } from "@/modules/auth/lib/connect";
import { BIND_POLL_INTERVAL_MS } from "@/modules/auth/constants";
import { loadOrCreateKeypair } from "@/modules/auth/lib/keypair";
import { useApi } from "@/lib/contexts/ApiContext";
import { useAuthContext } from "@/modules/auth/context/AuthContext";

// Native deep-link path; AuthSession resolves it to the platform scheme from app.json.
const REDIRECT_PATH = "auth/callback";
// Hard ceiling on how long we treat the browser session as "in flight" — beyond this we still re-probe `/api/me` because some Android Custom Tabs fail to emit a close event.
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;
export interface UseAuthResult {
  user: User | null;
  status: "checking" | "authenticated" | "unauthenticated";
  isAuthenticated: boolean;
}

export function useAuth(): UseAuthResult {
  const { user, status } = useAuthContext();
  return React.useMemo<UseAuthResult>(
    () => ({
      user,
      status,
      isAuthenticated: status === "authenticated",
    }),
    [user, status],
  );
}

export interface UseSignInResult {
  signIn: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}
// Without warming the in-app browser the first AuthSession call has a visible Android delay.
let hasWarmedUp = false;
function warmUpBrowser(): void {
  if (hasWarmedUp) return;
  hasWarmedUp = true;
  WebBrowser.warmUpAsync().catch((err: unknown) => {
    console.warn("WebBrowser warmup failed:", err);
  });
}
// Builds a short, ASCII-only device label. The server stores this verbatim so users see it in their account settings; we keep punctuation minimal.
function buildDeviceName(): string {
  const platform = Platform.OS === "ios" ? "iOS" : "Android";
  const appVersion =
    Application.nativeApplicationVersion ?? Application.applicationName ?? "";
  const suffix = appVersion ? ` ${appVersion}` : "";
  // ASCII-only to dodge any server-side URL parsing quirks with multibyte names.
  return `Quock (${platform})${suffix}`.replace(/[^\x20-\x7E]/g, "");
}

export function useSignIn(): UseSignInResult {
  const { refresh } = useAuthContext();
  const { client } = useApi();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  // ref-backed flag so the unmount cleanup below can stop an in-flight polling loop; a plain `let` would stay closed-over for the entire 5-minute timeout window after a fast sign-out / fast-refresh.
  const pollAbortedRef = React.useRef(false);
  React.useEffect(() => {
    warmUpBrowser();
    return () => {
      pollAbortedRef.current = true;
    };
  }, []);
  const signIn = React.useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    pollAbortedRef.current = false;
    try {
      const keypair = await loadOrCreateKeypair();
      const deviceName = buildDeviceName();
      const connectUrl = buildConnectUrl(
        CLOUD_BASE_URL,
        deviceName,
        keypair.publicKey,
      );
      const redirectUri = AuthSession.makeRedirectUri({ path: REDIRECT_PATH });
      // Ollama's connect page launches the first-party `ollama://` scheme instead of redirecting to our deep link; iOS rejects it with an "address invalid" alert. Poll /api/me and dismiss the browser ourselves the moment the bind lands so that alert never shows.
      // iOS-only: dismissAuthSession() throws UnavailabilityError on Android (Custom Tabs can't be closed programmatically), which would burn the poll until the 5-min timeout.
      const pollPromise = Platform.OS === "ios"
        ? (async (): Promise<WebBrowser.WebBrowserAuthSessionResult> => {
            try {
              while (!pollAbortedRef.current) {
                // Probe FIRST, then sleep: a leading sleep would let Ollama's <800ms redirect surface its alert before our first detection.
                try {
                  const bound = await fetchCurrentUser(client);
                  if (pollAbortedRef.current) break;
                  if (bound !== null) {
                    // Best-effort: a dismiss failure must not be caught as a poll error (which would skip the success return and keep polling until the 5-min timeout).
                    try {
                      WebBrowser.dismissAuthSession();
                    } catch (dismissErr) {
                      console.warn(
                        "[auth] dismissAuthSession failed:",
                        dismissErr,
                      );
                    }
                    return {
                      type: "success",
                    } as WebBrowser.WebBrowserAuthSessionResult;
                  }
                } catch (err) {
                  // Not __DEV__-gated: a transport fault during the bind poll should surface in production too; warn keeps LogBox calm, and expected 401s are already mapped to null.
                  console.warn("[auth] /api/me poll failed; will retry:", err);
                }
                await new Promise<void>((resolve) =>
                  setTimeout(resolve, BIND_POLL_INTERVAL_MS),
                );
              }
            } finally {
              pollAbortedRef.current = true;
            }
            return {
              type: "dismiss",
            } as WebBrowser.WebBrowserAuthSessionResult;
          })()
        : null;
      const raceLegs: Promise<WebBrowser.WebBrowserAuthSessionResult>[] = [
        // `preferEphemeralSession: true` ignores residual ollama.com cookies so a fresh sign-in always starts on the unauthenticated page — enables account switching after sign-out.
        WebBrowser.openAuthSessionAsync(connectUrl, redirectUri, {
          preferEphemeralSession: true,
        }),
        new Promise<WebBrowser.WebBrowserAuthSessionResult>((resolve) => {
          setTimeout(
            () =>
              resolve({
                type: "dismiss",
              } as WebBrowser.WebBrowserAuthSessionResult),
            SIGN_IN_TIMEOUT_MS,
          );
        }),
        ...(pollPromise !== null ? [pollPromise] : []),
      ];
      await Promise.race(raceLegs);
      // Final re-probe regardless of which leg of the race won; drives the AuthContext state machine to authenticated / unauthenticated.
      await refresh();
    } catch (err) {
      const wrapped =
        err instanceof Error ? err : new Error(String(err), { cause: err });
      console.error("useSignIn failed:", wrapped);
      setError(wrapped);
      throw wrapped;
    } finally {
      // Unconditional so a rejected openAuthSessionAsync (control jumps straight here) still stops the eagerly-started poll loop instead of leaving it firing /api/me until unmount.
      pollAbortedRef.current = true;
      setIsLoading(false);
    }
  }, [client, refresh]);
  return React.useMemo<UseSignInResult>(
    () => ({ signIn, isLoading, error }),
    [signIn, isLoading, error],
  );
}

export interface UseSignOutResult {
  signOut: () => Promise<void>;
  isLoading: boolean;
}

export function useSignOut(): UseSignOutResult {
  const { signOut: ctxSignOut } = useAuthContext();
  const [isLoading, setIsLoading] = React.useState(false);
  const signOut = React.useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await ctxSignOut();
    } finally {
      setIsLoading(false);
    }
  }, [ctxSignOut]);
  return React.useMemo<UseSignOutResult>(
    () => ({ signOut, isLoading }),
    [signOut, isLoading],
  );
}
