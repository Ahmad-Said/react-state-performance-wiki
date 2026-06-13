# 06 · Comparison & How to Choose

## At a glance

| | **React Query** | **RTK Query** | **Zustand** | **Redux Toolkit (slices)** |
| --- | --- | --- | --- | --- |
| Primary job | Server-state cache | Server-state cache | Client state | Client state |
| Bundle size | ~12 KB | part of RTK (~?) | ~1 KB | ~RTK |
| Caching/dedupe | ✅ built-in | ✅ built-in | ❌ DIY | ❌ DIY |
| Background refetch | ✅ | ✅ | ❌ | ❌ |
| Invalidation model | Query keys | Tags | manual | manual |
| Normalization | optional (`select`) | `createEntityAdapter` | manual | `createEntityAdapter` |
| Devtools/time-travel | RQ devtools | Redux devtools | via middleware | ✅ full |
| Boilerplate | low | medium | very low | medium–high |
| Best for | read-heavy remote data | Redux apps + remote data | UI state | complex client state |

## Recommended pairings

- **Most external React clients →** **React Query (data) + Zustand (UI state).** Lightweight, clear separation, excellent caching, minimal boilerplate. This is the default recommendation for the scenario this wiki covers.
- **Existing Redux app →** **RTK Query (data) + RTK slices (UI state).** One store, one paradigm, devtools throughout.
- **Tiny app →** `useState`/`useReducer` + a fetcher; add a cache only when you feel the pain.

## Anti-patterns to avoid

1. **Putting fetched lists in Redux/Zustand and hand-managing refetch.** This re-implements (badly) what query libraries do. Use a query cache.
2. **One giant global store object.** Wide subscriptions → wide re-renders. Slice it, select narrowly.
3. **Filtering/sorting large arrays in the component body.** Runs every render. Push to the server, or memoize with `useMemo`/`reselect`.
4. **Using a query key / cache key that omits a parameter that changes the result.** Causes stale or mixed-up data.
5. **No virtualization on long lists.** Even with perfect data fetching, 5,000 DOM rows will jank. See [07-rendering-performance.md](./07-rendering-performance.md).
6. **`refetchOnWindowFocus` on heavy endpoints.** Tab-switching triggers expensive refetch storms; disable per endpoint.

## Decision shortcut

> If you're starting fresh and the question is "what should I use to talk to the Resource API from React?" — **start with React Query.** Add Zustand the moment you have shared UI state. Only adopt Redux/RTK Query if you have a concrete need for a single centralized store or its devtools.
