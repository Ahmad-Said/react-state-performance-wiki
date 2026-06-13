# State Management & Performance Wiki

This wiki has two parts:

## 📚 [state-management-performance/](./state-management-performance/) — the broad picture

How to handle **large data sets** from a **Resource API** in **external React clients**, comparing the tools teams reach for — **React Query (TanStack Query)**, **Redux (Toolkit + RTK Query)**, and **Zustand** — plus the rendering and transport techniques that keep an app responsive as data grows.

Start at [state-management-performance/README.md](./state-management-performance/README.md).

## 🔬 [tanstack-react-query/](./tanstack-react-query/) — the deep dive

A focused, end-to-end guide to **TanStack Query (React Query) v5**: the cache model, query keys, the freshness lifecycle, pagination, mutations, invalidation strategy, SSR/hydration, Suspense, testing, and performance tuning.

Start at [tanstack-react-query/README.md](./tanstack-react-query/README.md).

## 🔭 [software-patterns-observable/](./software-patterns-observable/) — the pattern underneath

Why `useState`, Zustand, Redux, and React Query are all the **same idea** in different clothes: the **Observer / Observable** design pattern. Builds a minimal observable store from scratch and wires it into React with `useSyncExternalStore` — the same code that runs on the **Observable Pattern** page of the POC app.

Start at [software-patterns-observable/README.md](./software-patterns-observable/README.md).

## ⚙️ [orval-openapi-codegen/](./orval-openapi-codegen/) — generate the client

Stop hand-writing fetchers, types, and query keys. [Orval](https://orval.dev/) generates a **typed client and React Query hooks** straight from an **OpenAPI spec**, plus MSW mocks and Zod validators — all kept in sync with the API contract.

Start at [orval-openapi-codegen/README.md](./orval-openapi-codegen/README.md).

---

> **Which do I read?** If you're choosing a tool or architecting the data layer, read the broad picture first. If you've already committed to React Query and want to use it well, go to the deep dive. If you have an OpenAPI spec and want the client generated for you, see the Orval section — then use the deep dive for the caching/invalidation *policy* Orval can't decide for you.
