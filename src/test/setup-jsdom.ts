// jsdom doesn't implement ResizeObserver. Components that observe element size
// (e.g. PlaylistHeader's long-title detection) need it to mount in tests.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
