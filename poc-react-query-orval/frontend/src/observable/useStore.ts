import { useSyncExternalStore } from 'react';
import type { ObservableStore } from './store';

/**
 * React's official bridge to any external observable.
 *
 * `useSyncExternalStore(subscribe, getSnapshot)` IS the Observer pattern's
 * contract: React supplies the observer callback (which triggers a re-render),
 * calls `subscribe` on mount, the returned unsubscribe on unmount, and re-reads
 * `getSnapshot` after every notification.
 *
 * The `selector` narrows the snapshot so a component only re-renders when the
 * slice it actually reads changes. For primitive selections (the common case)
 * this is correct as-is; selecting fresh objects/arrays would need a shallow
 * equality check (what Zustand's `useShallow` does).
 */
export function useStore<T extends object, S>(
  store: ObservableStore<T>,
  selector: (state: T) => S,
): S {
  return useSyncExternalStore(store.subscribe, () =>
    selector(store.getSnapshot()),
  );
}
