# React Query + Orval — Proof of Concept

A minimal full-stack Todo app showing how to generate a **fully typed React Query
client** from a **FastAPI** backend using **Orval**.

```
poc-react-query-orval/
├── backend/          FastAPI app (Todo CRUD) — source of the OpenAPI schema
│   ├── main.py
│   └── requirements.txt
└── frontend/         Vite + React + React Query
    ├── orval.config.ts          ← Orval config (reads /openapi.json)
    └── src/
        ├── api/
        │   ├── axios-instance.ts   custom mutator (base URL, interceptors)
        │   └── generated/          ← created by `npm run orval` (do not edit)
        ├── App.tsx                 uses the generated hooks
        └── main.tsx                QueryClientProvider + Devtools
```

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
