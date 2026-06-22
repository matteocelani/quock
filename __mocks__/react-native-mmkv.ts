// In-memory mock of `react-native-mmkv` v4. The real library wraps a native
// C++ key-value store unavailable under Jest / Node; tests only need the
// typed get/set/delete surface plus `clearAll` and `contains`.

export interface Configuration {
  id?: string;
  path?: string;
  encryptionKey?: string;
}

type StoredValue = string | number | boolean | Uint8Array;

class MMKVInstance {
  // Each instance owns its own store, mirroring how separate ids map to
  // separate native storage files in production.
  private readonly store = new Map<string, StoredValue>();

  set(key: string, value: StoredValue): void {
    this.store.set(key, value);
  }

  getString(key: string): string | undefined {
    const v = this.store.get(key);
    return typeof v === "string" ? v : undefined;
  }

  getNumber(key: string): number | undefined {
    const v = this.store.get(key);
    return typeof v === "number" ? v : undefined;
  }

  getBoolean(key: string): boolean | undefined {
    const v = this.store.get(key);
    return typeof v === "boolean" ? v : undefined;
  }

  getBuffer(key: string): Uint8Array | undefined {
    const v = this.store.get(key);
    return v instanceof Uint8Array ? v : undefined;
  }

  contains(key: string): boolean {
    return this.store.has(key);
  }

  // Real MMKV v4 exposes `remove(key): boolean`; legacy `delete(key): void` is kept so existing callers still compile while the codebase migrates.
  remove(key: string): boolean {
    return this.store.delete(key);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }

  clearAll(): void {
    this.store.clear();
  }

  // Listener API — no-op in tests. Real MMKV fires this on value changes;
  // we return a dummy subscription object so consumers can still cleanly
  // unsubscribe without conditional guards.
  addOnValueChangedListener(_listener: (key: string) => void): {
    remove: () => void;
  } {
    return { remove: () => {} };
  }
}

export type MMKV = MMKVInstance;

export function createMMKV(_configuration?: Configuration): MMKVInstance {
  return new MMKVInstance();
}
