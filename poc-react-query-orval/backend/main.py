"""FastAPI backend for the React Query + Orval proof of concept.

Exposes a small Todo CRUD API. The OpenAPI schema it generates is what
Orval consumes on the frontend to generate typed React Query hooks.
"""
from __future__ import annotations

import itertools
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Todo POC API",
    version="1.0.0",
    description="Backend for the React Query + Orval proof of concept.",
)

# Allow the Vite dev server to call the API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas -- operationId and tags drive the names Orval generates.
# ---------------------------------------------------------------------------
class TodoBase(BaseModel):
    title: str = Field(..., min_length=1, examples=["Try React Query"])
    completed: bool = False


class TodoCreate(TodoBase):
    pass


class TodoUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    completed: Optional[bool] = None


class Todo(TodoBase):
    id: int
    created_at: datetime


# ---------------------------------------------------------------------------
# In-memory store (resets on restart -- it's only a POC).
# ---------------------------------------------------------------------------
_ids = itertools.count(1)
_todos: dict[int, Todo] = {}


def _seed() -> None:
    for title, done in [
        ("Learn FastAPI", True),
        ("Generate client with Orval", False),
        ("Wire up React Query hooks", False),
    ]:
        todo = Todo(
            id=next(_ids),
            title=title,
            completed=done,
            created_at=datetime.now(timezone.utc),
        )
        _todos[todo.id] = todo


_seed()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/todos", response_model=list[Todo], operation_id="listTodos", tags=["todos"])
def list_todos() -> list[Todo]:
    return sorted(_todos.values(), key=lambda t: t.id)


@app.post(
    "/todos",
    response_model=Todo,
    status_code=201,
    operation_id="createTodo",
    tags=["todos"],
)
def create_todo(payload: TodoCreate) -> Todo:
    todo = Todo(
        id=next(_ids),
        title=payload.title,
        completed=payload.completed,
        created_at=datetime.now(timezone.utc),
    )
    _todos[todo.id] = todo
    return todo


@app.get(
    "/todos/{todo_id}",
    response_model=Todo,
    operation_id="getTodo",
    tags=["todos"],
)
def get_todo(todo_id: int) -> Todo:
    todo = _todos.get(todo_id)
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


@app.patch(
    "/todos/{todo_id}",
    response_model=Todo,
    operation_id="updateTodo",
    tags=["todos"],
)
def update_todo(todo_id: int, payload: TodoUpdate) -> Todo:
    todo = _todos.get(todo_id)
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    updated = todo.model_copy(
        update={k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    )
    _todos[todo_id] = updated
    return updated


@app.delete(
    "/todos/{todo_id}",
    status_code=204,
    response_class=Response,
    operation_id="deleteTodo",
    tags=["todos"],
)
def delete_todo(todo_id: int) -> Response:
    if todo_id not in _todos:
        raise HTTPException(status_code=404, detail="Todo not found")
    del _todos[todo_id]
    return Response(status_code=204)
