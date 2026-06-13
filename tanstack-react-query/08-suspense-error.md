# 08 · Suspense & Error Handling

React Query has two ways to surface loading and errors: the **status-flag** style (`isPending`/`isError`) you've seen so far, and the **Suspense** style, where loading and errors are delegated to React boundaries. Pick one model per subtree and stay consistent.

## `useSuspenseQuery` — data is never undefined

With `useSuspenseQuery`, the component *suspends* while loading (handled by a `<Suspense>` boundary above) and *throws* on error (handled by an error boundary above). The win: inside the component, `data` is **guaranteed defined** — no `isPending` branch, no `data?.`.

```tsx
import { useSuspenseQuery } from "@tanstack/react-query";

function OrderDetail({ id }: { id: string }) {
  const { data } = useSuspenseQuery(orderQueries.detail(id));
  return <h1>{data.customerName}</h1>;   // data is Order, not Order | undefined
}
```

Wrap it in the two boundaries:

```tsx
import { ErrorBoundary } from "react-error-boundary";

<ErrorBoundary fallbackRender={({ error, resetErrorBoundary }) => (
  <ErrorView err={error} onRetry={resetErrorBoundary} />
)}>
  <Suspense fallback={<Skeleton />}>
    <OrderDetail id={id} />
  </Suspense>
</ErrorBoundary>
```

Differences from `useQuery` to keep in mind:

- **No `placeholderData` / `keepPreviousData`.** Suspense semantics conflict with showing stale-while-loading; for paginated suspense tables you typically wrap the changing part in its own boundary or use `useQuery` instead.
- **`enabled: false` is not allowed** — a suspense query must be able to run. For conditional fetching, fall back to `useQuery`.
- Errors **throw** rather than landing in `error`, so you *must* have an error boundary or the error propagates up and can crash the tree.

There's also `useSuspenseInfiniteQuery` and `useSuspenseQueries` for the parallel cases.

## Resetting after an error

To make "Retry" work, connect the error boundary to React Query's reset via `QueryErrorResetBoundary`:

```tsx
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

<QueryErrorResetBoundary>
  {({ reset }) => (
    <ErrorBoundary
      onReset={reset}                                  // clears errored queries so they refetch
      fallbackRender={({ resetErrorBoundary }) => (
        <button onClick={resetErrorBoundary}>Retry</button>
      )}
    >
      <Suspense fallback={<Skeleton />}>
        <OrderDetail id={id} />
      </Suspense>
    </ErrorBoundary>
  )}
</QueryErrorResetBoundary>
```

## Routing errors to a boundary from `useQuery` too

Even in status-flag style, you can opt specific queries into throwing (so a shared error boundary handles them) with `throwOnError`:

```tsx
useQuery({
  ...orderQueries.detail(id),
  throwOnError: (error) => error instanceof HttpError && error.status >= 500, // throw 5xx, handle 4xx inline
});
```

This is the sweet spot for many apps: handle *expected* errors (404 "not found", 403 "no access") inline with `isError`, and let *unexpected* errors (500s, network) bubble to a top-level boundary.

## Retry behavior

- Failed queries retry `retry` times (default 3) with exponential backoff (`retryDelay`).
- Set `retry: false` for errors that won't fix themselves (a 404 will 404 again — retrying just delays the error UI).

```tsx
new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof HttpError && error.status < 500) return false; // don't retry 4xx
        return failureCount < 3;
      },
    },
  },
});
```

## Typing errors

The `queryFn` can throw anything, so `error` is `unknown`-ish by default. Register a global error type so `error` is typed everywhere:

```tsx
// react-query.d.ts
import "@tanstack/react-query";
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: HttpError;   // now q.error is HttpError | null app-wide
  }
}
```

Pair this with a `queryFn`/`fetch` wrapper that always throws a typed `HttpError` (carrying `status` and the parsed body) so callers can branch on `error.status` safely. See the `listResource` throw-on-`!res.ok` pattern in [02-query-keys.md](./02-query-keys.md).

## Global side effects (toasts, logging)

For app-wide "show a toast on any mutation error" behavior, attach handlers to the caches rather than every hook:

```tsx
import { QueryCache, MutationCache } from "@tanstack/react-query";

new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined) toast.error(`Background refresh failed: ${error.message}`);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => toast.error(error.message),
  }),
});
```

Note the `query.state.data !== undefined` guard: only toast for *background* failures (data already on screen). First-load errors are better shown inline/by the boundary, not as a toast.

Continue to [09-testing.md](./09-testing.md).
