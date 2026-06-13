# 04 · Redux Toolkit & RTK Query

Reach for Redux when you already have a Redux codebase, when you want a single store with first-class devtools/time-travel, or when complex client state and server state must be coordinated in one place. For the *server-state* half, use **RTK Query** — the data-fetching layer built into Redux Toolkit — rather than hand-writing thunks + reducers.

> Rule of thumb: **RTK Query for remote data, plain RTK slices for client state.** Don't store fetched lists in a slice you mutate by hand; that's the path RTK Query was created to remove.

## Set up the store

```ts
import { configureStore } from "@reduxjs/toolkit";
import { ordersApi } from "./ordersApi";
import uiReducer from "./uiSlice";

export const store = configureStore({
  reducer: {
    [ordersApi.reducerPath]: ordersApi.reducer,
    ui: uiReducer,
  },
  middleware: (gdm) => gdm().concat(ordersApi.middleware),
});
```

## Define the API slice

```ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const ordersApi = createApi({
  reducerPath: "ordersApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "https://app.example.com/api/",
    prepareHeaders: (headers) => {
      headers.set("Authorization", `Bearer ${getToken()}`);
      return headers;
    },
  }),
  tagTypes: ["Order"],
  endpoints: (build) => ({
    listOrders: build.query<
      { data: Order[]; meta: { count: number } },
      { page: number; pageSize: number; filter?: object; sort?: string[] }
    >({
      query: (p) => {
        const qs = new URLSearchParams();
        qs.set("page", String(p.page));
        qs.set("pageSize", String(p.pageSize));
        if (p.sort) qs.set("sort", p.sort.join(","));
        if (p.filter) qs.set("filter", JSON.stringify(p.filter));
        return `orders:list?${qs}`;
      },
      // cache invalidation tags, per-row + the list itself
      providesTags: (res) =>
        res
          ? [...res.data.map((o) => ({ type: "Order" as const, id: o.id })), { type: "Order", id: "LIST" }]
          : [{ type: "Order", id: "LIST" }],
      // keep prior page while next loads
      keepUnusedDataFor: 60,
    }),
    updateOrder: build.mutation<Order, Partial<Order> & { id: number }>({
      query: ({ id, ...body }) => ({ url: `orders:update?filterByTk=${id}`, method: "POST", body }),
      invalidatesTags: (_r, _e, arg) => [{ type: "Order", id: arg.id }],
    }),
  }),
});

export const { useListOrdersQuery, useUpdateOrderMutation } = ordersApi;
```

## Consume in a component

```tsx
function Orders() {
  const [page, setPage] = useState(1);
  const { data, isFetching, isError } = useListOrdersQuery(
    { page, pageSize: 50 },
    { refetchOnMountOrArgChange: false },
  );
  // ...render data?.data, page controls
}
```

The generated hook gives you the same deduping, caching, and loading flags React Query does — keyed automatically on the argument object.

## Tag-based invalidation

RTK Query's invalidation model is **tags**, not keys. A mutation declares which tags it `invalidatesTags`; any query that `providesTags` matching them refetches. Use a per-id tag *and* a `LIST` tag so a single-row edit refetches that row's queries and a create/delete refetches the list.

## Large-data specifics

- **Normalize for cross-referenced entities.** If many views reference the same entities and you mutate them often, use `createEntityAdapter` to store them in a `{ ids, entities }` shape with O(1) lookups and stable references. For read-only paged tables, the default per-request cache is simpler — don't over-normalize.
- **Selectors with `reselect`.** Derive filtered/sorted/aggregated views with memoized selectors so recomputation only happens when inputs change:
  ```ts
  const selectPaidTotal = createSelector(
    [(s) => ordersApi.endpoints.listOrders.select(args)(s)?.data ?? []],
    (orders) => orders.filter((o) => o.status === "paid").reduce((a, o) => a + o.total, 0),
  );
  ```
- **`serializeQueryArgs` / `merge`** — implement infinite scroll by merging incoming pages into one cache entry instead of separate ones.
- **`keepUnusedDataFor`** — RTK Query's equivalent of `gcTime`; tune per endpoint.
- Avoid putting large fetched arrays into a hand-written slice — every dispatch then serializes/diffs the whole array.

## When Redux is the right call

- You already run Redux and want one consistent paradigm.
- You need devtools time-travel, middleware, or strict action auditing.
- Complex client state genuinely benefits from a centralized reducer model.

If you don't have those needs, **React Query + Zustand** is lighter. See [06-comparison.md](./06-comparison.md).
