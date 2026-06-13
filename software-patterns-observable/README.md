# Software Patterns & the Observable Pattern

A focused guide to **design patterns** in general, the **Observer / Observable pattern** in particular, and how **React state is itself an instance of that pattern**. The goal: stop seeing React's `useState`, Zustand, Redux, and React Query as unrelated tools and start seeing them as the *same idea* — a subject that notifies subscribers — dressed in different APIs.

## Contents

| File | Topic |
| --- | --- |
| [01-software-patterns.md](./01-software-patterns.md) | What design patterns are, the three classic categories, and when a pattern earns its keep |
| [02-observer-observable.md](./02-observer-observable.md) | The Observer/Observable pattern from first principles: subject, observers, subscribe/notify, push vs pull |
| [03-react-state-as-observable.md](./03-react-state-as-observable.md) | React state *is* an observable system — `useState`, external stores, and `useSyncExternalStore` |
| [04-build-an-observable-store.md](./04-build-an-observable-store.md) | Build a minimal observable store from scratch and wire it into React (mirrors the live demo) |

> **Want to see it run?** The companion React app has a live page that implements the store from [file 04](./04-build-an-observable-store.md) and lets you watch observers get notified in real time. See [`poc-react-query-orval/frontend`](../poc-react-query-orval/frontend) → the **Observable Pattern** tab.

## TL;DR

- **A pattern is a named, reusable shape for a recurring problem** — not a library, not a rule. Use it when it removes real complexity, skip it when it adds ceremony.
- **The Observer pattern** lets one object (the *subject/observable*) keep a list of dependents (*observers*) and notify them automatically when it changes. It decouples "something changed" from "who cares."
- **Every React state tool is an observable store underneath.** `useState` is per-component; Zustand, Redux, and React Query are app-wide subjects. They all do `subscribe` → `notify` → re-read.
- **`useSyncExternalStore` is React's official bridge** to any external observable. If you understand `subscribe(callback)` + `getSnapshot()`, you understand how every external store integrates with React.

## How this connects to the rest of the wiki

The [state-management-performance](../state-management-performance/README.md) wiki compares the *tools*. This folder explains the *pattern they all share*, so the trade-offs there (selector discipline, narrow subscriptions, re-render scope) make sense as consequences of one design — the observable.
