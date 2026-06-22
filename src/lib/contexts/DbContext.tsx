// Async SQLite connection + repository container. The app shell owns the loading UX, so we render a null placeholder while opening and surface errors via the `useDb()` throw path for the nearest error boundary.

import type { SQLiteDatabase } from "expo-sqlite";
import React from "react";
import { AttachmentRepository } from "@/lib/db/attachmentRepository";
import { ChatRepository } from "@/lib/db/chatRepository";
import { openDb } from "@/lib/db/client";
import { MessageRepository } from "@/lib/db/messageRepository";

export interface DbContextValue {
  chats: ChatRepository;
  messages: MessageRepository;
  attachments: AttachmentRepository;
}

interface DbContextState {
  status: "idle" | "ready" | "error";
  value: DbContextValue | null;
  error: Error | null;
}

const DbContext = React.createContext<DbContextState | undefined>(undefined);
export interface DbProviderProps {
  children: React.ReactNode;
  // Fallback rendered while the database is opening; defaults to null so the app shell owns the spinner.
  fallback?: React.ReactNode;
  // Optional error renderer; defaults to null so consumers can rethrow via `useDb()` instead.
  errorFallback?: (error: Error) => React.ReactNode;
}

function buildRepositories(db: SQLiteDatabase): DbContextValue {
  return {
    chats: new ChatRepository(db),
    messages: new MessageRepository(db),
    attachments: new AttachmentRepository(db),
  };
}

export function DbProvider({
  children,
  fallback = null,
  errorFallback,
}: DbProviderProps): React.ReactElement {
  const [state, setState] = React.useState<DbContextState>({
    status: "idle",
    value: null,
    error: null,
  });
  React.useEffect(() => {
    let isCancelled = false;
    (async () => {
      try {
        const db = await openDb();
        if (isCancelled) return;
        setState({
          status: "ready",
          value: buildRepositories(db),
          error: null,
        });
      } catch (err) {
        if (isCancelled) return;
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("DbProvider: failed to open database:", error);
        setState({ status: "error", value: null, error });
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, []);
  if (state.status === "error" && state.error) {
    if (errorFallback) {
      return <>{errorFallback(state.error)}</>;
    }
    return <>{fallback}</>;
  }
  if (state.status !== "ready" || !state.value) {
    return <>{fallback}</>;
  }
  return <DbContext.Provider value={state}>{children}</DbContext.Provider>;
}
// Throws if the database is not yet open; place `<DbProvider>` above (its fallback covers the opening window).
export function useDb(): DbContextValue {
  const ctx = React.useContext(DbContext);
  if (ctx === undefined) {
    throw new Error("useDb must be used within a <DbProvider>");
  }
  if (ctx.status === "error" && ctx.error) {
    throw ctx.error;
  }
  if (!ctx.value) {
    throw new Error("useDb called before the database finished opening");
  }
  return ctx.value;
}
