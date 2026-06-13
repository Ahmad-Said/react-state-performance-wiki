# 03 · React Query (TanStack Query)

> **Want more than the patterns below?** This page is the orientation; the [TanStack Query deep dive](../tanstack-react-query/README.md) drills into keys, caching internals, mutations/invalidation, SSR, Suspense, testing, and performance.

React Query is the default recommendation for caching server state in an external React client. It treats remote data as a cache keyed by query keys and gives you deduping, background refetch, and invalidation out of the box.

## Mental model

- A **query** is a read, identified by a **query key** array.
- The cache is keyed on that array. Same key → same cached data, deduped across components.
- Data is `fresh` for `staleTime`, then `stale`; stale data is still shown, then refetched in the background.
- Unused data is garbage-collected after `gcTime`.

## Setup

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s: avoid refetch storms on large lists
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false, // usually too aggressive for big tables
      retry: 2,
    },
  },
});

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <Orders />
  </QueryClientProvider>
);
```

## Paginated list

Put **every parameter that changes the result in the query key**. That is what makes caching correct.

```tsx
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listResource } from "./resourceApi";

function useOrders(params: { page: number; pageSize: number; filter?: object; sort?: string[] }) {
  return useQuery({
    queryKey: ["orders", params],          // ← params in the key
    queryFn: ({ signal }) => listResource("orders", params, signal),
    placeholderData: keepPreviousData,     // keep old page visible while next loads
  });
}
```

`keepPreviousData` is the key to smooth pagination on large tables: the previous page stays on screen (no spinner flash) while the next page streams in.

## Infinite scroll / "load more"

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";

function useInfiniteOrders(filter?: object) {
  return useInfiniteQuery({
    queryKey: ["orders", "infinite", filter],
    queryFn: ({ pageParam, signal }) =>
      listResource("orders", { page: pageParam, pageSize: 50, filter }, signal),
    initialPageParam: 1,
    getNextPageParam: (last, all) =>
      all.length * last.meta.pageSize < last.meta.count ? all.length + 1 : undefined,
  });
}
```

Pair this with a virtualized list (see [07-rendering-performance.md](./07-rendering-performance.md)) — `useInfiniteQuery` accumulates pages in memory, so without windowing you'll still render thousands of DOM nodes.

## Mutations + targeted invalidation

After a write, invalidate only the affected keys — don't blow away the whole cache.

```tsx
const qc = useQueryClient();
const updateOrder = useMutation({
  mutationFn: (o: Order) => updateResource("orders", o.id, o),
  onSuccess: (_data, vars) => {
    qc.invalidateQueries({ queryKey: ["orders"] });        // list pages
    qc.invalidateQueries({ queryKey: ["order", vars.id] }); // detail
  },
});
```

### Optimistic updates

```tsx
const toggleStatus = useMutation({
  mutationFn: ({ id, status }) => updateResource("orders", id, { status }),
  onMutate: async (vars) => {
    await qc.cancelQueries({ queryKey: ["order", vars.id] });
    const prev = qc.getQueryData(["order", vars.id]);
    qc.setQueryData(["order", vars.id], (o: any) => ({ ...o, status: vars.status }));
    return { prev };
  },
  onError: (_e, vars, ctx) => qc.setQueryData(["order", vars.id], ctx?.prev),
  onSettled: (_d, _e, vars) => qc.invalidateQueries({ queryKey: ["order", vars.id] }),
});
```

## Performance levers specific to large data

- **`select`** — derive/trim data in the cache so components subscribe to a smaller shape and re-render less:
  ```tsx
  useQuery({ queryKey: ["orders", params], queryFn, select: (r) => r.data.map(o => o.id) });
  ```
- **`staleTime`** — raise it for data that changes slowly; it directly cuts refetch volume.
- **`notifyOnChangeProps: "tracked"`** (default in v5) — components only re-render for fields they actually read.
- **Prefetch the next page** on hover/idle: `qc.prefetchQuery(...)`.
- **Structural sharing** (on by default) keeps unchanged row object references stable, so memoized rows don't re-render.

## When React Query is the right call

- You mostly read remote data, possibly across many components.
- You want caching/refetch/dedupe without writing it.
- You don't need a single global store or Redux devtools time-travel.

For client/UI state (filters, selection, modals) layer **Zustand** ([05-zustand.md](./05-zustand.md)) on top — don't push it into the query cache.
