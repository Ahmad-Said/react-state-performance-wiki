# TanStack Query (React Query) — Deep Dive

A focused, end-to-end guide to using **TanStack Query v5** well in an external React client talking to a Resource API. This goes beyond the overview in [../state-management-performance/03-react-query.md](../state-management-performance/03-react-query.md) — it's the reference you reach for once you've committed to React Query.

## Contents

| File | Topic |
| --- | --- |
| [01-mental-model.md](./01-mental-model.md) | What the cache *is*, observers, the data flow, and the vocabulary |
| [02-query-keys.md](./02-query-keys.md) | Query keys, hashing, key factories, and partial matching |
| [03-caching-lifecycle.md](./03-caching-lifecycle.md) | `staleTime` vs `gcTime`, fetch states, refetch triggers, structural sharing |
| [04-pagination-infinite.md](./04-pagination-infinite.md) | Paginated lists, `keepPreviousData`, `useInfiniteQuery`, bidirectional scroll |
| [05-mutations-optimistic.md](./05-mutations-optimistic.md) | `useMutation`, optimistic updates, rollback, and the cache-vs-invalidate choice |
| [06-invalidation.md](./06-invalidation.md) | Invalidation strategy, `setQueryData`, refetch control, and avoiding storms |
| [07-ssr-hydration.md](./07-ssr-hydration.md) | Prefetch + `dehydrate`/`HydrationBoundary`, Next.js App Router, streaming |
| [08-suspense-error.md](./08-suspense-error.md) | `useSuspenseQuery`, Suspense boundaries, and error boundaries |
| [09-testing.md](./09-testing.md) | Testing queries and mutations with a real `QueryClient` + MSW |
| [10-performance.md](./10-performance.md) | `select`, tracked properties, render isolation, prefetch, profiling |

> **Tired of writing these hooks by hand?** If you have an OpenAPI spec, [Orval](../orval-openapi-codegen/README.md) generates the typed `useQuery`/`useMutation` hooks and query keys for you — then you apply the policy taught here.

## Conventions used here

- **v5 API.** All examples use TanStack Query v5 (object form of every hook, `gcTime`, `keepPreviousData` as a function, etc.). v4 differences are flagged inline where they bite.
- **TypeScript-first**, since most of the value is in the types.
- **Resource API shape.** Examples assume a NocoBase-style backend: `listResource("orders", params)` returns `{ data: Order[], meta: { count, page, pageSize } }`. The patterns transfer to any paginated REST resource.

## The one-paragraph summary

React Query is a **cache for asynchronous server state**, keyed by serializable **query keys**. It dedupes in-flight requests, serves stale data instantly while revalidating in the background, and gives you a small, sharp API for keeping that cache correct after writes (`invalidateQueries`, `setQueryData`). You get the most out of it by (1) putting *every* input that changes the result into the key, (2) tuning `staleTime` per data type instead of globally, and (3) keeping components subscribed to the smallest slice they need.
