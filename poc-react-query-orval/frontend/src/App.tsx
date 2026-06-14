import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { TodosPage } from './pages/TodosPage';
import { OptimisticPage } from './pages/OptimisticPage';
import { PaginationPage } from './pages/PaginationPage';
import { InfinitePage } from './pages/InfinitePage';
import { AsyncPatternsPage } from './pages/AsyncPatternsPage';
import { CachingParamsPage } from './pages/CachingParamsPage';
import { ObservablePatternPage } from './pages/ObservablePatternPage';
import { StateVsVariablePage } from './pages/StateVsVariablePage';
import { tokens } from './ui/kit';

type NavItem = { to: string; label: string; element: React.ReactNode };
type NavSection = { heading: string; items: NavItem[] };

/**
 * The gallery. Each route demonstrates one TanStack Query concept using the
 * Orval-generated, fully-typed hooks. Foundations explain *why* React Query
 * works (the observable model underneath).
 */
const SECTIONS: NavSection[] = [
  {
    heading: 'TanStack Query',
    items: [
      { to: '/todos', label: '📝 Todos (CRUD)', element: <TodosPage /> },
      { to: '/optimistic', label: '⚡ Optimistic Updates', element: <OptimisticPage /> },
      { to: '/pagination', label: '📄 Pagination', element: <PaginationPage /> },
      { to: '/infinite', label: '♾️ Infinite Query', element: <InfinitePage /> },
      { to: '/async', label: '🔗 Dependent · Prefetch · Polling', element: <AsyncPatternsPage /> },
      { to: '/caching', label: '🗄️ Cache Lifecycle (stale/gc)', element: <CachingParamsPage /> },
    ],
  },
  {
    heading: 'Foundations',
    items: [
      { to: '/observable', label: '🔭 Observable Pattern', element: <ObservablePatternPage /> },
      { to: '/state-vs-var', label: '⚖️ State vs. Variable', element: <StateVsVariablePage /> },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((s) => s.items);

export function App() {
  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <span style={styles.brandTitle}>React Query</span>
          <span style={styles.brandSub}>+ Orval · concept gallery</span>
        </div>
        {SECTIONS.map((section) => (
          <nav key={section.heading} style={styles.navGroup}>
            <span style={styles.navHeading}>{section.heading}</span>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  ...styles.navLink,
                  ...(isActive ? styles.navLinkActive : null),
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        ))}
      </aside>

      <main style={styles.content}>
        <Routes>
          <Route path="/" element={<Navigate to="/todos" replace />} />
          {ALL_ITEMS.map((item) => (
            <Route key={item.to} path={item.to} element={item.element} />
          ))}
          <Route path="*" element={<Navigate to="/todos" replace />} />
        </Routes>
      </main>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: 'system-ui, sans-serif',
    color: tokens.text,
  },
  sidebar: {
    width: 248,
    flexShrink: 0,
    borderRight: `1px solid ${tokens.border}`,
    background: '#fff',
    padding: '20px 14px',
    position: 'sticky',
    top: 0,
    alignSelf: 'flex-start',
    height: '100vh',
    boxSizing: 'border-box',
    overflowY: 'auto',
  },
  brand: { display: 'flex', flexDirection: 'column', padding: '0 8px 16px' },
  brandTitle: { fontWeight: 700, fontSize: 16 },
  brandSub: { fontSize: 12, color: tokens.faint },
  navGroup: { display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 18 },
  navHeading: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: tokens.faint,
    padding: '0 8px 6px',
  },
  navLink: {
    textDecoration: 'none',
    color: '#333',
    fontSize: 14,
    padding: '7px 10px',
    borderRadius: 8,
    transition: 'background 0.15s',
  },
  navLinkActive: {
    background: tokens.accentSoft,
    color: tokens.accent,
    fontWeight: 600,
  },
  content: {
    flex: 1,
    maxWidth: 820,
    margin: '0 auto',
    padding: '40px 32px 80px',
    width: '100%',
    boxSizing: 'border-box',
  },
};
