// In-memory mock of `expo-secure-store`. The real module talks to the native
// iOS Keychain / Android Keystore, neither of which exist under the Jest /
// Node runtime. Tests should treat this module as a plain ephemeral key-value
// store and call `__resetForTest()` in `beforeEach` to guarantee isolation.

const store = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  const value = store.get(key);
  return value === undefined ? null : value;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}

// Test-only helper. Not part of the real `expo-secure-store` surface.
// Callers should invoke this in `beforeEach` to ensure a clean slate
// between tests; otherwise state leaks across the suite.
export function __resetForTest(): void {
  store.clear();
}
