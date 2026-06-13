# 09 · Testing

Test React Query code the way it runs: with a **real `QueryClient`** and a **mocked network** (MSW). Don't mock React Query itself — mock the HTTP layer beneath your `queryFn` and let the real cache machinery run.

## Test setup essentials

Create a fresh `QueryClient` per test and turn off retries (otherwise an "error" test waits through three backoff delays before the error surfaces).

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";

function makeTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },   // no retries; keep cache for assertions
      mutations: { retry: false },
    },
  });
}

function renderWithClient(ui: React.ReactNode, client = makeTestClient()) {
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}
```

> **A fresh client per test** prevents one test's cache from leaking into the next. A shared client is a classic source of flaky, order-dependent tests.

## Mock the network with MSW, not the fetcher

MSW intercepts real HTTP, so your actual `queryFn` (including the `res.ok` throw logic) runs and is covered.

```tsx
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.get("/api/orders\\:list", () =>
    HttpResponse.json({ data: [{ id: "1", status: "open" }], meta: { count: 1 } }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Testing a query

Assert through the UI with `findBy*` (which retries until the async data lands) — no manual waiting on `isLoading`.

```tsx
import { screen } from "@testing-library/react";

test("renders orders from the API", async () => {
  renderWithClient(<OrdersTable />);
  expect(await screen.findByText("open")).toBeInTheDocument();   // findBy* awaits the fetch
});

test("shows an error when the list fails", async () => {
  server.use(http.get("/api/orders\\:list", () => new HttpResponse(null, { status: 500 })));
  renderWithClient(<OrdersTable />);
  expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
});
```

## Testing a hook in isolation

Use `renderHook` with the same provider wrapper, and `waitFor` on the result.

```tsx
import { renderHook, waitFor } from "@testing-library/react";

test("useOrders returns data", async () => {
  const client = makeTestClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useOrders({ page: 1, pageSize: 50 }), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.data).toHaveLength(1);
});
```

## Testing mutations & optimistic updates

Drive the mutation, then assert the cache (or UI) reflects the optimistic value *before* the request resolves, and the reconciled value after. Use an MSW handler with a delay to observe the optimistic window.

```tsx
import { delay } from "msw";

test("optimistically flips status, then reconciles", async () => {
  server.use(
    http.post("/api/orders/1\\:update", async () => {
      await delay(50);                                  // window to observe the optimistic state
      return HttpResponse.json({ id: "1", status: "shipped" });
    }),
  );

  const { client } = renderWithClient(<OrderRow id="1" />);
  // seed the detail cache so the row has a starting value
  client.setQueryData(orderKeys.detail("1"), { id: "1", status: "open" });

  await userEvent.click(screen.getByRole("button", { name: /ship/i }));

  // optimistic value is visible immediately
  expect(screen.getByText("shipped")).toBeInTheDocument();
  // and it sticks after the server confirms
  await waitFor(() =>
    expect(client.getQueryData(orderKeys.detail("1"))).toMatchObject({ status: "shipped" }),
  );
});

test("rolls back on mutation failure", async () => {
  server.use(http.post("/api/orders/1\\:update", () => new HttpResponse(null, { status: 500 })));
  const { client } = renderWithClient(<OrderRow id="1" />);
  client.setQueryData(orderKeys.detail("1"), { id: "1", status: "open" });

  await userEvent.click(screen.getByRole("button", { name: /ship/i }));
  await waitFor(() =>
    expect(client.getQueryData(orderKeys.detail("1"))).toMatchObject({ status: "open" }), // rolled back
  );
});
```

## Practical guidance

- **Silence expected error logs.** Error tests trip React Query's console error; quiet it per-test rather than globally so real errors still show.
- **Prefer asserting UI over cache internals.** `findByText` survives refactors that `getQueryData` assertions don't. Reach into the cache only when testing cache logic specifically (like the optimistic case above).
- **Don't test React Query's behavior** (that staleTime works, that it dedupes) — that's the library's job. Test *your* keys, *your* `queryFn` error handling, and *your* optimistic/rollback logic.
- **Reset handlers between tests** (`afterEach(() => server.resetHandlers())`) so a per-test `server.use(...)` override doesn't bleed forward.

Continue to [10-performance.md](./10-performance.md).
