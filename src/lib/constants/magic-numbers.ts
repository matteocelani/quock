// Constants shared across 2+ modules. Design values live in `@/lib/design/tokens`; module-local values in `modules/<feature>/constants.ts`.

// Query layer — TanStack Query default stale time.
export const QUERY_STALE_TIME_MS = 30_000;

// DB layer.
export const EXCERPT_LENGTH = 80;
export const INITIAL_USER_VERSION = 0;

// Web search is on for every new chat row: the globe reads active from the first frame, and it is capability-gated
// downstream so a model without tools ignores it. Existing chats keep whatever they already had.
export const WEB_SEARCH_DEFAULT_ON = true;

// Agent tool-round cap (settings store + Settings control): seeds the default and bounds the segmented control.
export const AGENT_MAX_TOOL_ROUNDS_DEFAULT = 8;
export const AGENT_MAX_TOOL_ROUNDS_CHOICES = [4, 8, 12, 16] as const;
