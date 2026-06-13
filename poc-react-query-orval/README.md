# React Query + Orval — Proof of Concept

A full-stack **concept gallery** showing how to generate a **fully typed React
Query client** from a **FastAPI** backend using **Orval** — and then using those
generated hooks to demonstrate the core ideas of TanStack Query, one page each.

```
poc-react-query-orval/
├── backend/          FastAPI app — source of the OpenAPI schema
│   ├── main.py       Todo CRUD + articles/stats routes that power the demos
│   └── requirements.txt
└── frontend/         Vite + React + React Query + React Router
    ├── orval.config.ts          ← Orval config (reads /openapi.json)
    └── src/
        ├── api/
        │   ├── axios-instance.ts   custom mutator (base URL, interceptors)
        │   └── generated/          ← created by `npm run orval` (do not edit)
        ├── ui/kit.tsx              shared UI primitives (Card, Badge, …)
        ├── pages/                  one page per concept (see gallery below)
        ├── App.tsx                 sidebar + React Router routes
        └── main.tsx                QueryClientProvider + Router + Devtools
```

## Concept gallery

Each page demonstrates one idea using the Orval-generated, fully-typed hooks.

| Page | Concept | Key API |
| --- | --- | --- |
| 📝 **Todos** | Query + mutations + `invalidateQueries` | `useListTodos`, `useCreateTodo`, … |
| ⚡ **Optimistic Updates** | `onMutate` cache patch → `onError` rollback → `onSettled` re-sync | `useToggleTodo` |
| 📄 **Pagination** | `placeholderData: keepPreviousData` (no empty-flash between pages) | `useListArticles` |
| ♾️ **Infinite Query** | `useInfiniteQuery` (load more / infinite scroll) over a cursor route | `listArticleFeed` |
| 🔗 **Dependent · Prefetch · Polling** | `enabled` gating, `prefetchQuery` on hover, `refetchInterval` | `useSearchArticles`, `useGetArticle`, `useGetStats` |
| 🔭 **Observable Pattern** | the subscribe/notify model React Query is built on | `src/observable/*` |
| ⚖️ **State vs. Variable** | why `useState` is observable and a plain variable is not | — |

Backend routes added for the demos (all carry a small artificial latency so the
cache behaviour is visible): `GET /articles` (paginated), `GET /articles/feed`
(cursor), `GET /articles/search`, `GET /articles/{id}`, `GET /stats` (polling),
and `POST /todos/{id}/toggle?simulate_error=` (optimistic rollback).

> **Orval gotcha learned here:** naming a query param `cursor` makes Orval emit an
> unused `useInfiniteQuery` import (which breaks `noUnusedLocals`). The feed route
> uses `start` instead; the infinite hook is composed by hand from the generated
> `listArticleFeed` fetcher so types still flow end-to-end.

## How the pieces fit

1. FastAPI auto-generates an OpenAPI schema at `http://localhost:8000/openapi.json`.
2. `npm run orval` reads that schema and generates TypeScript models plus one
   React Query hook per endpoint (`useListTodos`, `useCreateTodo`, …).
3. `App.tsx` imports those hooks — no hand-written `fetch`/`axios` calls, and the
   request/response types stay in sync with the backend automatically.

## Running it

### 1. Backend (terminal 1)

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Check it: open http://localhost:8000/docs

### 2. Generate the client (terminal 2)

The backend must be running first (Orval reads its live schema).

```bash
cd frontend
npm install
npm run orval        # writes src/api/generated/**
```

### 3. Frontend (terminal 2)

```bash
npm run dev          # http://localhost:5173
```

## Re-generating after backend changes

Whenever you change a backend route or model, re-run `npm run orval`. Any
breaking change shows up immediately as a TypeScript error in `App.tsx` — that's
the whole point of the setup.
