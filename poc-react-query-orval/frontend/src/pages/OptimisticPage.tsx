import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useListTodos, useToggleTodo, getListTodosQueryKey } from '../api/generated/todos/todos';
import type { Todo } from '../api/generated/model';
import { Badge, Callout, Card, Code, Footnote, PageHeader, Spinner, tokens } from '../ui/kit';

/**
 * Optimistic updates: write to the cache *before* the server answers, then roll
 * back if the request fails. The flaky `/todos/{id}/toggle` route (0.6s latency,
 * optional forced 500) makes both the head-start and the rollback visible.
 */
export function OptimisticPage() {
  const queryClient = useQueryClient();
  const listKey = getListTodosQueryKey();

  const [optimistic, setOptimistic] = useState(true);
  const [simulateError, setSimulateError] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  // Read the latest toggle settings from inside the mutation callbacks.
  const optimisticRef = useRef(optimistic);
  optimisticRef.current = optimistic;

  const addLog = (line: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 6));

  const { data: todos } = useListTodos();

  const toggle = useToggleTodo({
    mutation: {
      // 1. Runs before the request. Optimistically patch the cache.
      onMutate: async ({ todoId }) => {
        if (!optimisticRef.current) return { previous: undefined };
        // Stop in-flight refetches from clobbering our optimistic write.
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = queryClient.getQueryData<Todo[]>(listKey);
        queryClient.setQueryData<Todo[]>(listKey, (old) =>
          old?.map((t) => (t.id === todoId ? { ...t, completed: !t.completed } : t)),
        );
        addLog(`onMutate → cache patched optimistically (#${todoId})`);
        return { previous };
      },
      // 2a. On failure, restore the snapshot taken in onMutate.
      onError: (_err, { todoId }, context) => {
        if (context?.previous) {
          queryClient.setQueryData(listKey, context.previous);
          addLog(`onError → rolled back #${todoId} ↩️`);
        } else {
          addLog(`onError → request failed #${todoId}`);
        }
      },
      // 2b. On success, nothing to undo.
      onSuccess: (_data, { todoId }) => addLog(`onSuccess → server confirmed #${todoId} ✓`),
      // 3. Always re-sync with the server as the source of truth.
      onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
    },
  });

  return (
    <div>
      <PageHeader
        icon="⚡"
        title="Optimistic Updates"
        subtitle={
          <>
            Patch the cache in <Code>onMutate</Code>, roll back in <Code>onError</Code>,
            re-sync in <Code>onSettled</Code>.
          </>
        }
      />

      <div style={styles.controls}>
        <label style={styles.switch}>
          <input
            type="checkbox"
            checked={optimistic}
            onChange={(e) => setOptimistic(e.target.checked)}
          />
          Optimistic mode
        </label>
        <label style={styles.switch}>
          <input
            type="checkbox"
            checked={simulateError}
            onChange={(e) => setSimulateError(e.target.checked)}
          />
          Simulate server failure
        </label>
      </div>

      <Callout style={{ marginBottom: 16 }}>
        {optimistic ? (
          <>
            <strong>Optimistic:</strong> the checkbox flips <em>instantly</em> — the server
            reply (0.6s later) just confirms it.{' '}
            {simulateError && (
              <>
                With failure on, watch it flip, then <strong>snap back</strong> when the 500
                arrives.
              </>
            )}
          </>
        ) : (
          <>
            <strong>Pessimistic:</strong> nothing changes until the server answers — the row
            shows a spinner for 0.6s first. Turn optimistic mode back on to feel the difference.
          </>
        )}
      </Callout>

      <ul style={styles.list}>
        {todos?.map((todo) => {
          const pending = toggle.isPending && toggle.variables?.todoId === todo.id;
          return (
            <Card key={todo.id} style={styles.item} highlight={pending}>
              <label style={styles.label}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  disabled={pending && !optimistic}
                  onChange={() =>
                    toggle.mutate({ todoId: todo.id, params: { simulate_error: simulateError } })
                  }
                />
                <span
                  style={{
                    textDecoration: todo.completed ? 'line-through' : 'none',
                    opacity: todo.completed ? 0.55 : 1,
                  }}
                >
                  {todo.title}
                </span>
              </label>
              {pending && (
                <span style={styles.pending}>
                  <Spinner size={13} /> {optimistic ? 'confirming…' : 'waiting for server…'}
                </span>
              )}
            </Card>
          );
        })}
      </ul>

      <h2 style={styles.logHeading}>Mutation lifecycle log</h2>
      <div style={styles.logBox}>
        {log.length === 0 ? (
          <span style={{ color: '#64748b' }}>Toggle a todo to see the callbacks fire…</span>
        ) : (
          log.map((line, i) => (
            <div key={i} style={styles.logLine}>
              {line}
            </div>
          ))
        )}
      </div>

      <div style={styles.legend}>
        <Badge tone="accent">onMutate</Badge> patch cache &nbsp;
        <Badge tone="red">onError</Badge> rollback &nbsp;
        <Badge tone="green">onSuccess</Badge> confirmed &nbsp;
        <Badge tone="neutral">onSettled</Badge> invalidate
      </div>

      <Footnote>
        Source: <Code>src/pages/OptimisticPage.tsx</Code> · backend route{' '}
        <Code>POST /todos/&#123;id&#125;/toggle?simulate_error=</Code>. The same todos cache is
        shared with the Todos page — toggles here show up there too.
      </Footnote>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  controls: { display: 'flex', flexWrap: 'wrap', gap: 16, margin: '4px 0 14px' },
  switch: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 },
  item: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' },
  label: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  pending: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: tokens.muted },
  logHeading: { fontSize: 15, margin: '24px 0 8px' },
  logBox: {
    border: `1px solid ${tokens.border}`,
    borderRadius: tokens.radius,
    padding: 12,
    background: '#0b1021',
    color: '#cbd5e1',
    fontFamily: 'ui-monospace, monospace',
    fontSize: 12.5,
    display: 'grid',
    gap: 4,
    minHeight: 60,
  },
  logLine: { whiteSpace: 'pre-wrap' },
  legend: { marginTop: 12, fontSize: 13, color: tokens.muted, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
};
