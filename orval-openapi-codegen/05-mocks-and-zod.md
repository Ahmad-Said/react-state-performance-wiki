# 05 · Mocks (MSW + Faker) & Zod Validation

Two of Orval's highest-leverage extras come from the *same* spec you already feed it: **mock handlers** for development/tests and **Zod schemas** for runtime validation. Both stay in sync with the contract for free.

## MSW + Faker mocks

With `mock: true`, Orval generates [Mock Service Worker](https://mswjs.io/) handlers whose responses are filled with [Faker.js](https://fakerjs.dev/) data shaped to your schemas. The UI — and your tests — run against a realistic fake API with no backend.

```ts
// orval.config.ts
output: {
  client: "react-query",
  mock: true,                 // shorthand for MSW + faker
  // or fine-grained:
  // mock: { generators: [{ type: "msw", delay: 500 }, { type: "faker" }] },
}
```

This emits, per file/tag, `get<Operation>MockHandler()` functions and a `get<Tag>Mock()` array of handlers.

### In the browser (dev)

```ts
// src/mocks/browser.ts
import { setupWorker } from "msw/browser";
import { getOrdersMock } from "@/api/generated/orders/orders.msw";

export const worker = setupWorker(...getOrdersMock());
```

```ts
// main.tsx — start the worker only in dev
if (import.meta.env.DEV) {
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}
```

### In tests

This is the exact MSW setup the testing chapter uses — except the handlers are generated, not hand-written:

```ts
import { setupServer } from "msw/node";
import { getOrdersMock } from "@/api/generated/orders/orders.msw";

const server = setupServer(...getOrdersMock());
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

You can still override a single endpoint per test (`server.use(...)`) to drive error/edge cases. See [../tanstack-react-query/09-testing.md](../tanstack-react-query/09-testing.md) for the testing patterns these handlers plug into.

### Customizing mock data

Faker output is random by default. To make a field realistic or deterministic, override the generator per operation:

```ts
override: {
  mock: {
    properties: {
      "/email": () => "test@example.com",   // by JSON path
      "/status": () => "open",
    },
    // seed faker for reproducible runs:
    // arrayMin: 5, arrayMax: 20,
  },
}
```

> Mocks are only as meaningful as your schemas. A response typed as `object`/`any` in the spec produces empty/unhelpful mocks — another reason to keep the spec tight.

## Zod validation

A separate `client: 'zod'` project turns each schema/operation into a Zod validator, giving you **runtime** checks to complement TypeScript's **compile-time** ones. Useful at trust boundaries: validate responses you don't fully trust, or request bodies from forms.

```ts
// orval.config.ts — a second project alongside the react-query one
export default defineConfig({
  api: { input: "./openapi.json", output: { mode: "tags-split", target: "src/api/generated", client: "react-query" } },
  zod: { input: "./openapi.json", output: { mode: "tags-split", target: "src/api/zod",       client: "zod" } },
});
```

Generated Zod schemas (e.g. `listOrdersResponse`) can validate at the edge:

```ts
import { listOrdersResponse } from "@/api/zod/orders/orders.zod";

// In the mutator or a queryFn wrapper, validate untrusted responses:
const parsed = listOrdersResponse.parse(rawJson); // throws → React Query treats it as an error
```

Zod override options worth knowing:

```ts
override: {
  zod: {
    strict: { response: true },  // reject unknown keys in responses
    coerce: { query: true },     // coerce query params (string → number, etc.)
    generate: { param: true, body: true, response: true },
  },
}
```

### When to validate at runtime

Type generation already guarantees the *shape you compiled against*. Zod adds value when reality might diverge from the contract:

- The backend is evolving and you want loud failures, not silent `undefined`s.
- Data crosses a trust boundary (third-party API, user-submitted payloads, `localStorage`).
- You parse external input (URL query strings, webhooks).

For a well-controlled internal API with a trustworthy spec, full response validation on every call is often overkill — apply it selectively where the risk is.

Continue to [06-workflow-ci.md](./06-workflow-ci.md).
