# 04 · Build an Observable Store (and Wire It Into React)

This is the payoff: a complete, dependency-free observable store and a React hook that subscribes to it with **selector support** — i.e. a tiny Zustand. The code here is the same code running on the **Observable Pattern** page of the companion app ([`poc-react-query-orval/frontend`](../poc-react-query-orval/frontend)), so you can read it here and watch it fire there.

## Step 1 — the store (the subject)

Generic over the state shape. Three methods, exactly as in [file 02](./02-observer-observable.md), plus a functional `setState` for ergonomic updates:

```ts
// src/observable/store.ts
type Listener = () => void;

export interface ObservableStore<T> {
  getSnapshot: () => T;
  setState: (patch: Partial<T> | ((prev: T) => Partial<T>)) => void;
  subscribe: (listener: Listener) => () => void;
}

export function createStore<T extends object>(initial: T): ObservableStore<T> {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    getSnapshot: () => state,

    setState: (patch) => {
      const partial = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...partial };   // new reference → snapshot identity changes
      listeners.forEach((l) => l());      // notify (pull model: bare callbacks)
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener); // the unsubscribe the pattern demands
    },
  };
}
```

Returning a **new object** from `setState` matters: React compares snapshots by identity, so a fresh reference is how it knows something changed.

## Step 2 — the React hook (the observer)

`useSyncExternalStore` wires a component to the store. We add a `selector` so each component pulls only the slice it cares about — the narrow `getSnapshot` from [file 03](./03-react-state-as-observable.md):

```ts
// src/observable/useStore.ts
import { useSyncExternalStore } from "react";
import type { ObservableStore } from "./store";

export function useStore<T extends object, S>(
  store: ObservableStore<T>,
  selector: (state: T) => S,
): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getSnapshot()),
  );
}
```

> **Caveat for production:** if a selector builds a *new* object/array each call, `useSyncExternalStore` will loop or over-render because the snapshot identity is never stable. Real libraries add `useSyncExternalStoreWithSelector` + an equality check (`useShallow` in Zustand). For selecting primitives — the common case — the version above is correct and enough.

## Step 3 — use it

```tsx
// somewhere shared
export const cartStore = createStore({ items: 0, lastAction: "—" });

// any component, anywhere in the tree
function CartBadge() {
  const items = useStore(cartStore, (s) => s.items); // observer of `items` only
  return <span>🛒 {items}</span>;
}

function AddButton() {
  return (
    <button onClick={() => cartStore.setState((s) => ({ items: s.items + 1, lastAction: "add" }))}>
      Add
    </button>
  );
}
```

`CartBadge` and `AddButton` share no props, no context, no parent — they're decoupled exactly as the Observer pattern promises. The button mutates the subject; the badge re-renders because it's a subscriber. Add a third component reading `lastAction` and it just works, no plumbing changed.

## What the demo page shows

The live page makes the invisible visible:

1. **Multiple independent observers** of one store, mounted as separate components with no shared parent state.
2. **A notification log** — every `setState` appends a line, so you literally watch observers fire.
3. **Selective subscription** — a component reading only `count` does *not* re-render when an unrelated field changes (render counters prove it), demonstrating the selector point from [file 03](./03-react-state-as-observable.md).
4. **Subscribe / unsubscribe** — mount and unmount an observer to see it join and leave the subject's list.

## You now understand every store

This ~30-line store has the same skeleton as Zustand, Redux, and the React Query cache. They add immutability helpers, middleware, devtools, async lifecycle, and smarter equality — but the engine is what you just built: **a subject with a subscriber set and a snapshot.** That's the Observer pattern, and that's React state.

← Back to the [README](./README.md) · Compare the real tools in [state-management-performance](../state-management-performance/README.md).
