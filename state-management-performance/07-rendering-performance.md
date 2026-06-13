# 07 · Rendering Performance

Even with perfect data fetching and caching, the browser still has to *render*. With large data sets the render path is usually the real bottleneck. These techniques are independent of which state library you chose.

## 1. Virtualize long lists (the biggest win)

Render only the rows visible in the viewport (plus a small overscan), not all 5,000.

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

function OrderList({ rows }: { rows: Order[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,   // row height in px
    overscan: 8,
  });

  return (
    <div ref={parentRef} style={{ height: 600, overflow: "auto" }}>
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map((vi) => (
          <div
            key={rows[vi.index].id}
            style={{ position: "absolute", top: 0, transform: `translateY(${vi.start}px)`, height: vi.size, width: "100%" }}
          >
            <Row order={rows[vi.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Libraries: `@tanstack/react-virtual`, `react-window`, `react-virtuoso`. Virtualization pairs naturally with `useInfiniteQuery` / RTK Query merged pages — fetch a page when the user scrolls near the end.

## 2. Memoize rows

A virtualized list still re-creates row elements. Memoize so unchanged rows skip re-render:

```tsx
const Row = React.memo(function Row({ order }: { order: Order }) {
  return <div className="row">{order.id} · {order.status} · {order.total}</div>;
});
```

This only works if the `order` reference is stable. React Query's structural sharing and a normalized `byId` store both preserve references for unchanged rows — that's why they matter for performance, not just correctness.

## 3. Keep selectors and subscriptions narrow

- Zustand: select single fields, use `useShallow` for groups (file 05).
- Redux: memoized `reselect` selectors (file 04).
- React Query: `select` to subscribe to a trimmed shape; `notifyOnChangeProps: "tracked"`.

A component that subscribes to the whole store/store-slice re-renders on every unrelated change. With large data, that's death by a thousand renders.

## 4. Stabilize callbacks and derived data

```tsx
const onSelect = useCallback((id: number) => toggleSelect(id), [toggleSelect]);
const sorted = useMemo(() => [...rows].sort(byDate), [rows]);
```

Passing a fresh inline `() => ...` to thousands of memoized rows defeats the memoization.

## 5. Defer non-urgent updates

For type-to-filter over big lists, keep the input snappy and let the heavy list lag a frame:

```tsx
const deferredFilter = useDeferredValue(filter);
// feed deferredFilter to the query / the filtered view
// useTransition() similarly marks expensive state updates non-urgent
```

## 6. Avoid layout thrash & heavy cells

- Fixed/estimated row heights let the virtualizer avoid measuring every row.
- Lazy-load images and heavy cell content; render plain text first.
- Avoid inline style objects and inline functions in hot rows (new references each render).

## 7. Measure before and after

- **React DevTools Profiler** — find which components re-render and why ("Why did this render?").
- **Network tab** — payload sizes, request counts, `304`s, waterfalls.
- **Performance panel** — long tasks, scripting vs. layout vs. paint.

Optimize what the profiler shows, not what you assume. The checklist in [08-checklist.md](./08-checklist.md) ties it together.
