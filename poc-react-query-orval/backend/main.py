"""FastAPI backend for the React Query + Orval proof of concept.

Exposes a small Todo CRUD API. The OpenAPI schema it generates is what
Orval consumes on the frontend to generate typed React Query hooks.
"""
from __future__ import annotations

import asyncio
import itertools
import random
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Response
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


# ===========================================================================
# Concept-demo routes
# ---------------------------------------------------------------------------
# Everything below exists to make specific TanStack Query concepts tangible in
# the frontend gallery: pagination, infinite scroll, dependent/prefetched/
# polled queries, and optimistic updates with rollback. Each route adds a
# little artificial latency so the cache/loading behaviour is actually visible.
# ===========================================================================

# Tunable, deliberate latency (seconds) so loading states and the value of
# placeholderData / prefetching are observable in the UI.
_LATENCY = 0.6


async def _delay(seconds: float = _LATENCY) -> None:
    """Simulate network/server latency so cache behaviour is visible."""
    await asyncio.sleep(seconds)


# ---------------------------------------------------------------------------
# Articles -- a larger read-only dataset for pagination / infinite / search.
# ---------------------------------------------------------------------------
class Article(BaseModel):
    id: int
    title: str
    author: str
    read_minutes: int = Field(..., description="Estimated reading time in minutes.")
    body: str
    published_at: datetime


class ArticlePage(BaseModel):
    """One page of articles plus the metadata a paginated UI needs."""

    items: list[Article]
    page: int = Field(..., ge=1, description="1-based page number.")
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_prev: bool


class ArticleFeed(BaseModel):
    """A cursor-style slice for `useInfiniteQuery`."""

    items: list[Article]
    next_cursor: Optional[int] = Field(
        None, description="Pass back as `cursor` to load the next slice; null at the end."
    )
    has_more: bool


_AUTHORS = ["Ada Lovelace", "Alan Turing", "Grace Hopper", "Linus T.", "Dan A."]
_TOPICS = [
    "Query Keys",
    "Stale Time",
    "Cache Garbage Collection",
    "Optimistic Updates",
    "Infinite Scrolling",
    "Prefetching",
    "Dependent Queries",
    "Polling & refetchInterval",
    "Mutations & Invalidation",
    "Suspense & Error Boundaries",
]


def _build_articles(count: int = 97) -> dict[int, Article]:
    rng = random.Random(42)  # deterministic so the dataset is stable across restarts
    base = datetime(2024, 1, 1, tzinfo=timezone.utc)
    articles: dict[int, Article] = {}
    for i in range(1, count + 1):
        topic = _TOPICS[i % len(_TOPICS)]
        articles[i] = Article(
            id=i,
            title=f"#{i:02d} · {topic}",
            author=rng.choice(_AUTHORS),
            read_minutes=rng.randint(2, 12),
            body=(
                f"A deep dive into {topic.lower()} with TanStack Query. "
                "This is placeholder body copy for the proof-of-concept gallery."
            ),
            published_at=base.replace(microsecond=0),
        )
    return articles


_articles: dict[int, Article] = _build_articles()
_articles_sorted: list[Article] = sorted(_articles.values(), key=lambda a: a.id)


@app.get(
    "/articles",
    response_model=ArticlePage,
    operation_id="listArticles",
    tags=["articles"],
)
async def list_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
) -> ArticlePage:
    """Classic offset pagination -- the demo for `placeholderData`/keepPreviousData."""
    await _delay()
    total = len(_articles_sorted)
    total_pages = max(1, (total + page_size - 1) // page_size)
    start = (page - 1) * page_size
    items = _articles_sorted[start : start + page_size]
    return ArticlePage(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


@app.get(
    "/articles/feed",
    response_model=ArticleFeed,
    operation_id="listArticleFeed",
    tags=["articles"],
)
async def list_article_feed(
    start: int = Query(0, ge=0, description="Offset to start from; 0 for the first slice."),
    limit: int = Query(8, ge=1, le=50),
) -> ArticleFeed:
    """Cursor slice -- the demo for load more / infinite scroll."""
    await _delay()
    items = _articles_sorted[start : start + limit]
    next_cursor = start + limit
    has_more = next_cursor < len(_articles_sorted)
    return ArticleFeed(
        items=items,
        next_cursor=next_cursor if has_more else None,
        has_more=has_more,
    )


@app.get(
    "/articles/search",
    response_model=list[Article],
    operation_id="searchArticles",
    tags=["articles"],
)
async def search_articles(q: str = Query("", description="Case-insensitive title match.")) -> list[Article]:
    """Search -- the dependent-query demo (only runs once `q` is non-empty)."""
    await _delay()
    needle = q.strip().lower()
    if not needle:
        return []
    return [a for a in _articles_sorted if needle in a.title.lower()]


@app.get(
    "/articles/{article_id}",
    response_model=Article,
    operation_id="getArticle",
    tags=["articles"],
)
async def get_article(article_id: int) -> Article:
    """Single article -- the prefetch-on-hover demo (latency makes prefetch pay off)."""
    await _delay()
    article = _articles.get(article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


# ---------------------------------------------------------------------------
# Live stats -- the polling (`refetchInterval`) demo.
# ---------------------------------------------------------------------------
class Stats(BaseModel):
    server_time: datetime
    active_users: int = Field(..., description="A jittering number, refreshed each call.")
    total_articles: int
    total_todos: int


@app.get("/stats", response_model=Stats, operation_id="getStats", tags=["stats"])
async def get_stats() -> Stats:
    """Returns a value that changes every call so polling is visibly live."""
    return Stats(
        server_time=datetime.now(timezone.utc),
        active_users=random.randint(40, 120),
        total_articles=len(_articles),
        total_todos=len(_todos),
    )


# ---------------------------------------------------------------------------
# Flaky toggle -- the optimistic-update + rollback demo.
# ---------------------------------------------------------------------------
@app.post(
    "/todos/{todo_id}/toggle",
    response_model=Todo,
    operation_id="toggleTodo",
    tags=["todos"],
)
async def toggle_todo(
    todo_id: int,
    simulate_error: bool = Query(
        False, description="When true the server rejects the toggle, forcing a client rollback."
    ),
) -> Todo:
    """Flips `completed` with latency; can be told to fail so the UI rolls back."""
    await _delay()
    if simulate_error:
        raise HTTPException(status_code=500, detail="Simulated server failure")
    todo = _todos.get(todo_id)
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    updated = todo.model_copy(update={"completed": not todo.completed})
    _todos[todo_id] = updated
    return updated
