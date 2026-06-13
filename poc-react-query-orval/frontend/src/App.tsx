import { useState } from 'react';
import { TodosPage } from './pages/TodosPage';
import { ObservablePatternPage } from './pages/ObservablePatternPage';
import { StateVsVariablePage } from './pages/StateVsVariablePage';

type Tab = 'todos' | 'observable' | 'state-vs-var';

const TABS: { id: Tab; label: string }[] = [
  { id: 'todos', label: '📝 Todos' },
  { id: 'observable', label: '🔭 Observable Pattern' },
  { id: 'state-vs-var', label: '⚖️ State vs. Variable' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('observable');

  return (
    <main style={styles.main}>
      <nav style={styles.nav}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              ...styles.tab,
              ...(tab === t.id ? styles.tabActive : null),
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'todos' && <TodosPage />}
      {tab === 'observable' && <ObservablePatternPage />}
      {tab === 'state-vs-var' && <StateVsVariablePage />}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 720,
    margin: '40px auto',
    fontFamily: 'system-ui, sans-serif',
    padding: '0 16px',
  },
  nav: {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
    borderBottom: '1px solid #e0e0e0',
    paddingBottom: 12,
  },
  tab: {
    border: '1px solid transparent',
    background: 'transparent',
  },
  tabActive: {
    background: '#eef2ff',
    borderColor: '#c7d2fe',
    color: '#4f46e5',
    fontWeight: 600,
  },
};
