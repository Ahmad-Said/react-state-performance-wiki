/**
 * A dependency-free observable store — the Observer pattern in ~30 lines.
 *
 * This is the exact code from the wiki:
 *   software-patterns-observable/04-build-an-observable-store.md
 *
 * Three primitives make up the whole pattern:
 *   - subscribe(listener) -> unsubscribe   (an observer registers)
 *   - getSnapshot()                        (an observer pulls the current value)
 *   - setState(patch)                      (mutate the subject, then notify everyone)
 */
type Listener = () => void;

export interface ObservableStore<T> {
  getSnapshot: () => T;
  setState: (patch: Partial<T> | ((prev: T) => Partial<T>)) => void;
  subscribe: (listener: Listener) => () => void;
  /** Number of currently-registered observers (for the demo's live readout). */
  listenerCount: () => number;
}

export function createStore<T extends object>(initial: T): ObservableStore<T> {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    getSnapshot: () => state,

    setState: (patch) => {
      const partial = typeof patch === 'function' ? patch(state) : patch;
      // New reference → snapshot identity changes → React knows to re-read.
      state = { ...state, ...partial };
      // Pull model: bare callbacks. Each observer re-reads what it needs.
      listeners.forEach((l) => l());
    },

    subscribe: (listener) => {
      listeners.add(listener);
      // The unsubscribe the pattern demands — React calls this on unmount.
      return () => {
        listeners.delete(listener);
      };
    },

    listenerCount: () => listeners.size,
  };
}
