# 03 · React State *Is* an Observable System

The claim of this folder: **React state isn't *like* the Observer pattern — it *is* the Observer pattern.** A component is an observer; a piece of state is a subject; a re-render is the notification. Once you see it, every state tool collapses into the same shape.

## `useState`: a per-component subject

When you call `useState`, React stores the value and remembers *this component* as its sole observer. Calling the setter is `setState` from [file 02](./02-observer-observable.md): it updates the value and notifies the observer — by scheduling a re-render.

```tsx
function Counter() {
  const [count, setCount] = useState(0); // subject lives in React's fiber
  // setCount(n) === "mutate state, then notify THIS component"
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

The subscriber list has exactly one entry (the component), and React manages subscribe/unsubscribe for you via mount/unmount. That's why `useState` needs no cleanup — React *is* the observer-list manager.

## The limit of `useState`, and why external stores exist

`useState` only notifies the component that owns it. The moment two distant components need the *same* changing value, you need a subject that **lives outside any single component** and can have **many observers**. That's an external store — and it's the [file 02](./02-observer-observable.md) `createObservable` verbatim.

| | `useState` | External observable store |
| --- | --- | --- |
| Subject lives in | One component's fiber | Module scope (shared) |
| Observers | Just that component | Any component that subscribes |
| Subscribe/unsubscribe | Automatic (mount/unmount) | You provide it; React calls it |
| Examples | local UI bits | Zustand, Redux, React Query cache |

## `useSyncExternalStore`: React's official bridge

React 18 added a hook whose entire job is to connect a component (observer) to any external subject. Its signature **is the pattern's contract**:

```ts
const snapshot = useSyncExternalStore(
  subscribe,    // (onStoreChange) => unsubscribe   ← register this component
  getSnapshot,  // () => currentValue               ← pull the current value
);
```

Compare to [file 02](./02-observer-observable.md): `subscribe` and `getSnapshot` are *exactly* the two methods our `createObservable` exposed. React supplies the observer callback (`onStoreChange`, which triggers a re-render), calls your `subscribe` on mount, calls the returned unsubscribe on unmount, and re-reads `getSnapshot` after every notification.

```tsx
import { useSyncExternalStore } from "react";
import { counter } from "./counter-store"; // the createObservable from file 02

function CounterView() {
  const count = useSyncExternalStore(counter.subscribe, counter.getSnapshot);
  return <span>{count}</span>; // re-renders whenever counter.setState runs
}
```

That's the whole integration. No library required — just the pattern.

## Every state library is this pattern in a trench coat

| Library | Subject (observable) | `subscribe` | Notify trigger |
| --- | --- | --- | --- |
| **Zustand** | the `create()` store | `store.subscribe` | `set(...)` |
| **Redux** | the store | `store.subscribe` | `dispatch(action)` |
| **React Query** | the `QueryCache` | observer per query key | server fetch / `invalidateQueries` |
| **Valtio / MobX** | a proxied object | proxy traps | property mutation |

They differ in *ergonomics* (immutability, selectors, async caching) and in *how they decide who to notify*, but the engine is identical: a subject with a subscriber set, plus a `getSnapshot`. Most of them call `useSyncExternalStore` internally.

## Why "selector discipline" is a consequence of the pattern

The performance advice you see everywhere — *subscribe to the narrowest slice* (see [state-management-performance/05-zustand.md](../state-management-performance/05-zustand.md)) — falls straight out of the **pull** model. The subject notifies *all* observers on any change; it's each observer's `getSnapshot` that decides whether it actually needs to re-render. A selector narrows `getSnapshot` so the observer ignores changes to slices it doesn't read:

```tsx
// Broad observer: getSnapshot returns the whole store → re-renders on any change
const everything = useStore((s) => s);

// Narrow observer: getSnapshot returns one field → re-renders only when it changes
const page = useStore((s) => s.page);
```

Same subject, smarter observer. The pattern explains *why* the rule works, not just that it does.

Continue to [04-build-an-observable-store.md](./04-build-an-observable-store.md) to build one end-to-end — the same code that powers the live demo page.
