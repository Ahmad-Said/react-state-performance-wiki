# Orval — OpenAPI → Typed Client & React Query Hooks

[Orval](https://orval.dev/) generates a **fully typed client** — and, optionally, **TanStack Query hooks**, **MSW mocks**, and **Zod schemas** — directly from an **OpenAPI specification** (`openapi.json` / `swagger.json` / YAML). You stop hand-writing fetchers, query keys, and response types; they're derived from the contract and regenerated whenever the API changes.

This folder is the companion to the [TanStack Query deep dive](../tanstack-react-query/README.md): Orval produces exactly the kind of keyed, typed `useQuery`/`useMutation` hooks that wiki teaches you to use well.

## Contents

| File | Topic |
| --- | --- |
| [01-what-is-orval.md](./01-what-is-orval.md) | What Orval is, what it generates, and when to reach for it |
| [02-setup-config.md](./02-setup-config.md) | Install, `orval.config.ts`, input/output, and output **modes** |
| [03-react-query-output.md](./03-react-query-output.md) | The generated React Query hooks, query keys, and `override.query` |
| [04-custom-http-client.md](./04-custom-http-client.md) | The **mutator**: auth, base URL, error handling, the Resource API |
| [05-mocks-and-zod.md](./05-mocks-and-zod.md) | MSW + Faker mocks and Zod runtime validation |
| [06-workflow-ci.md](./06-workflow-ci.md) | Scripts, watch mode, CI drift checks, versioning, and gotchas |

## TL;DR

- **The spec is the source of truth.** Point Orval at your `openapi.json`; it emits types, a client, and (with `client: 'react-query'`) hooks + query-key generators.
- **`mode: 'tags-split'`** gives a clean folder-per-tag layout that scales to large APIs.
- **Bring your own HTTP client** via `override.mutator` — one place for auth headers, base URL, and error normalization.
- **Generated code is build output.** Treat it like compiled artifacts: regenerate on spec change, and add a CI check that it's in sync.
- **It pairs with, doesn't replace, the React Query knowledge** in [../tanstack-react-query/](../tanstack-react-query/) — you still own `staleTime`, invalidation strategy, and optimistic updates.

> Scope note: Orval needs a valid **OpenAPI 3.x** (or Swagger 2.0) document. If your backend doesn't publish one, see [06-workflow-ci.md](./06-workflow-ci.md) for the options (generate it, or stay hand-rolled).
