// Mock of `expo/fetch`. Production code uses Expo's streaming-capable fetch (it exposes `response.body` as a real `ReadableStream` on iOS, which the standard RN `fetch` polyfill does not). In Node-side Jest the global `fetch` and our test stubs are sufficient; we forward at call time so tests that monkey-patch `globalThis.fetch` are honoured.

export function fetch(input: unknown, init?: unknown): Promise<unknown> {
  return (globalThis.fetch as (i: unknown, n?: unknown) => Promise<unknown>)(
    input,
    init,
  );
}
