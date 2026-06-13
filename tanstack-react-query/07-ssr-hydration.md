# 07 · SSR & Hydration

Server rendering with React Query means: fetch on the server, **serialize** the cache, ship it, and **rehydrate** it on the client so the same queries don't refetch on load. The mechanism is `dehydrate` → `HydrationBoundary`.

## The core mechanism (framework-agnostic)

```tsx
// SERVER: create a fresh client per request, prefetch, dehydrate
import { QueryClient, dehydrate } from "@tanstack/react-query";

async function render(req) {
  const queryClient = new QueryClient();              // ⚠️ per-request, never shared across requests
  await queryClient.prefetchQuery(orderQueries.list(params));
  const dehydratedState = dehydrate(queryClient);     // serializable snapshot of the cache
  // ...renderToString(<App />), then embed dehydratedState in the HTML payload
}
```

```tsx
// CLIENT: rehydrate into the browser's client
import { HydrationBoundary, QueryClientProvider } from "@tanstack/react-query";

<QueryClientProvider client={browserQueryClient}>
  <HydrationBoundary state={dehydratedState}>
    <App />   {/* useQuery(orderQueries.list(params)) finds the data already cached → no fetch */}
  </HydrationBoundary>
</QueryClientProvider>
```

The contract: the component calls the **same `queryOptions`** (same key) it would client-side. Hydration pre-fills that key, so the first render has data and no loading flash.

## Two rules that prevent the classic SSR bugs

1. **A fresh `QueryClient` per request on the server.** A module-level singleton on the server leaks one user's data into another's response — a serious cross-request data bleed. On the *client*, the opposite: one stable client for the app's lifetime.

2. **Set a non-zero `staleTime`** (globally or per query). With the default `staleTime: 0`, the just-hydrated data is *immediately* stale, so the client refetches it on mount — defeating the entire point of SSR. A small `staleTime` (even a few seconds) makes hydrated data count as fresh on arrival.

```tsx
new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });
```

## Next.js App Router (RSC)

The current recommended pattern uses a per-request server client and a singleton browser client, with `HydrationBoundary` per route.

```tsx
// app/get-query-client.ts
import { QueryClient, isServer } from "@tanstack/react-query";

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });
}
let browserClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) return makeClient();           // always fresh on the server
  return (browserClient ??= makeClient());     // reuse one on the client
}
```

```tsx
// app/orders/page.tsx  (Server Component)
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "../get-query-client";

export default async function OrdersPage() {
  const qc = getQueryClient();
  await qc.prefetchQuery(orderQueries.list({ page: 1, pageSize: 50 }));
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <OrdersTable />   {/* "use client" component that calls useQuery(orderQueries.list(...)) */}
    </HydrationBoundary>
  );
}
```

The provider that wraps the app stays a client component:

```tsx
// app/providers.tsx
"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "./get-query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();  // singleton on client via getQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

> **Don't `useState(() => new QueryClient())` in the provider for the App Router.** The `getQueryClient()` + `isServer` pattern is what the maintainers recommend now; it avoids both the cross-request leak and re-creating the client on every Suspense suspension during streaming.

## Streaming SSR — skip the await

With React's streaming, you don't have to `await` prefetch on the server. Kick off the fetch (no await) and let `useSuspenseQuery` on the client suspend; the dehydrated in-flight query streams in as it resolves. Combine with `@tanstack/react-query-next-experimental`'s streaming integration where available.

```tsx
const qc = getQueryClient();
qc.prefetchQuery(orderQueries.list(params)); // no await → don't block the response
return (
  <HydrationBoundary state={dehydrate(qc)}>
    <Suspense fallback={<TableSkeleton />}>
      <OrdersTable />
    </Suspense>
  </HydrationBoundary>
);
```

For `dehydrate` to include not-yet-resolved queries, allow pending dehydration:

```tsx
new QueryClient({ defaultOptions: { dehydrate: { shouldDehydrateQuery: (q) =>
  defaultShouldDehydrateQuery(q) || q.state.status === "pending" } } });
```

## Route-loader prefetch (TanStack Router / React Router)

Outside RSC, prefetch in the route loader so data is ready before the component renders. `ensureQueryData` returns the data and caches it:

```tsx
// TanStack Router
export const Route = createFileRoute("/orders")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(orderQueries.list({ page: 1, pageSize: 50 })),
  component: OrdersTable,
});
```

Continue to [08-suspense-error.md](./08-suspense-error.md).
