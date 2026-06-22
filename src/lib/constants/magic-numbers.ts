// Constants shared across 2+ modules. Design values live in `@/lib/design/tokens`; module-local values in `modules/<feature>/constants.ts`.

// Query layer — TanStack Query default stale time.
export const QUERY_STALE_TIME_MS = 30_000;

// DB layer.
export const EXCERPT_LENGTH = 80;
export const INITIAL_USER_VERSION = 0;
