# 01 · Overview & Decision Framework

## The problem

An external React client (a dashboard, an admin panel, a customer portal) fetches data from a Resource API. As the data set grows, three things degrade:

1. **Transport** — payloads get large, requests get slow, the network tab fills with redundant calls.
2. **Memory & state** — keeping everything in a global store bloats memory and triggers wide re-renders.
3. **Rendering** — React tries to reconcile thousands of DOM nodes and chokes the main thread.

Good architecture attacks all three, and the first rule is to stop treating "all the data" as something the client should hold at once.

## Two kinds of state

The single most important distinction:

| | **Server state** | **Client state** |
| --- | --- | --- |
| Source of truth | The backend | The browser |
| Examples | A page of records, a record detail, aggregates | Selected tab, modal open/closed, filter form draft, theme |
| Lifecycle | Async, can go stale, shared, cached | Synchronous, owned by the app |
| Best tool | React Query / RTK Query | Zustand / Redux / `useState` |

**Server state is not "just state you put in Redux."** It is a *cache* of something that lives elsewhere and can change without you. Tools like React Query and RTK Query exist precisely because treating server data as plain client state forces you to hand-write caching, deduping, background refresh, and invalidation — and most teams get that wrong.

## Decision framework

```mermaid
flowchart TD
    Q{"Is the data remote<br/>(fetched from Resource API)?"}
    Q -- "YES" --> Server["use a server-state cache"]
    Q -- "NO" --> Client["it's client/UI state"]
    
    Server --> |Already on Redux / need fine cache control| RTK["RTK Query"]
    Server --> |Otherwise (most apps)| RQ["React Query (TanStack Query)"]
    
    Client --> |Small, local| Local["useState / useReducer"]
    Client --> |Shared across tree, simple| Z["Zustand"]
    Client --> |Complex, many reducers, time-travel| Redux["Redux Toolkit"]
```

You can — and often should — combine them: **React Query for the data, Zustand for the UI state around it.** See [06-comparison.md](./06-comparison.md).

## Core principles for large data sets

1. **Server-side everything you can.** Pagination, filtering, sorting, and field projection belong on the server. See [02-resource-api.md](./02-resource-api.md).
2. **Cache by request, not by hand.** A cache keyed on `(collection, filter, page, sort)` deduplicates and reuses work automatically.
3. **Window the UI.** Render only the rows on screen. See [07-rendering-performance.md](./07-rendering-performance.md).
4. **Keep selectors narrow.** A component should subscribe to the smallest slice it needs, so unrelated updates don't re-render it.
5. **Prefer stale-while-revalidate.** Show cached data instantly, refresh in the background. Users perceive speed.
6. **Measure.** Use the React Profiler and the Network tab before optimizing. The bottleneck is rarely where you guess.

Continue to [02-resource-api.md](./02-resource-api.md).
