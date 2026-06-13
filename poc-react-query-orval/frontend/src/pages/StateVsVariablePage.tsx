import { useEffect, useRef, useState } from 'react';

/**
 * A plain JavaScript variable in module scope. It persists across renders, but
 * mutating it does NOT notify React — nothing subscribes to it, so no re-render
 * is scheduled. Contrast with useState below, which IS an observable: changing
 * it notifies the component and triggers a re-render.
 */
let plainCount = 0;

export function StateVsVariablePage() {
  // --- fake "loading the page" for 2 seconds ---
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer); // cleanup if the page unmounts early
  }, []);

  // --- the comparison ---
  const [stateCount, setStateCount] = useState(0);

  // Count how many times this component has actually re-rendered.
  const renders = useRef(0);
  renders.current += 1;

  if (isLoading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.muted}>Loading… (fake 2s delay via useEffect)</p>
      </div>
    );
  }

  return (
    <div>
      <h1>⚖️ State vs. a Plain Variable</h1>
      <p style={styles.subtitle}>
        Both counters increment the same way. Only one tells React about it.
      </p>

      <div style={styles.grid}>
        {/* Plain variable */}
        <div style={styles.card}>
          <span style={styles.cardTitle}>Plain variable</span>
          <code style={styles.code}>let plainCount = 0;</code>
          <div style={styles.bigValue}>{plainCount}</div>
          <button onClick={() => {
            plainCount += 1;
            // It really did change — proof in the console — React just isn't told.
            console.log('plainCount is now', plainCount);
          }}>
            plainCount + 1
          </button>
          <p style={styles.note}>
            Click this several times. The number above <strong>won't move</strong>
            — but check the console: the variable <em>is</em> changing. React was
            never notified, so it never re-rendered.
          </p>
        </div>

        {/* useState */}
        <div style={styles.card}>
          <span style={styles.cardTitle}>React state</span>
          <code style={styles.code}>useState(0)</code>
          <div style={styles.bigValue}>{stateCount}</div>
          <button onClick={() => setStateCount((c) => c + 1)}>
            stateCount + 1
          </button>
          <p style={styles.note}>
            The setter notifies React (the observable's "notify" step), so the
            component re-renders and the UI updates immediately.
          </p>
        </div>
      </div>

      <div style={styles.reveal}>
        <strong>The reveal 👇</strong>
        <p style={styles.note}>
          Now press <code>plainCount + 1</code> a few times (UI stays frozen),
          then press <code>stateCount + 1</code> once. The plain counter suddenly
          jumps to its true value — it was correct all along; the
          <code> stateCount</code> change forced a re-render, and only then did
          React re-read the plain variable. <strong>State is observable;
          a variable is not.</strong>
        </p>
        <span style={styles.renderBadge}>this component has rendered {renders.current}×</span>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}></th>
            <th style={styles.th}>Plain variable</th>
            <th style={styles.th}>useState</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={styles.td}>Survives re-renders?</td>
            <td style={styles.td}>Yes (module scope)</td>
            <td style={styles.td}>Yes (React stores it)</td>
          </tr>
          <tr>
            <td style={styles.td}>Triggers a re-render on change?</td>
            <td style={styles.tdNo}>No</td>
            <td style={styles.tdYes}>Yes</td>
          </tr>
          <tr>
            <td style={styles.td}>Is it observable?</td>
            <td style={styles.tdNo}>No — nothing subscribes</td>
            <td style={styles.tdYes}>Yes — React is the subscriber</td>
          </tr>
        </tbody>
      </table>

      <p style={styles.footnote}>
        See <code>software-patterns-observable/03-react-state-as-observable.md</code>{' '}
        for why <code>useState</code> is a one-observer observable.
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  subtitle: { color: '#666', fontSize: 14, marginTop: -8 },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '60px 0',
  },
  spinner: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '4px solid #e0e0e0',
    borderTopColor: '#4f46e5',
    animation: 'spin 0.8s linear infinite',
  },
  muted: { color: '#64748b', fontSize: 14 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
    margin: '16px 0',
  },
  card: {
    border: '1px solid #e0e0e0',
    borderRadius: 10,
    padding: 16,
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  cardTitle: { fontWeight: 600, fontSize: 15 },
  code: { fontSize: 12, color: '#444', fontFamily: 'monospace' },
  bigValue: { fontSize: 44, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  note: { fontSize: 13, color: '#555', margin: 0 },
  reveal: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 8,
    padding: '12px 14px',
    margin: '8px 0 20px',
  },
  renderBadge: {
    display: 'inline-block',
    marginTop: 6,
    fontSize: 12,
    background: '#f1f5f9',
    color: '#334155',
    padding: '3px 10px',
    borderRadius: 999,
  },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 14 },
  th: { textAlign: 'left', borderBottom: '2px solid #e0e0e0', padding: '8px 10px' },
  td: { borderBottom: '1px solid #eee', padding: '8px 10px' },
  tdYes: { borderBottom: '1px solid #eee', padding: '8px 10px', color: '#16a34a', fontWeight: 600 },
  tdNo: { borderBottom: '1px solid #eee', padding: '8px 10px', color: '#dc2626', fontWeight: 600 },
  footnote: { color: '#999', fontSize: 12, marginTop: 16 },
};
