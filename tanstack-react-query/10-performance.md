# 10 · Performance Tuning

React Query is already fast — its defaults dedupe requests and share structurally. The performance work that remains is mostly about **re-render isolation**: making sure a query update only re-renders the components that actually depend on what changed. This is where large data sets live or die.

## `select` — subscribe to a derived slice

`select` transforms cached data *per observer* before it reaches the component. Two payoffs: the component sees a smaller shape, and — critically — it **only re-renders when the selected output changes**, not when any part of the underlying data does.

```tsx
// This component re-renders only when the COUNT changes, not when row contents change:
function OrderCount(params) {
  const count = useQuery({
    ...orderQueries.list(params),
    select: (res) => res.meta.count,
  }).data;
  return <span>{count} orders</span>;
}

// Project to just the fields a list cell needs:
const ids = useQuery({ ...orderQueries.list(params), select: (r) => r.data.map((o) => o.id) }).data;
```

Two caveats:

- **Keep `select` referentially stable or cheap.** It runs on every render where the source data is present. If it builds a new array/object, React Query compares the *output* with structural sharing, so a stable-shaped output still avoids re-renders — but an expensive transform should be memoized: `select: useCallback((r) => heavy(r), [])`.
- The cache still stores the **full** response (shared across observers); `select` only narrows what *this* observer subscribes to.

## Tracked properties — re-render only on what you read

v5 tracks which fields of the query result a component actually destructures and re-renders only when *those* change (`notifyOnChangeProps: "tracked"`, the default). So a component that reads only `data` won't re-render when `isFetching` flips during a background refetch.

The gotcha: tracking works by observing property access during render. **Destructure the fields you use**; don't spread the whole result object or pass it wholesale, or you opt back into "re-render on anything."

```tsx
const { data } = useQuery(orderQueries.list(params)); // ✅ tracked: only `data` triggers re-render
// const q = useQuery(...); return <Child q={q} />;   // ❌ Child depends on the whole object
```

You can pin it explicitly for a hot component:

```tsx
useQuery({ ...orderQueries.list(params), notifyOnChangeProps: ["data", "error"] });
```

## Memoized rows + structural sharing = cheap list updates

Structural sharing (from [03-caching-lifecycle.md](./03-caching-lifecycle.md)) keeps unchanged row objects referentially stable across refetches. Combine that with `React.memo` rows and a stable key, and a refetch that changes one row re-renders exactly one row:

```tsx
const Row = React.memo(function Row({ order }: { order: Order }) {
  return <tr>{/* ... */}</tr>;
});

function Table({ rows }: { rows: Order[] }) {
  return <tbody>{rows.map((o) => <Row key={o.id} order={o} />)}</tbody>;
}
```

This only works if the row prop is the stable object reference React Query hands you — don't `.map` the rows into *new* objects on every render (that defeats `memo`); do that shaping in `select` instead, where structural sharing applies.

## Virtualize anything long

The render, not React Query, is the bottleneck for big lists. Window the DOM with `@tanstack/react-virtual` — mandatory for `useInfiniteQuery` (see [04-pagination-infinite.md](./04-pagination-infinite.md)) and worth it for any list past a few hundred rows. Full treatment in [../state-management-performance/07-rendering-performance.md](../state-management-performance/07-rendering-performance.md).

## Prefetch to hide latency

Warm the cache before the user needs it so the transition feels instant:

```tsx
// On row hover → prefetch the detail
<tr onMouseEnter={() => qc.prefetchQuery(orderQueries.detail(order.id))} />

// On idle → prefetch the next page (see 04)
// In a route loader → ensureQueryData (see 07)
```

Prefetch respects `staleTime`: if the data is still fresh, `prefetchQuery` is a no-op, so hover-prefetch is safe to fire liberally.

## Tune the timers for volume

The biggest network win on large data is almost always **raising `staleTime`** so you stop refetching slow-changing data on every focus/mount:

```tsx
staleTime: 30_000          // lists: kills focus/mount refetch storms
staleTime: 5 * 60_000      // reference/catalog data
refetchOnWindowFocus: false // big tables: focus refetch is usually more cost than benefit
```

See [03-caching-lifecycle.md](./03-caching-lifecycle.md) for the full timer model. The rule: tune per data type, not one global number.

## Don't over-fetch shape — push work to the server

No client trick beats not transferring the data. Use the Resource API's `fields`/projection, server filtering, and pagination so each query returns only what a view shows. A `select` that throws away 90% of each row is a smell — fetch the 10% instead. See [../state-management-performance/02-resource-api.md](../state-management-performance/02-resource-api.md).

## Profiling checklist

When a list feels slow, measure before guessing:

1. **React DevTools Profiler** — record an interaction. If many unrelated components re-render on one query update, you have a subscription-width problem → apply `select` / tracked-prop discipline.
2. **"Highlight updates when components render"** (React DevTools) — visually shows over-rendering rows; if the whole table flashes on a one-row change, your rows aren't memoized or you're remapping objects.
3. **Network tab** — redundant identical requests mean a key problem (params not in the key, or duplicated key shapes); a wall of refetches on focus means `staleTime` is too low.
4. **React Query Devtools** — inspect each query's status, `dataUpdatedAt`, observer count, and whether it's `fresh`/`stale`/`inactive`. The single best tool for "why did this refetch?"

```tsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
// render <ReactQueryDevtools initialIsOpen={false} /> inside the provider (dev builds only)
```

## Quick reference

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Whole table re-renders on one-row change | Rows not memoized / remapped each render | `React.memo` rows; shape in `select` |
| Component re-renders on background refetch | Subscribing to whole result object | Destructure only `data`; rely on tracked props |
| Refetch storm on tab focus / navigation | `staleTime: 0` | Raise `staleTime` per data type |
| Duplicate network requests for "same" data | Param missing from key, or key shape drift | Put all params in key; use key factories ([02](./02-query-keys.md)) |
| Memory grows on infinite scroll | No windowing / unbounded pages | Virtualize; set `maxPages` ([04](./04-pagination-infinite.md)) |
| Slow even with small payloads | DOM size | Virtualize the list ([rendering](../state-management-performance/07-rendering-performance.md)) |

---

That's the deep dive. Back to the [index](./README.md), or up to the [wiki root](../README.md).
