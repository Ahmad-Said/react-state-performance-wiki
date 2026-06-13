# 04 · The Custom HTTP Client (Mutator)

Out of the box Orval calls Axios or Fetch directly. In any real app you want **one place** for the base URL, auth headers, error normalization, and the `AbortSignal` plumbing. That place is a **mutator**: a function you write, that Orval routes every generated request through.

## Wiring a mutator

```ts
// orval.config.ts
output: {
  client: "react-query",
  httpClient: "axios",
  override: {
    mutator: {
      path: "./src/api/http.ts",  // your file
      name: "http",               // the exported function name
    },
  },
}
```

Every generated request function now calls *your* `http(...)` instead of Axios directly.

## An Axios mutator

```ts
// src/api/http.ts
import Axios, { AxiosRequestConfig } from "axios";

export const instance = Axios.create({
  baseURL: import.meta.env.VITE_API_URL,   // base URL in ONE place
});

// Attach auth on every request
instance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalize errors so React Query sees a consistent, typed error
instance.interceptors.response.use(
  (res) => res,
  (error) => Promise.reject(new HttpError(error)), // see typed-errors note below
);

// This signature is what Orval calls. The `signal` from React Query flows through `config`.
export const http = <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<T> => {
  return instance({ ...config, ...options }).then((r) => r.data);
};

// Orval also references this for the error type in generated hooks:
export type ErrorType<E> = AxiosError<E>;
// And for mutation bodies in some setups:
export type BodyType<B> = B;
```

The mutator **must return the unwrapped data** (`r.data`), because the generated hooks type the result as the response body, not the Axios envelope.

## A Fetch mutator (zero-dependency)

```ts
// src/api/http.ts  (with httpClient: "fetch")
export const http = async <T>(url: string, options: RequestInit): Promise<T> => {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${url}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeader(), ...options.headers },
  });
  if (!res.ok) throw new HttpError(res.status, await safeJson(res)); // MUST throw on !ok — see ../tanstack-react-query/02
  return res.json() as Promise<T>;
};
```

> The throw-on-`!res.ok` rule from [../tanstack-react-query/02-query-keys.md](../tanstack-react-query/02-query-keys.md) lives **here** when you generate. Get it right once in the mutator and every generated query/mutation inherits correct error semantics.

## Why this matters: cross-cutting concerns in one file

Centralizing in the mutator means a single edit propagates to *all* generated operations:

- **Auth** — token injection and refresh-on-401 retry.
- **Base URL** — per-environment, including the `baseUrl: { runtime: ... }` option from [02-setup-config.md](./02-setup-config.md).
- **Error shape** — convert transport errors into one `HttpError` so `error.status` is reliable everywhere. Register it as the global error type ([../tanstack-react-query/08-suspense-error.md](../tanstack-react-query/08-suspense-error.md)) and your retry/throwOnError logic can branch on it.
- **AbortSignal** — React Query passes `signal`; the mutator forwards it so cancelled queries abort their requests (essential for the optimistic-update `cancelQueries` flow in [../tanstack-react-query/05-mutations-optimistic.md](../tanstack-react-query/05-mutations-optimistic.md)).
- **Tracing / logging** — request IDs, timing, Sentry breadcrumbs.

## Non-standard backends (e.g. NocoBase)

A NocoBase-style Resource API uses action endpoints like `/api/orders:list`, `/api/orders:get`, and wraps responses as `{ data, meta }`. Two adjustments:

1. **The spec must describe those endpoints.** Orval only knows what the OpenAPI document says. If NocoBase (or a plugin) emits an OpenAPI doc, point Orval at it; the `:list`/`:get` paths come through as-is.
2. **Unwrap consistently.** If every response is `{ data, meta }`, decide whether the mutator unwraps `data` (losing `meta` — bad for pagination) or returns the envelope. For paginated lists you usually want the envelope, so the generated response types should model `{ data: Order[]; meta: { count } }` — which means the **spec** must declare that shape. Again: the spec drives everything.

If the backend can't emit a usable OpenAPI document, generation isn't the right tool — see the decision in [01-what-is-orval.md](./01-what-is-orval.md) and the options in [06-workflow-ci.md](./06-workflow-ci.md).

## Per-operation mutator override

Rare, but you can route specific operations through a different client (e.g. a file-upload endpoint needing multipart):

```ts
override: {
  operations: {
    uploadAttachment: { mutator: { path: "./src/api/upload-http.ts", name: "uploadHttp" } },
  },
}
```

Continue to [05-mocks-and-zod.md](./05-mocks-and-zod.md).
