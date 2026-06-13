# 06 · Workflow, CI & Gotchas

Generated code is **build output**. Treating it like hand-written source — or forgetting it exists — is where teams stumble. This page is the operational playbook.

## Treat generated code as artifacts

Decide one policy and stick to it:

| | Commit generated code | Generate in build/CI |
| --- | --- | --- |
| Pros | Diffs are reviewable; no codegen step to run app | No stale output; smaller repo |
| Cons | Noisy diffs; can go stale; merge conflicts | Build depends on spec availability |
| Recommended for | Most teams (reviewable contract changes) | Monorepos with a tight spec pipeline |

If you commit it: put the output dir behind a clear path (`src/api/generated/`), mark it as generated for code review (`linguist-generated` in `.gitattributes`), and **never hand-edit it** — your changes vanish on the next run. Customize via `override` / the mutator instead.

## The regeneration loop

```jsonc
// package.json
{
  "scripts": {
    "api:gen": "orval --config ./orval.config.ts",
    "api:watch": "orval --watch --config ./orval.config.ts"  // regenerate on spec change
  }
}
```

- **`--watch`** regenerates whenever the input spec changes — pair with a local backend that serves a live `openapi.json`.
- Wire `api:gen` into `postinstall` or a pre-dev step if you generate-on-build rather than committing.

## CI drift check — the single most valuable guardrail

If you commit generated code, add a CI step that regenerates and fails if anything changed. This catches "someone updated the spec but not the client" before it merges.

```yaml
# .github/workflows/api-drift.yml
- run: npm ci
- run: npm run api:gen
- run: git diff --exit-code src/api/generated || (
    echo "::error::Generated API client is out of date. Run 'npm run api:gen' and commit."
    && exit 1
  )
```

Equivalently, `git diff --exit-code` over the output directory after generation.

## Versioning the spec

The spec is a contract — version it deliberately:

- **Pin the spec** you generate against (commit `openapi.json`, or pin a URL to a tagged release). Generating against a moving `/openapi.json` makes builds non-reproducible.
- When the backend ships a breaking change, regenerating surfaces it as **TypeScript errors** — that's the feature. Fix call sites, don't suppress.
- For multiple API versions, use separate named projects ([02-setup-config.md](./02-setup-config.md)) targeting different specs/output dirs.

## "My backend has no OpenAPI spec"

Orval needs OpenAPI 3.x or Swagger 2.0. Options, best to worst:

1. **Backend emits it.** Most frameworks (NestJS, FastAPI, Spring, many NocoBase plugins) can produce an OpenAPI document. Turn it on — this is the right answer.
2. **Generate the spec from code/types** (e.g. tRPC→OpenAPI adapters, `zod-to-openapi`).
3. **Hand-write a spec.** Viable for a small, stable API; becomes a maintenance burden otherwise.
4. **Don't use Orval.** If you'd be hand-maintaining the spec *and* it drifts, you've just moved the boilerplate. Hand-write typed React Query hooks per [../tanstack-react-query/](../tanstack-react-query/) instead.

## Common gotchas

- **Ugly hook names** (`usePOST_orders_2`) → fix `operationId`s in the spec. Orval derives names from them.
- **Hand-edits disappear** → never edit generated files; everything is configurable via `override` or the mutator ([04-custom-http-client.md](./04-custom-http-client.md)).
- **Wrong/empty response types** → the spec under-describes the response (`type: object` with no properties, missing schemas). Fix the spec; the client mirrors it exactly.
- **Pagination metadata lost** → if the mutator unwraps `data`, `meta.count` is gone. Model the envelope `{ data, meta }` in the spec and return it from the mutator ([04](./04-custom-http-client.md)).
- **Huge generated bundle** → use `mode: 'tags-split'` for tree-shaking, and `input.filters.tags` to generate only what you use ([02](./02-setup-config.md)).
- **Mocks look like noise** → seed Faker / override specific properties ([05-mocks-and-zod.md](./05-mocks-and-zod.md)); tighten schema types.
- **Spec fetch flaky in CI** → commit a pinned `openapi.json` rather than fetching a live URL at build time.

## A sane default setup

For a large API with a good spec and a React Query frontend:

```ts
// orval.config.ts
import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: { target: "./openapi.json", validation: true },
    output: {
      mode: "tags-split",
      target: "src/api/generated",
      schemas: "src/api/generated/model",
      client: "react-query",
      httpClient: "axios",
      clean: true,
      prettier: true,
      mock: true,
      baseUrl: { runtime: "process.env.VITE_API_URL" },
      override: {
        mutator: { path: "./src/api/http.ts", name: "http" },
        query: { useQuery: true, useMutation: true, useInfinite: true, signal: true },
        useDates: true,
        enumGenerationType: "union",
      },
    },
  },
});
```

Then own the *policy* — caching, invalidation, optimism, render perf — with the [TanStack Query deep dive](../tanstack-react-query/README.md).

---

Back to the [Orval index](./README.md), or up to the [wiki root](../README.md).
