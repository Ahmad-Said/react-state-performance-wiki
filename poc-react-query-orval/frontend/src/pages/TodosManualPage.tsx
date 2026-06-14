import { useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

/**
 * The *manual* counterpart to TodosPage.
 *
 * Nothing here comes from Orval: the types, the API calls (plain `fetch`), the
 * query keys and the `useQuery`/`useMutation` wiring are all hand-written. This
 * is what the generated hooks save you from doing on every endpoint.
 */

const API_BASE = 'http://localhost:8000';

// --- Types (hand-written; mirror the FastAPI schema) ------------------------
interface Todo {
  id: number;
  title: string;
  completed: boolean;
  created_at: string;
}
interface TodoCreate {
  title: string;
  completed?: boolean;
}
interface TodoUpdate {
  title?: string;
  completed?: boolean;
}

// --- API layer (plain fetch) ------------------------------------------------
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  // DELETE returns 204 / empty body.
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const todosApi = {
  list: (signal?: AbortSignal) => request<Todo[]>('/todos', { signal }),
  create: (body: TodoCreate) =>
    request<Todo>('/todos', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: TodoUpdate) =>
    request<Todo>(`/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  remove: (id: number) =>
    request<void>(`/todos/${id}`, { method: 'DELETE' }),
};

// Single source of truth for the query key — the manual equivalent of
// Orval's getListTodosQueryKey().
const todosKey = ['todos'] as const;

// --- Component --------------------------------------------------------------
export function TodosManualPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  // GET /todos
  const {
    data: todos,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: todosKey,
    queryFn: ({ signal }) => todosApi.list(signal),
  });

  // Re-fetch the list after any mutation succeeds.
  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: todosKey });

  const createTodo = useMutation({
    mutationFn: (body: TodoCreate) => todosApi.create(body),
    onSuccess: invalidateList,
  });
  const updateTodo = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TodoUpdate }) =>
      todosApi.update(id, data),
    onSuccess: invalidateList,
  });
  const deleteTodo = useMutation({
    mutationFn: (id: number) => todosApi.remove(id),
    onSuccess: invalidateList,
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createTodo.mutate({ title, completed: false });
    setTitle('');
  };

  return (
    <div>
      <h1>📝 Todos (manual)</h1>
      <p style={styles.subtitle}>
        Same CRUD as the Orval page, but every API call, type and React Query
        hook is hand-written with plain <code>fetch</code>.
      </p>

      <form onSubmit={handleAdd} style={styles.form}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          style={styles.input}
        />
        <button type="submit" disabled={createTodo.isPending}>
          {createTodo.isPending ? 'Adding…' : 'Add'}
        </button>
      </form>

      {isLoading && <p>Loading…</p>}
      {isError && (
        <p style={styles.error}>
          Failed to load: {error instanceof Error ? error.message : 'unknown error'}
        </p>
      )}

      <ul style={styles.list}>
        {todos?.map((todo) => (
          <li key={todo.id} style={styles.item}>
            <label style={styles.label}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() =>
                  updateTodo.mutate({
                    id: todo.id,
                    data: { completed: !todo.completed },
                  })
                }
              />
              <span
                style={{
                  textDecoration: todo.completed ? 'line-through' : 'none',
                  opacity: todo.completed ? 0.6 : 1,
                }}
              >
                {todo.title}
              </span>
            </label>
            <button
              onClick={() => deleteTodo.mutate(todo.id)}
              style={styles.delete}
              aria-label={`Delete ${todo.title}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  subtitle: { color: '#666', fontSize: 14, marginTop: -8 },
  form: { display: 'flex', gap: 8, margin: '20px 0' },
  input: { flex: 1, padding: '8px 10px', fontSize: 16 },
  list: { listStyle: 'none', padding: 0, display: 'grid', gap: 8 },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: 8,
  },
  label: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  delete: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#c00',
    fontSize: 16,
  },
  error: { color: '#c00' },
};
