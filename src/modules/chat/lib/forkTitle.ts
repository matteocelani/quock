// A fork starts with its source's first message, so its title is the only thing that tells the two history rows apart.

const FORK_LABEL = "Fork";
export const FORK_TITLE_PREFIX = `${FORK_LABEL} – `;

// Forking a fork re-prefixes the bare title instead of stacking "Fork – Fork – …" until the row reads as noise.
export function forkTitle(sourceTitle: string): string {
  const bare = sourceTitle.startsWith(FORK_TITLE_PREFIX)
    ? sourceTitle.slice(FORK_TITLE_PREFIX.length)
    : sourceTitle;
  const trimmed = bare.trim();
  return trimmed === "" ? FORK_LABEL : `${FORK_TITLE_PREFIX}${trimmed}`;
}
