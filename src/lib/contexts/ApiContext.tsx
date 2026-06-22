// Singleton ApiClient built once so headers and in-flight requests stay shared. The auth-expired handler is registered via a ref to avoid an AuthContext → ApiContext import cycle.

import React from "react";
import { ApiClient } from "@/lib/api/client";
import { CLOUD_BASE_URL } from "@/lib/api/config";
import { clearKeypairInFlight, type Keypair, loadOrCreateKeypair } from "@/modules/auth/lib/keypair";

export type AuthExpiredHandler = (signinUrl?: string) => void;
export interface ApiContextValue {
  client: ApiClient;
  // Registers (or clears) the 401 handler; returns an unregister so consumers can `useEffect` safely.
  setOnAuthExpired: (handler: AuthExpiredHandler | null) => () => void;
  // Drops the in-memory keypair so the next request re-reads SecureStore. Must run on sign-out; otherwise the cached key keeps authenticating the old account after the seed is wiped and account switching fails until a restart.
  resetKeypairCache: () => void;
}

const ApiContext = React.createContext<ApiContextValue | undefined>(undefined);
export interface ApiProviderProps {
  children: React.ReactNode;
}

export function ApiProvider({
  children,
}: ApiProviderProps): React.ReactElement {
  // Ref is the single source of truth so we can swap handlers without rebuilding the client.
  const onAuthExpiredRef = React.useRef<AuthExpiredHandler | null>(null);
  // Client is constructed once; the keypair loader caches in module scope after the first SecureStore round-trip, so per-request cost is amortized.
  const value = React.useMemo<ApiContextValue>(() => {
    // Cache the in-flight PROMISE, not just the result, so concurrent first requests share ONE init —
    // otherwise each could call loadOrCreateKeypair independently and the SecureStore-empty race would mint
    // divergent seeds. Cleared on sign-out and on failure (so the next request retries instead of caching null).
    let keypairPromise: Promise<Keypair | null> | null = null;
    const resolveKeypair = (): Promise<Keypair | null> => {
      if (keypairPromise !== null) return keypairPromise;
      keypairPromise = loadOrCreateKeypair().catch((err: unknown) => {
        console.error("ApiContext loadOrCreateKeypair failed:", err);
        keypairPromise = null;
        return null;
      });
      return keypairPromise;
    };

    const client = new ApiClient({
      baseUrl: CLOUD_BASE_URL,
      getKeypair: resolveKeypair,
      onAuthExpired: (signinUrl?: string): void => {
        const handler = onAuthExpiredRef.current;
        if (handler) {
          handler(signinUrl);
        }
      },
    });

    const setOnAuthExpired = (
      handler: AuthExpiredHandler | null,
    ): (() => void) => {
      onAuthExpiredRef.current = handler;
      return () => {
        // Only clear if we are still the registered handler to survive fast-refresh races.
        if (onAuthExpiredRef.current === handler) {
          onAuthExpiredRef.current = null;
        }
      };
    };
    const resetKeypairCache = (): void => {
      keypairPromise = null;
      // Also drop the module-level in-flight load; nulling only keypairPromise would let the next request pull a
      // pre-sign-out load (the previous account's key) back out of keypair.ts's own cache.
      clearKeypairInFlight();
    };
    return {
      client,
      setOnAuthExpired,
      resetKeypairCache,
    };
  }, []);
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextValue {
  const ctx = React.useContext(ApiContext);
  if (ctx === undefined) {
    throw new Error("useApi must be used within an <ApiProvider>");
  }
  return ctx;
}
