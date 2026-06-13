# 04 · Pagination & Infinite Queries

Large data is the whole reason this wiki exists. React Query has two distinct tools for it — page-at-a-time and accumulate-pages — and they are not interchangeable.

## Decide first: paged table vs infinite feed

| | Paged table | Infinite feed |
| --- | --- | --- |
| Hook | `useQuery` + `keepPreviousData` | `useInfiniteQuery` |
| UI | Page N replaces page N-1 | Pages stack and grow |
| Cache | One entry **per page** (key includes `page`) | **One** entry holding all loaded pages |
| Memory | Bounded (old pages GC'd when inactive) | Grows with scroll — **must** virtualize |
| Good for | Admin tables, "page 1..n" | Activity feeds, chat, "load more" |

## Paged tables with `keepPreviousData`

Put every param that changes the result in the key (the cardinal rule from [02-query-keys.md](./02-query-keys.md)), and use `placeholderData: keepPreviousData` so the previous page stays on screen — no spinner flash — while the next streams in.

```tsx
import { useQuery, keepPreviousData } from "@tanstack/react-query";

function OrdersTable() {
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const q = useQuery({
    queryKey: ["orders", "list", { page, pageSize }],
    queryFn: ({ signal }) => listResource("orders", { page, pageSize }, signal),
    placeholderData: keepPreviousData,   // ← v5: a function, replaces v4's keepPreviousData: true
    staleTime: 30_000,
  });

  const totalPages = q.data ? Math.ceil(q.data.meta.count / pageSize) : 0;

  return (
    <div style={{ opacity: q.isPlaceholderData ? 0.6 : 1 }}>  {/* dim while showing old page */}
      <Table rows={q.data?.data ?? []} />
      <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
      <span>Page {page} / {totalPages}</span>
      <button
        disabled={q.isPlaceholderData || page >= totalPages}
        onClick={() => setPage((p) => p + 1)}
      >Next</button>
    </div>
  );
}
```

Why `isPlaceholderData` matters on the Next button: while it's `true`, `q.data` is still the *old* page, so `page >= totalPages` is computed against stale totals. Disabling Next until real data lands prevents overshooting the last page.

### Prefetch the next page

Because each page is its own cache entry, you can warm the next one before the user clicks:

```tsx
useEffect(() => {
  if (!q.isPlaceholderData && page < totalPages) {
    qc.prefetchQuery({
      queryKey: ["orders", "list", { page: page + 1, pageSize }],
      queryFn: ({ signal }) => listResource("orders", { page: page + 1, pageSize }, signal),
    });
  }
}, [q.isPlaceholderData, page, totalPages, qc]);
```

## Infinite scroll with `useInfiniteQuery`

`useInfiniteQuery` keeps all loaded pages under **one** key. You define how to derive the next page param from the last page.

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";

function useInfiniteOrders(filter?: object) {
  return useInfiniteQuery({
    queryKey: ["orders", "infinite", { filter }],
    queryFn: ({ pageParam, signal }) =>
      listResource("orders", { page: pageParam, pageSize: 50, filter }, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      const loaded = allPages.length * lastPage.meta.pageSize;
      return loaded < lastPage.meta.count ? lastPageParam + 1 : undefined; // undefined → no more pages
    },
    // getPreviousPageParam: (firstPage, _all, firstPageParam) => firstPageParam > 1 ? firstPageParam - 1 : undefined,
  });
}
```

The result shape is paged:

```tsx
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteOrders(filter);

// data.pages       → array of page responses
// data.pageParams  → array of the params used for each page
const rows = data?.pages.flatMap((p) => p.data) ?? [];
```

Returning `undefined` from `getNextPageParam` is the signal that there's nothing more — it sets `hasNextPage` to `false`. **`getNextPageParam` runs on every render**, so keep it cheap and pure.

### Cursor-based backends

If your Resource API returns a cursor instead of page numbers, the param is the cursor:

```tsx
initialPageParam: null as string | null,
getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
queryFn: ({ pageParam, signal }) =>
  listResource("orders", { cursor: pageParam, limit: 50 }, signal),
```

Cursor pagination is more robust than offset pagination for live data — offsets shift when rows are inserted/deleted between fetches, causing skipped or duplicated rows. Prefer cursors when the backend supports them.

### Trigger loading at the bottom (IntersectionObserver)

```tsx
const sentinelRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const el = sentinelRef.current;
  if (!el) return;
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
  });
  io.observe(el);
  return () => io.disconnect();
}, [hasNextPage, isFetchingNextPage, fetchNextPage]);
// ...render <div ref={sentinelRef} /> after the list
```

## Infinite + virtualization is mandatory

`useInfiniteQuery` **accumulates** every loaded page in memory and hands you one flat list. Render that directly and you'll mount thousands of DOM nodes and choke the main thread. Always pair it with a windowing library (`@tanstack/react-virtual`):

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

const rows = data?.pages.flatMap((p) => p.data) ?? [];
const parentRef = useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({
  count: hasNextPage ? rows.length + 1 : rows.length, // +1 sentinel row to trigger next page
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48,
  overscan: 8,
});

// In the row renderer: if the virtual row index is past rows.length, it's the sentinel → fetchNextPage()
```

See [../state-management-performance/07-rendering-performance.md](../state-management-performance/07-rendering-performance.md) for the full virtualization treatment.

### Cap memory with `maxPages`

For very long infinite lists, v5's `maxPages` bounds how many pages stay cached, dropping from the far end as the user scrolls. Combine with both `getNextPageParam` **and** `getPreviousPageParam` so dropped pages can be re-fetched when the user scrolls back:

```tsx
useInfiniteQuery({
  ...,
  maxPages: 5,                 // keep at most 5 pages in the cache
  getNextPageParam,
  getPreviousPageParam,        // required for maxPages to be able to refill backwards
});
```

Continue to [05-mutations-optimistic.md](./05-mutations-optimistic.md).
