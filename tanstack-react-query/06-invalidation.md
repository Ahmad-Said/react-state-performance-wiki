# 06 · Invalidation & Cache Manipulation

Keeping the cache correct after the world changes is the part teams get wrong. The toolset is small and sharp; the skill is knowing which tool and how *wide* to aim.

## What `invalidateQueries` actually does

It does **two** things to every query matching the filter:

1. Marks it **stale** (sets `isInvalidated`), and
2. **Refetches** it *if it's currently active* (has a mounted observer).

Inactive matching queries are only marked stale; they refetch lazily the next time they're observed. So invalidation is cheap for off-screen data and immediate for what's on screen — exactly what you want.

```tsx
qc.invalidateQueries({ queryKey: orderKeys.lists() });
```

You can force inactive ones to refetch too, or restrict to active only:

```tsx
qc.invalidateQueries({ queryKey: orderKeys.all, refetchType: "all" });    // also refetch inactive
qc.invalidateQueries({ queryKey: orderKeys.all, refetchType: "none" });   // mark stale, refetch nothing now
qc.invalidateQueries({ queryKey: orderKeys.lists(), type: "active" });    // only touch active queries
```

## Aim at the right width

The prefix-matching key scheme from [02-query-keys.md](./02-query-keys.md) is what makes this controllable:

```tsx
qc.invalidateQueries({ queryKey: orderKeys.all });                       // everything orders
qc.invalidateQueries({ queryKey: orderKeys.lists() });                   // all list pages, not details
qc.invalidateQueries({ queryKey: orderKeys.detail(id), exact: true });   // one record only
qc.invalidateQueries({ predicate: (q) =>                                 // arbitrary logic
  q.queryKey[0] === "orders" && (q.queryKey[2] as any)?.filter?.status === "open" });
```

**Match as narrowly as correctness allows.** The bare `qc.invalidateQueries()` (no filter) marks *the entire cache* stale and refetches every active query — almost never what you want, and a classic cause of refetch storms after a single write.

## `setQueryData` — write the cache directly

When you already have the correct value, skip the round-trip and write it:

```tsx
// Replace
qc.setQueryData(orderKeys.detail(id), updatedOrder);

// Functional update (patch the current value; receives the existing data or undefined)
qc.setQueryData<Order>(orderKeys.detail(id), (old) => old && { ...old, status: "shipped" });
```

Rules that bite:

- The updater **must be immutable** — return a new object; don't mutate `old` in place, or structural sharing and equality checks break.
- Returning `undefined` from the updater is a **no-op** (it won't clear the entry). To remove, use `qc.removeQueries({ queryKey, exact: true })`.
- `setQueryData` does **not** mark the query stale and does **not** trigger a refetch — it just updates the data and notifies observers. That's the point: it's a precise, network-free write.

### Patch many queries at once

```tsx
qc.setQueriesData<ListResponse>({ queryKey: orderKeys.lists() }, (old) =>
  old && { ...old, data: old.data.filter((o) => o.id !== deletedId) },
);
```

### Read without subscribing

```tsx
const order = qc.getQueryData<Order>(orderKeys.detail(id));        // one query, no re-render subscription
const allLists = qc.getQueriesData<ListResponse>({ queryKey: orderKeys.lists() }); // [ [key, data], ... ]
const state = qc.getQueryState(orderKeys.detail(id));              // status, dataUpdatedAt, error...
```

## Manual entity dedup (a normalized-cache lite)

React Query doesn't normalize entities. If a record appears in both a list and a detail view, they're independent cache entries. Usually that's fine — but if you want a write to one to reflect in the other without a refetch, you wire it manually. A `meta` hook centralizes this so you don't sprinkle it across mutations:

```tsx
// After fetching a list, seed each row's detail cache so detail views open instantly:
function seedDetailsFromList(qc: QueryClient, list: Order[]) {
  for (const order of list) {
    qc.setQueryData(orderKeys.detail(order.id), (existing: Order | undefined) =>
      existing ?? order); // don't clobber a possibly-fresher detail
  }
}
```

This is a deliberate trade-off: you gain instant cross-view consistency at the cost of hand-maintaining it. If you find yourself building a lot of this, that's the signal that a normalized cache (RTK Query, see [../state-management-performance/04-redux-rtk-query.md](../state-management-performance/04-redux-rtk-query.md)) might fit your domain better.

## Cancel, remove, reset, prefetch

```tsx
qc.cancelQueries({ queryKey: orderKeys.detail(id) }); // abort in-flight (used in optimistic onMutate)
qc.removeQueries({ queryKey: orderKeys.all });        // delete from cache entirely (no refetch)
qc.resetQueries({ queryKey: orderKeys.lists() });     // back to initial state, then refetch active
qc.prefetchQuery(orderQueries.detail(id));            // fetch & cache ahead of need (no observer)
qc.ensureQueryData(orderQueries.detail(id));          // prefetch but RETURN the data (await-able)
```

- **`removeQueries`** wipes data; the next observer starts from `pending`. Use sparingly — it discards the back-button experience.
- **`resetQueries`** is gentler: restores to initial and refetches what's active.
- **`prefetchQuery`** vs **`ensureQueryData`**: prefetch is fire-and-forget warming; `ensureQueryData` resolves with the data (cached or freshly fetched), ideal in route loaders.

## Scenario: edit a detail, see it in the list on the way back

A canonical flow: navigate from a list to a detail view, edit the record, navigate back, and expect the list to already reflect the change. Three ways to make that happen, from hands-off to surgical.

**1 · Invalidate the list — the default.** After the mutation succeeds, mark the list stale. When the list remounts on back-navigation it's stale *and* active, so it refetches in the background and converges on server truth. Least code, always correct.

```tsx
const qc = useQueryClient();
useMutation({
  mutationFn: updateOrder,
  onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.lists() }),
});
```

**2 · Write the cache — the snappy one.** You already hold the updated record, so patch it into the list and skip the round-trip. The list shows the new value instantly with no refetch flicker. The cost is correctness: if the server changes ordering, filtering, or aggregates, your hand-written list diverges — so this fits best when the write returns the canonical row and list shape is stable.

```tsx
useMutation({
  mutationFn: updateOrder,
  onSuccess: (updated) =>
    qc.setQueriesData<ListResponse>({ queryKey: orderKeys.lists() }, (old) =>
      old && { ...old, data: old.data.map((o) => (o.id === updated.id ? updated : o)) }),
});
```

**3 · Lean on default refetching — don't.** With `staleTime: 0` plus the default `refetchOnMount`/`refetchOnWindowFocus`, remounting the list *may* refetch on its own. But it's incidental, not guaranteed (raise `staleTime` and it stops), and the user sees the **old** row for a frame before it pops to the new one. Treat it as a safety net, never the mechanism.

**Pick:** invalidation by default; `setQueriesData` when the list is large, the API is slow, or you want a seamless transition with no background spinner. Combine them — optimistic `setQueriesData` plus an `onSettled` invalidate — when you want instant *and* eventually-correct (see [05-mutations-optimistic.md](./05-mutations-optimistic.md)).

## A practical invalidation policy

1. **One source of truth per write.** After a mutation, decide: does the server own the new value (→ invalidate) or do I (→ `setQueryData`)? Don't do both for the same field unless you mean optimistic-then-reconcile.
2. **Invalidate lists, write details.** Lists depend on server ordering/filtering/aggregates you can't reliably recompute; details you often get back verbatim from the write.
3. **Use `onSettled` as the backstop.** A scoped invalidate in `onSettled` guarantees eventual consistency even when an optimistic guess was wrong.
4. **Never bare-invalidate.** Always pass a `queryKey` or `predicate`.

Continue to [07-ssr-hydration.md](./07-ssr-hydration.md).
