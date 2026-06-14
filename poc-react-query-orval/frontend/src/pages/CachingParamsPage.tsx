import { useRef, useState } from 'react';
import { useGetStats } from '../api/generated/stats/stats';
import {
  Badge,
  Callout,
  Card,
  Code,
  Footnote,
  PageHeader,
  SectionTitle,
  Spinner,
  tokens,
} from '../ui/kit';

/**
 * Inspired by the `query-example-tutorial` (Home / About / RandomPet), which
 * teaches the three cache-lifecycle knobs by giving each page a different
 * `useQuery` config and a server value that changes on every call.
 *
 * Here the three lessons live in *tabs* instead of routes. The trick: each tab
 * mounts its demo component only while it is active, so **switching tabs is the
 * "navigate away and come back" event** that makes caching visible. The server's
 * `active_users` (from `/stats`) jitters every request — exactly like the
 * tutorial's `ourNumber` — so a refetch is obvious (the number changes) and a
 * cache hit is obvious (the number is frozen, no spinner, no network).
 */

type TabKey = 'default' | 'stale' | 'gc';

type TabDef = {
  key: TabKey;
  label: string;
  /** Distinct query key so each tab caches independently (like the tutorial's distinct keys). */
  queryKey: string;
  staleTime?: number;
  gcTime?: number;
  configLabel: string;
  blurb: React.ReactNode;
};

const THIRTY_MIN = 1000 * 60 * 30;

const TABS: TabDef[] = [
  {
    key: 'default',
    label: 'Defaults',
    queryKey: 'caching-demo-default',
    configLabel: 'useGetStats()',
    blurb: (
      <>
        No overrides → <Code>staleTime: 0</Code>, <Code>gcTime: 5min</Code>. Data is{' '}
        <strong>stale the instant it arrives</strong>. Leave and return: the cached number paints
        immediately, then a quiet background refetch swaps in a fresh one (watch it flicker).
      </>
    ),
  },
  {
    key: 'stale',
    label: 'staleTime: 30min',
    queryKey: 'caching-demo-stale',
    staleTime: THIRTY_MIN,
    configLabel: 'useGetStats({ staleTime: 30min })',
    blurb: (
      <>
        Data stays <strong>fresh</strong> for 30 minutes, so remounting reuses the cache and{' '}
        <strong>never refetches</strong>. Leave and return as often as you like — the number is
        frozen and no network request fires. This is the <Code>About</Code> page in the tutorial.
      </>
    ),
  },
  {
    key: 'gc',
    label: 'gcTime: 0',
    queryKey: 'caching-demo-gc',
    gcTime: 0,
    configLabel: 'useGetStats({ gcTime: 0 })',
    blurb: (
      <>
        The moment this tab unmounts the query goes inactive and is{' '}
        <strong>garbage-collected immediately</strong> — nothing is kept. So every return starts
        from scratch: spinner, full fetch, brand-new number. This is the <Code>RandomPet</Code> page
        in the tutorial.
      </>
    ),
  },
];

/** Persisted across mount/unmount so we can show "this tab mounted N times". */
const mountCounts = new Map<TabKey, number>();

export function CachingParamsPage() {
  const [active, setActive] = useState<TabKey>('default');
  const activeTab = TABS.find((t) => t.key === active)!;

  return (
    <div>
      <PageHeader
        icon="🗄️"
        title="Cache Lifecycle: staleTime vs. gcTime"
        subtitle="Switch tabs to leave & re-enter a query — and watch the cache decide whether to refetch."
      />

      <Callout style={{ marginBottom: 16 }}>
        <strong>How to read this page:</strong> open a tab and note the number. Switch to another tab
        (that <em>unmounts</em> this one), then come back. Whether the number changes — and whether a
        spinner appears — tells you exactly what the cache did. The server returns a fresh{' '}
        <Code>active_users</Code> on every call, so any refetch is impossible to miss.
      </Callout>

      {/* --- the tab strip --- */}
      <div style={styles.tabStrip} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            style={{
              ...styles.tab,
              ...(active === t.key ? styles.tabActive : null),
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mounting only the active tab is the whole point: the others are gone. */}
      <div style={styles.panel} role="tabpanel">
        <CacheDemo key={activeTab.key} tab={activeTab} />
      </div>

      <LifecycleLegend />

      <Footnote>
        Inspired by <Code>data/query-example-tutorial-main</Code> (Home / About / RandomPet). Source:{' '}
        <Code>src/pages/CachingParamsPage.tsx</Code> · route <Code>/stats</Code>.
      </Footnote>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One tab's live demo. Remounts every time you return to its tab.    */
/* ------------------------------------------------------------------ */
function CacheDemo({ tab }: { tab: TabDef }) {
  // Record this mount.
  const mountedAt = useRef(Date.now());
  const mountNumber = useRef(0);
  if (mountNumber.current === 0) {
    mountNumber.current = (mountCounts.get(tab.key) ?? 0) + 1;
    mountCounts.set(tab.key, mountNumber.current);
  }

  const { data, isPending, isFetching, fetchStatus, dataUpdatedAt } = useGetStats({
    query: {
      queryKey: [tab.queryKey],
      staleTime: tab.staleTime,
      gcTime: tab.gcTime,
    },
  });

  // If the data was last fetched *before* this component mounted, it was served
  // from the cache — no network needed for this visit.
  const servedFromCache = dataUpdatedAt > 0 && dataUpdatedAt < mountedAt.current;

  return (
    <div>
      <div style={styles.configRow}>
        <Code>{tab.configLabel}</Code>
        <Badge tone="neutral">mounted {mountNumber.current}× this session</Badge>
      </div>

      <p style={styles.blurb}>{tab.blurb}</p>

      <Card style={{ textAlign: 'center', padding: '22px 16px' }}>
        {isPending ? (
          <div style={styles.loadingBox}>
            <Spinner size={22} />
            <span style={styles.muted}>Loading… (no cached value to show)</span>
          </div>
        ) : (
          <>
            <div style={styles.bigValue}>{data?.active_users}</div>
            <div style={styles.muted}>active users (changes on every real fetch)</div>
            <div style={styles.badgeRow}>
              {servedFromCache ? (
                <Badge tone="green">⚡ served from cache — no refetch</Badge>
              ) : (
                <Badge tone="amber">🌐 fresh from server</Badge>
              )}
              <Badge tone={isFetching ? 'accent' : 'neutral'}>
                {isFetching ? (
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <Spinner size={11} /> refetching…
                  </span>
                ) : (
                  `fetchStatus: ${fetchStatus}`
                )}
              </Badge>
            </div>
          </>
        )}
      </Card>

      <div style={styles.metaRow}>
        <Meta label="Last fetched" value={fmtTime(dataUpdatedAt)} />
        <Meta label="This mount at" value={fmtTime(mountedAt.current)} />
      </div>

      <Callout tone={tab.key === 'stale' ? 'success' : 'info'} style={{ marginTop: 14 }}>
        {tab.key === 'default' && (
          <>
            <strong>Try it:</strong> switch away and back a few times. The number updates on each
            return — but notice it appears <em>instantly</em> (stale cache shown first), then the
            background refetch quietly replaces it.
          </>
        )}
        {tab.key === 'stale' && (
          <>
            <strong>Try it:</strong> switch away and back repeatedly. The number never moves and{' '}
            <Code>Last fetched</Code> never updates — within the 30-minute window React Query
            considers the data fresh and skips the network entirely.
          </>
        )}
        {tab.key === 'gc' && (
          <>
            <strong>Try it:</strong> switch away and back. You always hit the spinner first, because
            the cache entry was thrown away on unmount — there is nothing to show while the fresh
            fetch runs.
          </>
        )}
      </Callout>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.meta}>
      <span style={styles.metaLabel}>{label}</span>
      <span style={styles.metaValue}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A small reference of the cache lifecycle the two knobs control.    */
/* ------------------------------------------------------------------ */
function LifecycleLegend() {
  return (
    <section>
      <SectionTitle>🔁 The two knobs, one lifecycle</SectionTitle>
      <p style={styles.blurb}>
        Every query entry walks the same path. <Code>staleTime</Code> controls the{' '}
        <strong>first</strong> transition; <Code>gcTime</Code> controls the <strong>last</strong>.
      </p>
      <div style={styles.flow}>
        <span style={styles.flowNode}>fresh</span>
        <span style={styles.flowArrow}>
          —staleTime→
        </span>
        <span style={styles.flowNode}>stale</span>
        <span style={styles.flowArrow}>—unmount→</span>
        <span style={styles.flowNode}>inactive</span>
        <span style={styles.flowArrow}>—gcTime→</span>
        <span style={styles.flowNode}>collected</span>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}></th>
            <th style={styles.th}>staleTime</th>
            <th style={styles.th}>gcTime</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={styles.td}>Controls</td>
            <td style={styles.td}>When cached data is considered fresh vs. stale</td>
            <td style={styles.td}>How long an unused (inactive) entry survives in memory</td>
          </tr>
          <tr>
            <td style={styles.td}>Affects refetching?</td>
            <td style={styles.td}>Yes — fresh data is reused without a network call</td>
            <td style={styles.td}>No — only governs when the entry is deleted</td>
          </tr>
          <tr>
            <td style={styles.td}>Default</td>
            <td style={styles.td}>
              <Code>0</Code> (immediately stale)
            </td>
            <td style={styles.td}>
              <Code>5 min</Code>
            </td>
          </tr>
          <tr>
            <td style={styles.td}>Tutorial page</td>
            <td style={styles.td}>
              <Code>About</Code> (30 min)
            </td>
            <td style={styles.td}>
              <Code>RandomPet</Code> (0)
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function fmtTime(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString();
}

const styles: Record<string, React.CSSProperties> = {
  tabStrip: {
    display: 'flex',
    gap: 4,
    borderBottom: `1px solid ${tokens.border}`,
    marginBottom: 0,
  },
  tab: {
    border: 'none',
    background: 'transparent',
    padding: '9px 14px',
    fontSize: 14,
    color: tokens.muted,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    borderRadius: 0,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  tabActive: {
    color: tokens.accent,
    fontWeight: 700,
    borderBottom: `2px solid ${tokens.accent}`,
  },
  panel: {
    border: `1px solid ${tokens.border}`,
    borderTop: 'none',
    borderRadius: `0 0 ${tokens.radius}px ${tokens.radius}px`,
    padding: 18,
    background: '#fafafa',
  },
  configRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  blurb: { fontSize: 13.5, color: tokens.muted, lineHeight: 1.55, margin: '0 0 14px' },
  bigValue: {
    fontSize: 52,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    color: tokens.text,
    lineHeight: 1.1,
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '14px 0',
  },
  muted: { color: tokens.muted, fontSize: 13 },
  badgeRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 14,
  },
  metaRow: { display: 'flex', gap: 10, marginTop: 12 },
  meta: {
    flex: 1,
    border: `1px solid ${tokens.border}`,
    borderRadius: 8,
    padding: '8px 12px',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  metaLabel: { fontSize: 11, color: tokens.faint, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: 14, fontVariantNumeric: 'tabular-nums', fontWeight: 600 },
  flow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    margin: '6px 0 16px',
  },
  flowNode: {
    fontSize: 13,
    fontWeight: 600,
    background: tokens.accentSoft,
    color: tokens.accent,
    padding: '5px 12px',
    borderRadius: 999,
  },
  flowArrow: {
    fontSize: 12,
    color: tokens.faint,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 13.5 },
  th: { textAlign: 'left', borderBottom: `2px solid ${tokens.border}`, padding: '8px 10px' },
  td: { borderBottom: '1px solid #eee', padding: '8px 10px', verticalAlign: 'top' },
};
