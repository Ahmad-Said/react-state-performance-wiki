# 02 · Query Keys

The query key is the cache identity, the dependency array, and the invalidation handle all at once. Get keys right and most of React Query falls into place.

## The rules

1. **A key is an array.** Always — even for a single string: `["orders"]`, not `"orders"`.
2. **It must be serializable.** React Query hashes it with a *deterministic* JSON serializer, so object key order doesn't matter (`{ a, b }` hashes the same as `{ b, a }`), but functions, class instances, and `Symbol`s are not allowed.
3. **Every input the `queryFn` reads must be in the key.** If the result depends on it, it belongs in the key. This is the cardinal rule — violating it is how you get "stale data that won't update."

```tsx
// ❌ filter is used in the fetch but NOT in the key → changing the filter shows stale data
useQuery({ queryKey: ["orders"], queryFn: () => listResource("orders", { filter }) });

// ✅ filter is in the key → each filter value is its own cache entry
useQuery({ queryKey: ["orders", { filter }], queryFn: () => listResource("orders", { filter }) });
```

## Structure keys from generic → specific

Order keys like a URL path, broad segment first. This makes **partial matching** (and therefore invalidation) natural.

```tsx
["orders"]                                  // everything orders-related
["orders", "list"]                          // all list views
["orders", "list", { page, pageSize, filter, sort }]  // one specific page
["orders", "detail", orderId]               // one record
```

Now `invalidateQueries({ queryKey: ["orders"] })` matches **all** of the above (prefix match), while `invalidateQueries({ queryKey: ["orders", "detail", orderId] })` hits just one record. You get coarse and fine control from the same scheme.

## Key factories — the pattern that scales

Hand-writing key arrays at every call site drifts and breaks invalidation (one place writes `["order", id]`, another `["orders", "detail", id]` — they never match). Centralize keys in a **factory object** per feature:

```tsx
// orders/queryKeys.ts
export const orderKeys = {
  all:     ["orders"] as const,
  lists:   () => [...orderKeys.all, "list"] as const,
  list:    (params: ListParams) => [...orderKeys.lists(), params] as const,
  details: () => [...orderKeys.all, "detail"] as const,
  detail:  (id: string) => [...orderKeys.details(), id] as const,
};
```

```tsx
useQuery({ queryKey: orderKeys.list(params), queryFn: () => listResource("orders", params) });
useQuery({ queryKey: orderKeys.detail(id),  queryFn: () => getResource("orders", id) });

// Invalidate just the lists, leave detail caches alone:
qc.invalidateQueries({ queryKey: orderKeys.lists() });
// Invalidate absolutely everything orders:
qc.invalidateQueries({ queryKey: orderKeys.all });
```

`as const` is what makes the keys *typed tuples* rather than `string[]` — it pays off with `queryOptions` (below) and with `getQueryData<T>()`.

## Co-locate the queryFn with `queryOptions` (v5)

v5 adds the `queryOptions` helper, which ties a key to its fetcher and result type in one reusable, fully-typed object. This is the current best practice — prefer it over loose factories.

```tsx
import { queryOptions } from "@tanstack/react-query";

export const orderQueries = {
  list: (params: ListParams) =>
    queryOptions({
      queryKey: ["orders", "list", params] as const,
      queryFn: ({ signal }) => listResource("orders", params, signal),
      staleTime: 30_000,
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: ["orders", "detail", id] as const,
      queryFn: ({ signal }) => getResource("orders", id, signal),
    }),
};
```

The payoff: every consumer is type-safe and DRY, and `getQueryData` infers the type from the key.

```tsx
useQuery(orderQueries.list(params));
useSuspenseQuery(orderQueries.detail(id));
qc.prefetchQuery(orderQueries.detail(id));
const cached = qc.getQueryData(orderQueries.detail(id).queryKey); // typed as Order | undefined
```

## The `queryFn` context

The `queryFn` receives a context object — use it instead of closing over outer variables:

```tsx
queryFn: ({ queryKey, signal, pageParam, meta }) => { ... }
```

- **`signal`** — an `AbortSignal`. **Forward it to `fetch`/axios.** React Query aborts it when the query is cancelled (key change, component unmount, `cancelQueries`), so superseded requests don't waste bandwidth or cause out-of-order writes.
- **`queryKey`** — the key array. Reading params *from here* keeps the fn pure: it can only depend on what's in the key, which structurally enforces the cardinal rule.
- **`pageParam`** — only for `useInfiniteQuery` (see [04-pagination-infinite.md](./04-pagination-infinite.md)).

```tsx
async function listResource(collection: string, params: ListParams, signal?: AbortSignal) {
  const res = await fetch(`/api/${collection}:list?${qs(params)}`, { signal });
  if (!res.ok) throw new Error(`${collection}:list failed (${res.status})`); // throw → status: "error"
  return res.json() as Promise<{ data: unknown[]; meta: { count: number } }>;
}
```

> **The `queryFn` must throw on error.** React Query decides success/failure by whether the promise rejects. `fetch` does *not* reject on 4xx/5xx — you must check `res.ok` and throw yourself, or you'll cache error responses as "successful" data.

## Matching semantics (for invalidation & lookups)

`invalidateQueries`, `getQueriesData`, `cancelQueries`, etc. take **filters**:

- By default matching is a **prefix** match: `{ queryKey: ["orders"] }` matches `["orders", "list", …]` and `["orders", "detail", …]`.
- Add `exact: true` to match only that precise key.
- Add `type: "active"` to touch only queries with mounted observers (cheaper, avoids refetching off-screen data).
- Use `predicate: (query) => …` for arbitrary logic over `query.queryKey`.

```tsx
qc.invalidateQueries({ queryKey: ["orders", "detail", id], exact: true });
qc.invalidateQueries({ queryKey: ["orders"], type: "active" });
qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "orders" && q.state.isInvalidated === false });
```

Full invalidation strategy is in [06-invalidation.md](./06-invalidation.md).

Continue to [03-caching-lifecycle.md](./03-caching-lifecycle.md).
