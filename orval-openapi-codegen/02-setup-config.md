# 02 · Setup & Configuration

## Install

```bash
npm i -D orval
# peer libs you'll actually use at runtime:
npm i @tanstack/react-query axios   # axios optional — fetch works too
```

Add a script:

```jsonc
// package.json
{
  "scripts": {
    "api:gen": "orval --config ./orval.config.ts"
  }
}
```

## The config file

Orval reads `orval.config.ts` (or `.js`). Use `defineConfig` for typing and autocomplete. Each top-level key is a **named project** — you can generate several clients from one config.

```ts
// orval.config.ts
import { defineConfig } from "orval";

export default defineConfig({
  orders: {
    input: {
      target: "./openapi.json",          // file path OR a URL to the live spec
    },
    output: {
      mode: "tags-split",                // file layout — see below
      target: "src/api/generated",       // where the client/hooks go
      schemas: "src/api/generated/model", // where the TS models go
      client: "react-query",             // generate TanStack Query hooks
      httpClient: "axios",               // 'axios' | 'fetch'
      mock: true,                        // also emit MSW + Faker mocks
      clean: true,                       // wipe target before regenerating
      prettier: true,                    // format the output (or use formatter)
      baseUrl: { runtime: "process.env.NEXT_PUBLIC_API_URL" },
      override: {
        mutator: { path: "./src/api/http.ts", name: "http" }, // custom client — see 04
        query: { useQuery: true, signal: true, useMutation: true },
      },
    },
  },
});
```

Run it:

```bash
npm run api:gen
```

## Input options

`input.target` accepts:

- a **local file**: `"./openapi.json"`, `"./api/openapi.yaml"`,
- a **remote URL**: `"https://api.example.com/openapi.json"` (handy in CI to pull the latest contract).

Useful `input` knobs:

```ts
input: {
  target: "./openapi.json",
  validation: true,           // validate the spec before generating (catches bad specs early)
  filters: {                  // generate only part of a large API
    tags: ["orders", "customers"],
    // mode: "include" | "exclude"
  },
  override: {
    transformer: "./scripts/spec-transform.js", // mutate the spec in-memory before codegen
  },
}
```

`filters` is the escape hatch for huge specs — generate only the tags your app touches instead of thousands of unused operations.

## Output **modes** — pick by API size

`mode` controls the file layout (it affects client files; schemas are governed by `schemas`):

| Mode | Layout | Use when |
| --- | --- | --- |
| `single` *(default)* | Everything in one file | Tiny APIs, demos |
| `split` | `petstore.ts` + `petstore.schemas.ts` + `petstore.msw.ts` | Small/medium, one logical client |
| `tags` | One client file per OpenAPI **tag**, shared schemas file | Medium APIs grouped by tag |
| `tags-split` | A **folder per tag**, each with split files | **Large APIs** — the recommended default |

`tags-split` produces, e.g.:

```
src/api/generated/
├── petstore.schemas.ts
└── pets/
    ├── pets.ts        // hooks + request fns for the "pets" tag
    └── pets.msw.ts    // mocks for the "pets" tag
```

This keeps each feature's generated code next to nothing else, and your bundler tree-shakes the operations you don't import.

> Good `operationId`s and `tags` in the spec are what make this output readable. If hook names come out ugly (`usePost_orders_v2`), fix the spec's `operationId`s, not the generated files.

## `httpClient`: axios vs fetch

For data-fetching libraries (`react-query` et al.), `httpClient` chooses the transport:

- **`fetch`** *(default)* — zero dependency, smaller bundle, works everywhere including edge runtimes.
- **`axios`** — interceptors, richer config, `paramsSerializer` support; familiar if you already use it.

Either way you'll usually supply a **custom mutator** ([04-custom-http-client.md](./04-custom-http-client.md)) so auth and base URL live in one place rather than being baked into generated code.

## Type-generation niceties

```ts
output: {
  // ...
  override: {
    useDates: true,            // OpenAPI date/date-time → JS Date
    useBigInt: true,           // int64/uint64 → BigInt
    enumGenerationType: "union", // 'const' | 'enum' | 'union' — union is usually cleanest in TS
  },
}
```

## Multiple clients from one config

Each named project generates independently — split a public API and an internal admin API, or generate a separate Zod-only project:

```ts
export default defineConfig({
  api:   { input: "./openapi.json", output: { mode: "tags-split", target: "src/api/generated", client: "react-query" } },
  zod:   { input: "./openapi.json", output: { mode: "tags-split", target: "src/api/zod",       client: "zod" } },
});
```

Continue to [03-react-query-output.md](./03-react-query-output.md).
