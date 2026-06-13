# State Management & Performance Optimization Wiki

Best practices for handling **large data sets** fetched from the **Resource API** (e.g. NocoBase, or any REST-style resource backend) in **external React clients**.

This wiki focuses on the tools most teams reach for — **React Query (TanStack Query)**, **Redux (Toolkit + RTK Query)**, and **Zustand** — and on the rendering/transport techniques that keep an app responsive when the data grows from hundreds to hundreds of thousands of rows.

## Contents

| File | Topic |
| --- | --- |
| [01-overview.md](./01-overview.md) | The problem space, core concepts, and a decision framework |
| [02-resource-api.md](./02-resource-api.md) | Talking to the Resource API: filtering, pagination, fields, batching |
| [03-react-query.md](./03-react-query.md) | React Query / TanStack Query patterns for large data |
| [04-redux-rtk-query.md](./04-redux-rtk-query.md) | Redux Toolkit & RTK Query patterns |
| [05-zustand.md](./05-zustand.md) | Zustand patterns and selector discipline |
| [06-comparison.md](./06-comparison.md) | Side-by-side comparison and how to choose |
| [07-rendering-performance.md](./07-rendering-performance.md) | Virtualization, memoization, and render-time wins |
| [08-checklist.md](./08-checklist.md) | A practical performance checklist |

> **Going all-in on React Query?** Once you've chosen it here, the [TanStack Query deep dive](../tanstack-react-query/README.md) covers keys, caching internals, mutations, invalidation, SSR, Suspense, testing, and performance in depth.

## TL;DR

- **Don't fetch what you can't show.** Page, filter, and project (`fields`) on the server before data ever reaches React.
- **Separate server state from client state.** React Query / RTK Query own the cache of remote data; Redux/Zustand own UI state. Mixing them is the most common source of bugs and stale data.
- **Normalize only when you must.** For read-heavy lists, a query cache keyed by request params beats a hand-rolled normalized store.
- **The render is usually the bottleneck, not the network.** Virtualize long lists and keep selectors narrow.

> Scope note: examples assume a NocoBase-style Resource API (`/api/<collection>:list`, `:get`, `:create`…), but the patterns transfer to any paginated REST resource.
