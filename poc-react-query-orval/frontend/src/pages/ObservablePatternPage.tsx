import { useEffect, useRef, useState } from 'react';
import { createStore } from '../observable/store';
import { useStore } from '../observable/useStore';

/**
 * The subject. A single observable store, shared by every component on this
 * page — none of which are related by props or context. They cooperate purely
 * through subscribe / notify, exactly as the Observer pattern promises.
 *
 * Mirrors software-patterns-observable/04-build-an-observable-store.md.
 */
const demoStore = createStore({
  count: 0,
  color: '#4f46e5',
});

const COLORS = ['#4f46e5', '#16a34a', '#dc2626', '#d97706', '#0891b2'];

/** Tiny helper: counts how many times a component has rendered. */
function useRenderCount() {
  const renders = useRef(0);
  renders.current += 1;
  return renders.current;
}

/** Observer A — subscribes to `count` ONLY. */
function CountObserver() {
  const count = useStore(demoStore, (s) => s.count);
  const renders = useRenderCount();
  return (
    <ObserverCard
      title="Observer A"
      subtitle="selector: (s) => s.count"
      renders={renders}
    >
      <div style={styles.bigValue}>{count}</div>
    </ObserverCard>
  );
}

/** Observer B — subscribes to `color` ONLY. Proves selective subscription:
 *  it does NOT re-render when `count` changes. */
function ColorObserver() {
  const color = useStore(demoStore, (s) => s.color);
  const renders = useRenderCount();
  return (
    <ObserverCard
      title="Observer B"
      subtitle="selector: (s) => s.color"
      renders={renders}
    >
      <div style={{ ...styles.swatch, background: color }} />
      <code style={styles.code}>{color}</code>
    </ObserverCard>
  );
}

/** Observer C — subscribes to the WHOLE snapshot, so it re-renders on every
 *  change to any field. Contrast its render count with A and B. */
function WholeStoreObserver() {
  const state = useStore(demoStore, (s) => s);
  const renders = useRenderCount();
  return (
    <ObserverCard
      title="Observer C"
      subtitle="selector: (s) => s  (everything)"
      renders={renders}
    >
      <code style={styles.code}>count: {state.count}</code>
      <code style={styles.code}>color: {state.color}</code>
    </ObserverCard>
  );
}

/** A mountable/unmountable observer — toggling it shows subscribe/unsubscribe
 *  in action and changes the live listener count below. */
function EphemeralObserver() {
  const count = useStore(demoStore, (s) => s.count);
  return (
    <ObserverCard
      title="Observer D (ephemeral)"
      subtitle="unmount me → I unsubscribe"
      renders={useRenderCount()}
    >
      <div style={styles.bigValue}>{count}</div>
    </ObserverCard>
  );
}

/** Uses the RAW store.subscribe API (not the hook) to log every notification,
 *  making the notify step visible. Returns its unsubscribe for cleanup — the
 *  discipline the Observer pattern demands. */
function NotificationLog() {
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = demoStore.subscribe(() => {
      const s = demoStore.getSnapshot();
      const time = new Date().toLocaleTimeString();
      setLog((prev) =>
        [`${time}  notified → count=${s.count}, color=${s.color}`, ...prev].slice(0, 8),
      );
    });
    return unsubscribe; // unsubscribe on unmount — no leak
  }, []);

  return (
    <div style={styles.logBox}>
      <strong>Notification log (raw store.subscribe)</strong>
      {log.length === 0 ? (
        <p style={styles.muted}>Change the state to see observers get notified…</p>
      ) : (
        <ul style={styles.logList}>
          {log.map((line, i) => (
            <li key={i} style={styles.logLine}>
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ObservablePatternPage() {
  const [showEphemeral, setShowEphemeral] = useState(true);
  // Subscribe to the whole store so the live-observer badge below refreshes
  // whenever any field changes. (`(s) => s` keeps a stable identity between
  // notifications, so there's no render loop.)
  useStore(demoStore, (s) => s);

  return (
    <div>
      <h1>🔭 Observable Pattern</h1>
      <p style={styles.subtitle}>
        One store (the subject). Many components (observers). No shared props or
        context — they cooperate only through subscribe / notify.
      </p>

      <section style={styles.controls}>
        <button
          onClick={() => demoStore.setState((s) => ({ count: s.count + 1 }))}
        >
          count + 1
        </button>
        <button
          onClick={() => demoStore.setState((s) => ({ count: s.count - 1 }))}
        >
          count − 1
        </button>
        <button
          onClick={() =>
            demoStore.setState((s) => ({
              color: COLORS[(COLORS.indexOf(s.color) + 1) % COLORS.length],
            }))
          }
        >
          next color
        </button>
        <label style={styles.toggle}>
          <input
            type="checkbox"
            checked={showEphemeral}
            onChange={(e) => setShowEphemeral(e.target.checked)}
          />
          mount Observer D
        </label>
        <span style={styles.listenerBadge}>
          live observers: {demoStore.listenerCount()}
        </span>
      </section>

      <p style={styles.hint}>
        Press <code>count + 1</code> and watch <strong>Observer B</strong>'s
        render count stay frozen — it only reads <code>color</code>, so the
        pattern's pull model lets it ignore the change. Toggle Observer D to see
        the live observer count rise and fall as it subscribes / unsubscribes.
      </p>

      <div style={styles.grid}>
        <CountObserver />
        <ColorObserver />
        <WholeStoreObserver />
        {showEphemeral && <EphemeralObserver />}
      </div>

      <NotificationLog />

      <p style={styles.footnote}>
        Source: <code>src/observable/store.ts</code> +{' '}
        <code>src/observable/useStore.ts</code>. Explained in{' '}
        <code>software-patterns-observable/04-build-an-observable-store.md</code>.
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  subtitle: { color: '#666', fontSize: 14, marginTop: -8 },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    margin: '16px 0',
  },
  toggle: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 },
  listenerBadge: {
    marginLeft: 'auto',
    fontSize: 13,
    background: '#eef2ff',
    color: '#4f46e5',
    padding: '4px 10px',
    borderRadius: 999,
    fontWeight: 600,
  },
  hint: {
    fontSize: 13,
    color: '#555',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 8,
    padding: '10px 12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 12,
    margin: '16px 0',
  },
  card: {
    border: '1px solid #e0e0e0',
    borderRadius: 10,
    padding: 14,
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardHeader: { display: 'flex', flexDirection: 'column', gap: 2 },
  cardTitle: { fontWeight: 600, fontSize: 14 },
  cardSubtitle: { color: '#888', fontSize: 12, fontFamily: 'monospace' },
  renderBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    background: '#f1f5f9',
    color: '#334155',
    padding: '2px 8px',
    borderRadius: 999,
  },
  bigValue: { fontSize: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  swatch: { width: '100%', height: 40, borderRadius: 6 },
  code: { fontSize: 12, color: '#444' },
  logBox: {
    border: '1px solid #e0e0e0',
    borderRadius: 10,
    padding: 14,
    background: '#0b1021',
    color: '#cbd5e1',
  },
  logList: { listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 4 },
  logLine: { fontFamily: 'monospace', fontSize: 12.5 },
  muted: { color: '#64748b', fontSize: 13 },
  footnote: { color: '#999', fontSize: 12, marginTop: 16 },
};

/** Presentational shell for an observer card, with its render counter. */
function ObserverCard({
  title,
  subtitle,
  renders,
  children,
}: {
  title: string;
  subtitle: string;
  renders: number;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.cardTitle}>{title}</span>
        <span style={styles.cardSubtitle}>{subtitle}</span>
      </div>
      {children}
      <span style={styles.renderBadge}>renders: {renders}</span>
    </div>
  );
}
