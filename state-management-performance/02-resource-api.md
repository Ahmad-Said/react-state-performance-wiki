# 02 · Talking to the Resource API

The cheapest performance optimization is **not transferring data you won't use**. Everything in this file happens before React state management is even involved.

A NocoBase-style Resource API exposes actions per collection:

```
GET  /api/<collection>:list
GET  /api/<collection>:get
POST /api/<collection>:create
POST /api/<collection>:update
POST /api/<collection>:destroy
```

## 1. Always paginate

Never call `:list` without bounds. Use `page` + `pageSize`, and read the total from the response meta.

```http
GET /api/orders:list?page=1&pageSize=50
```

```jsonc
{
  "data": [ /* 50 rows */ ],
  "meta": { "count": 18452, "page": 1, "pageSize": 50, "totalPage": 370 }
}
```

For very large or append-only feeds, prefer **cursor / keyset pagination** over offset pagination — `page=370` forces the DB to scan and discard 18,450 rows. If the API supports filtering by a sortable key, page with `filter[id][$gt]=<lastSeenId>` instead.

## 2. Project fields — fetch only the columns you render

```http
GET /api/orders:list?fields=id,status,total,createdAt&page=1&pageSize=50
```

Excluding a few large text/JSON columns can cut payload size by an order of magnitude. Use `appends` deliberately for relations — each append is a join.

```http
# fetch order rows plus only the customer's name, nothing else from customer
GET /api/orders:list?fields=id,total&appends=customer&fields=customer.name
```

## 3. Filter on the server

Push predicates to the backend with the filter operators:

```http
GET /api/orders:list?filter[status][$eq]=paid&filter[total][$gt]=100
```

```js
// Building filters in JS
const filter = {
  $and: [
    { status: { $eq: "paid" } },
    { createdAt: { $dateAfter: "2026-01-01" } },
  ],
};
const qs = `filter=${encodeURIComponent(JSON.stringify(filter))}`;
```

Filtering client-side over a giant array is the classic anti-pattern: you paid to transfer rows you immediately throw away, and you re-run the filter on every render.

## 4. Aggregate on the server

If you need a count, a sum, or a grouped breakdown for a chart, ask the API to compute it. Don't pull 100k rows to `reduce()` them in the browser. Use the aggregation endpoints / `:list` with grouping where available.

## 5. Batch and debounce requests

- **Debounce** search-as-you-type filters (≈300 ms) so keystrokes don't each fire a request.
- **Cancel** in-flight requests when params change — `AbortController`. React Query and RTK Query do this for you.
- **Coalesce** many `:get` calls into one `:list` with `filter[id][$in]=...` where possible.

## 6. Compression & transport

- Ensure the server sends `Content-Encoding: gzip`/`br`. A JSON list compresses extremely well.
- Use HTTP caching headers (`ETag`, `Cache-Control`) so unchanged pages return `304`.
- Keep connections warm (HTTP/2) so many small parallel requests aren't expensive.

## A reusable fetcher

```ts
// resourceApi.ts
const BASE = "https://app.example.com/api";

export async function listResource<T>(
  collection: string,
  params: {
    page?: number;
    pageSize?: number;
    fields?: string[];
    appends?: string[];
    filter?: Record<string, unknown>;
    sort?: string[];
  } = {},
  signal?: AbortSignal,
): Promise<{ data: T[]; meta: { count: number; page: number; pageSize: number } }> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.fields) qs.set("fields", params.fields.join(","));
  if (params.appends) qs.set("appends", params.appends.join(","));
  if (params.sort) qs.set("sort", params.sort.join(","));
  if (params.filter) qs.set("filter", JSON.stringify(params.filter));

  const res = await fetch(`${BASE}/${collection}:list?${qs}`, {
    signal,
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`${collection}:list failed (${res.status})`);
  return res.json();
}
```

This `listResource` is the single function every state-management layer below will call. Continue to [03-react-query.md](./03-react-query.md).
