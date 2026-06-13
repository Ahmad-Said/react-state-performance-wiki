# 08 · Practical Performance Checklist

Use this as a review gate when building or auditing a screen that pulls large data sets from the Resource API.

## Data transport (server side)

- [ ] Every `:list` call is paginated (`page` + `pageSize`); nothing fetches unbounded.
- [ ] Very large / append-only feeds use cursor/keyset pagination, not deep offset paging.
- [ ] `fields` is set to only the columns rendered; heavy text/JSON columns excluded.
- [ ] Relations loaded via `appends` only when needed; each append justified.
- [ ] Filtering and sorting are done on the server, not over fetched arrays.
- [ ] Counts / sums / grouped charts use server aggregation, not client `reduce`.
- [ ] Search inputs are debounced (~300 ms); param changes cancel in-flight requests.
- [ ] Responses are gzip/brotli compressed; `ETag`/`Cache-Control` enabled.

## State management

- [ ] Server state lives in a query cache (React Query / RTK Query), **not** hand-rolled in Redux/Zustand.
- [ ] Client/UI state (filters, selection, modals) is separate from server state.
- [ ] Cache/query keys include **every** parameter that changes the result.
- [ ] Mutations invalidate **only** affected keys/tags, not the entire cache.
- [ ] `staleTime` / `keepUnusedDataFor` tuned per endpoint to cut refetch volume.
- [ ] `keepPreviousData` (RQ) / equivalent used so pagination doesn't flash spinners.
- [ ] `refetchOnWindowFocus` disabled for expensive endpoints.
- [ ] Cross-referenced, frequently-mutated entities are normalized (`byId`); read-only paged tables are not over-normalized.

## Rendering

- [ ] Long lists/tables are virtualized (only visible rows in the DOM).
- [ ] Row components are `React.memo`'d and receive stable references.
- [ ] Selectors/subscriptions are narrow (`useShallow`, `reselect`, RQ `select`).
- [ ] Callbacks (`useCallback`) and derived data (`useMemo`) are stabilized in hot paths.
- [ ] Type-to-filter uses `useDeferredValue` / `useTransition` to keep input responsive.
- [ ] No inline style objects / inline functions inside hot rows.

## Verification

- [ ] React DevTools Profiler checked — no unexpected wide re-renders.
- [ ] Network tab checked — no redundant requests, reasonable payload sizes, `304`s working.
- [ ] Tested with a realistic large data set (not 20 rows), ideally on a throttled CPU/network.

## Quick reference: default stack

> **React Query** (server data) + **Zustand** (UI state) + **@tanstack/react-virtual** (rendering).
> Move to **RTK Query + Redux Toolkit** only if you need a single centralized store or full Redux devtools.

See [06-comparison.md](./06-comparison.md) for the reasoning.
