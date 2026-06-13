# 05 · Zustand

Zustand is a tiny (~1 KB) store with a hook-based API and no provider boilerplate. It shines for **client/UI state** — and you can use it for server state too, but you then re-implement caching yourself, so prefer pairing it with React Query for remote data.

## The store

```ts
import { create } from "zustand";

interface OrdersUIState {
  page: number;
  pageSize: number;
  filter: Record<string, unknown>;
  selectedIds: Set<number>;
  setPage: (p: number) => void;
  setFilter: (f: Record<string, unknown>) => void;
  toggleSelect: (id: number) => void;
  clearSelection: () => void;
}

export const useOrdersUI = create<OrdersUIState>((set) => ({
  page: 1,
  pageSize: 50,
  filter: {},
  selectedIds: new Set(),
  setPage: (page) => set({ page }),
  setFilter: (filter) => set({ filter, page: 1 }), // reset to page 1 on new filter
  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { selectedIds: next };
    }),
  clearSelection: () => set({ selectedIds: new Set() }),
}));
```

## Selector discipline is the whole game

The #1 Zustand performance rule: **subscribe to the narrowest slice.** Selecting the whole store re-renders the component on every change.

```tsx
// ❌ re-renders on ANY state change
const state = useOrdersUI();

// ✅ re-renders only when `page` changes
const page = useOrdersUI((s) => s.page);
const setPage = useOrdersUI((s) => s.setPage);
```

For multiple values, use `useShallow` so a new object literal doesn't force a render every time:

```tsx
import { useShallow } from "zustand/react/shallow";

const { page, pageSize } = useOrdersUI(
  useShallow((s) => ({ page: s.page, pageSize: s.pageSize })),
);
```

## Pairing with React Query (recommended)

Zustand owns the **query parameters**; React Query owns the **data** for those parameters. Clean separation, no duplicated cache.

```tsx
function Orders() {
  const { page, pageSize, filter } = useOrdersUI(
    useShallow((s) => ({ page: s.page, pageSize: s.pageSize, filter: s.filter })),
  );
  const { data, isFetching } = useOrders({ page, pageSize, filter }); // the RQ hook from file 03
  // selection lives in Zustand; rows read it with a narrow selector
}
```

## If you must hold server data in Zustand

Sometimes you genuinely want fetched data in the store (e.g. a long-lived editable working set). Then you own caching — be deliberate:

```ts
interface OrdersData {
  byId: Record<number, Order>;   // normalized for O(1) lookup + stable refs
  ids: number[];
  loadPage: (page: number) => Promise<void>;
}

export const useOrdersData = create<OrdersData>((set, get) => ({
  byId: {},
  ids: [],
  loadPage: async (page) => {
    const { data } = await listResource<Order>("orders", { page, pageSize: 50 });
    set((s) => {
      const byId = { ...s.byId };
      for (const o of data) byId[o.id] = o;
      return { byId, ids: [...new Set([...s.ids, ...data.map((o) => o.id)])] };
    });
  },
}));
```

Storing **normalized by id** (not a giant array) keeps lookups O(1) and lets memoized rows keep stable references so they don't re-render when an unrelated row changes.

## Useful middleware

- `persist` — save filters/selection to `localStorage` (avoid persisting large server data).
- `immer` — write "mutating" updates ergonomically.
- `subscribeWithSelector` — react to slice changes outside React (e.g. trigger a prefetch).
- `devtools` — Redux DevTools integration without Redux.

```ts
import { persist } from "zustand/middleware";
export const useOrdersUI = create(persist<OrdersUIState>(/* ... */, { name: "orders-ui" }));
```

## When Zustand is the right call

- You want simple, fast client state without provider/boilerplate.
- You're already using React Query for data and just need UI state.
- You dislike Redux ceremony but need shared state beyond `useState`.

For heavy normalized server state with strict invalidation rules, RTK Query ([04-redux-rtk-query.md](./04-redux-rtk-query.md)) does more for you out of the box.
