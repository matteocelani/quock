// Auth state slice: the device's Ed25519 keypair is the durable identity (kept in SecureStore by `@/modules/auth/lib/keypair`), so this provider only tracks the resolved `User` and a checking/authenticated/unauthenticated status machine. The connect-URL handshake lives in `useSignIn` to keep this provider passive.

import { useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import React from "react";
import { User } from "@/gotypes";
import { fetchCurrentUser, signOut as apiSignOut } from "@/modules/auth/api/auth";
import { KEYPAIR_SEED_STORE_KEY } from "@/modules/auth/constants";
import { queryKeys } from "@/lib/hooks/queryKeys";
import { useToast } from "@/lib/hooks/useToast";
import { useApi } from "@/lib/contexts/ApiContext";

export type AuthStatus = "checking" | "authenticated" | "unauthenticated";
export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  // Re-runs the `/api/me` probe; useful after the connect-URL browser closes.
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined,
);
export interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({
  children,
}: AuthProviderProps): React.ReactElement {
  const { client, setOnAuthExpired, resetKeypairCache } = useApi();
  const showToast = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = React.useState<User | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>("checking");
  // The signed `/api/me` probe is the single source of truth for auth state.
  const probeUser = React.useCallback(async (): Promise<void> => {
    setStatus("checking");
    try {
      const fetched = await fetchCurrentUser(client);
      if (fetched !== null) {
        if (__DEV__)
          console.warn(
            `[AUTH] probeUser: /api/me returned user id=${fetched.id} → authenticated`,
          );
        setUser(fetched);
        setStatus("authenticated");
      } else {
        if (__DEV__)
          console.warn(
            "[AUTH] probeUser: /api/me returned null (401) → unauthenticated",
          );
        setUser(null);
        setStatus("unauthenticated");
      }
    } catch (err) {
      if (__DEV__)
        console.warn(
          `[AUTH] probeUser: threw ${err instanceof Error ? err.constructor.name : "Unknown"}: ${err instanceof Error ? err.message : String(err)} → unauthenticated`,
        );
      console.error("AuthContext probeUser failed:", err);
      setUser(null);
      setStatus("unauthenticated");
    }
  }, [client]);
  // Bootstrap on mount — the keypair already exists (or will be created on first signed request), and `/api/me` tells us whether the server has bound it to a user yet.
  React.useEffect(() => {
    let isCancelled = false;
    (async () => {
      await probeUser();
      if (isCancelled) {
        // Guard against the cleanup race; we just don't double-update state.
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [probeUser]);
  // Drop the in-memory keypair cache on sign-out; without it the ApiClient keeps signing with the wiped key and the next sign-in re-auths the same account (only a full restart cleared it).
  const signOut = React.useCallback(async (): Promise<void> => {
    try {
      await apiSignOut(client);
    } catch (err) {
      // Server call is best-effort so an offline user still lands on the login screen.
      console.warn("AuthContext signOut: server signout failed:", err);
    }
    try {
      await SecureStore.deleteItemAsync(KEYPAIR_SEED_STORE_KEY);
    } catch (err) {
      console.warn("AuthContext signOut: keypair wipe failed:", err);
    }
    resetKeypairCache();
    setUser(null);
    setStatus("unauthenticated");
    queryClient.removeQueries({ queryKey: queryKeys.user() });
  }, [client, queryClient, resetKeypairCache]);
  // Local-only sign-out for the 401 bridge: the server already rejected the device key, so no revoke call.
  const clearLocalAuth = React.useCallback((): void => {
    setUser(null);
    setStatus("unauthenticated");
    queryClient.removeQueries({ queryKey: queryKeys.user() });
  }, [queryClient]);
  // Bridge ApiClient's 401 callback into local sign-out plus a user-facing toast.
  React.useEffect(() => {
    const handler = (_signinUrl?: string): void => {
      clearLocalAuth();
      showToast({
        title: "Session expired. Sign in again.",
        tone: "warning",
      });
    };
    return setOnAuthExpired(handler);
  }, [setOnAuthExpired, clearLocalAuth, showToast]);
  const value = React.useMemo<AuthContextValue>(
    () => ({ user, status, refresh: probeUser, signOut }),
    [user, status, probeUser, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuthContext must be used within an <AuthProvider>");
  }
  return ctx;
}
