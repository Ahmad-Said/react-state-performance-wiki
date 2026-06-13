# 03 · The React Query Output

With `client: 'react-query'`, Orval emits, for each operation: a typed request function, a query-key generator, and a hook. This page is about *using* that output well — and where it hands off to the [TanStack Query deep dive](../tanstack-react-query/README.md).

## What you get per operation

For `GET /orders` (operationId `listOrders`) and `POST /orders` (`createOrder`):

```ts
// generated (simplified)
export const listOrders = (params, options) => http<OrderListResponse>({ url: "/orders", method: "GET", params }, options);
export const getListOrdersQueryKey = (params) => ["/orders", ...(params ? [params] : [])] as const;
export const useListOrders = (params, options) => useQuery({
  queryKey: options?.query?.queryKey ?? getListOrdersQueryKey(params),
  queryFn: ({ signal }) => listOrders(params, { signal, ...options?.request }),
  ...options?.query,
});

export const createOrder = (body, options) => http<Order>({ url: "/orders", method: "POST", data: body }, options);
export const useCreateOrder = (options) => useMutation({
  mutationFn: ({ data }) => createOrder(data),
  ...options?.mutation,
});
```

Naming convention: `use<OperationId>` for hooks, `get<OperationId>QueryKey` for keys, and the bare `<operationId>` for the request function. Clean `operationId`s in the spec → clean names here.

## Using a generated query hook

The hook takes the operation params plus an `options` object that **passes straight through to `useQuery`** — so everything from the deep dive applies:

```tsx
import { useListOrders } from "@/api/generated/orders/orders";

function OrdersTable() {
  const [page, setPage] = useState(1);
  const q = useListOrders(
    { page, pageSize: 50 },
    {
      query: {
        staleTime: 30_000,                 // your caching policy — see ../tanstack-react-query/03
        placeholderData: keepPreviousData, // smooth pagination — see ../tanstack-react-query/04
        select: (res) => res.data,         // render isolation — see ../tanstack-react-query/10
      },
    },
  );
  // q is a normal UseQueryResult<Order[]> — isPending, isError, data, etc.
}
```

The `options.query` object is the full `useQuery` options surface; `options.request` (or axios options) reaches the HTTP layer. You don't lose any React Query capability by generating.

## Using a generated mutation hook

```tsx
import { useCreateOrder, getListOrdersQueryKey } from "@/api/generated/orders/orders";

function NewOrderButton() {
  const qc = useQueryClient();
  const create = useCreateOrder({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListOrdersQueryKey() }),
    },
  });
  return <button onClick={() => create.mutate({ data: { customerId } })}>Create</button>;
}
```

Note you **reuse the generated key generator** (`getListOrdersQueryKey`) for invalidation — that's the whole point: the key the query registers under and the key you invalidate are guaranteed to match. See [../tanstack-react-query/06-invalidation.md](../tanstack-react-query/06-invalidation.md) for strategy.

## `override.query` — control what's generated

Set globally in `output.override.query`, or per-endpoint in `override.operations[id].query`:

```ts
override: {
  query: {
    useQuery: true,              // generate standard query hooks
    useMutation: true,           // generate mutation hooks
    useInfinite: true,           // also generate useInfiniteQuery hooks
    useInfiniteQueryParam: "cursor", // which param Orval increments for pages
    useSuspenseQuery: true,      // also generate useSuspenseQuery variants
    useSuspenseInfiniteQuery: true,
    signal: true,                // forward AbortSignal to the request (recommended)
    useSetQueryData: true,       // emit type-safe setQueryData helpers
    useGetQueryData: true,       // emit type-safe getQueryData helpers
    options: { staleTime: 10_000 }, // default useQuery options baked into every hook
  },
}
```

Key ones:

- **`useInfinite` + `useInfiniteQueryParam`** — generates `useListOrdersInfinite` wired for `useInfiniteQuery`, incrementing the named param. Pair with virtualization, exactly as in [../tanstack-react-query/04-pagination-infinite.md](../tanstack-react-query/04-pagination-infinite.md).
- **`useSuspenseQuery`** — generates suspense variants (`useListOrdersSuspense`) whose `data` is non-nullable; wrap them in boundaries per [../tanstack-react-query/08-suspense-error.md](../tanstack-react-query/08-suspense-error.md).
- **`signal: true`** — forwards the `AbortSignal` so superseded requests cancel. Turn it on.
- **`options`** — default `useQuery` options applied to every generated hook (a global `staleTime`, etc.). Per-call `options.query` still overrides.

### Per-operation overrides

Only some endpoints should be infinite or suspense — target them by `operationId`:

```ts
override: {
  operations: {
    listOrders: { query: { useInfinite: true, useInfiniteQueryParam: "cursor" } },
    getOrder:   { query: { useSuspenseQuery: true } },
  },
}
```

## Cache helpers: `useSetQueryData` / `useGetQueryData`

With these enabled, Orval emits type-safe accessors so you don't hand-type cache reads/writes:

- `useGetQueryData` → typed reader (wraps `getQueryData` with the operation's response type).
- `useSetQueryData` → typed writer (uses `setQueriesData` to patch matching entries).

Handy for optimistic updates where you'd otherwise cast `getQueryData<Order>(...)` manually. The discipline is still yours — see the optimistic pattern in [../tanstack-react-query/05-mutations-optimistic.md](../tanstack-react-query/05-mutations-optimistic.md).

## What Orval does *not* decide for you

Generation gives you correct, typed plumbing. It deliberately leaves the **policy** to you:

- **Caching:** the generated hook's default `staleTime`/`gcTime` are whatever you set in `options` — tune per data type ([03-caching-lifecycle](../tanstack-react-query/03-caching-lifecycle.md)).
- **Invalidation graph:** which lists to invalidate after which mutation is domain knowledge ([06-invalidation](../tanstack-react-query/06-invalidation.md)).
- **Optimism & rollback:** generated hooks don't add optimistic logic; you supply `onMutate`/`onError` ([05-mutations](../tanstack-react-query/05-mutations-optimistic.md)).
- **Render performance:** `select`, tracked props, virtualization are your call ([10-performance](../tanstack-react-query/10-performance.md)).

Continue to [04-custom-http-client.md](./04-custom-http-client.md).
