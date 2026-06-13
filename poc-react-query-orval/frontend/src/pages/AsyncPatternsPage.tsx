import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSearchArticles,
  useGetArticle,
  getGetArticleQueryOptions,
} from '../api/generated/articles/articles';
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

/** Debounce a value so we don't fire a query on every keystroke. */
function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * Three async patterns that share one page because they're all about *when* a
 * query runs: dependent (gated by `enabled`), prefetched (warm the cache before
 * you need it), and polled (`refetchInterval`).
 */
export function AsyncPatternsPage() {
  return (
    <div>
      <PageHeader
        icon="🔗"
        title="Dependent · Prefetch · Polling"
        subtitle="Three ways to control when a query actually fires."
      />
      <DependentSection />
      <PrefetchSection />
      <PollingSection />

      <Footnote>
        Source: <Code>src/pages/AsyncPatternsPage.tsx</Code> · routes{' '}
        <Code>/articles/search</Code>, <Code>/articles/&#123;id&#125;</Code>, <Code>/stats</Code>.
      </Footnote>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Dependent query — gated by `enabled`                            */
/* ------------------------------------------------------------------ */
function DependentSection() {
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim());
  const enabled = q.length > 0;

  const { data, isFetching, fetchStatus, status } = useSearchArticles(
    { q },
    { query: { enabled } },
  );

  return (
    <section>
      <SectionTitle>1 · Dependent query</SectionTitle>
      <p style={styles.lead}>
        The search query is <Code>enabled</Code> only once you've typed something — until then it
        sits idle and never hits the network.
      </p>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search article titles (e.g. 'cache', 'query')…"
        style={styles.input}
      />

      <div style={styles.statusRow}>
        <Badge tone={enabled ? 'accent' : 'neutral'}>enabled: {String(enabled)}</Badge>
        <Badge tone={fetchStatus === 'fetching' ? 'amber' : 'neutral'}>
          fetchStatus: {fetchStatus}
        </Badge>
        <Badge tone="neutral">status: {status}</Badge>
      </div>

      {!enabled ? (
        <Callout style={{ marginTop: 10 }}>
          Idle. Note <Code>fetchStatus: idle</Code> even though <Code>status</Code> is{' '}
          <Code>pending</Code> — the query is parked, not loading.
        </Callout>
      ) : isFetching ? (
        <p style={styles.muted}>
          <Spinner size={13} /> searching “{q}”…
        </p>
      ) : (
        <ul style={styles.resultList}>
          {data && data.length > 0 ? (
            data.map((a) => (
              <li key={a.id} style={styles.resultItem}>
                {a.title}
              </li>
            ))
          ) : (
            <li style={styles.muted}>No matches for “{q}”.</li>
          )}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Prefetch on hover — warm the cache before the click             */
/* ------------------------------------------------------------------ */
const PREFETCH_IDS = [1, 7, 13, 21, 34];

function PrefetchSection() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [prefetched, setPrefetched] = useState<Set<number>>(new Set());
  const [openedFromCache, setOpenedFromCache] = useState<boolean | null>(null);

  const prefetch = (id: number) => {
    if (prefetched.has(id)) return;
    queryClient.prefetchQuery(getGetArticleQueryOptions(id));
    setPrefetched((prev) => new Set(prev).add(id));
  };

  const open = (id: number) => {
    // Was it already in cache when we clicked? That's the prefetch paying off.
    setOpenedFromCache(queryClient.getQueryData(getGetArticleQueryOptions(id).queryKey) != null);
    setSelectedId(id);
  };

  const { data: article, isFetching } = useGetArticle(selectedId ?? 0, {
    query: { enabled: selectedId != null },
  });

  return (
    <section>
      <SectionTitle>2 · Prefetch on hover</SectionTitle>
      <p style={styles.lead}>
        Hovering a row calls <Code>queryClient.prefetchQuery</Code>, so by the time you click, the
        0.6s fetch is usually already done — the detail opens instantly.
      </p>

      <div style={styles.chipRow}>
        {PREFETCH_IDS.map((id) => (
          <button
            key={id}
            onMouseEnter={() => prefetch(id)}
            onFocus={() => prefetch(id)}
            onClick={() => open(id)}
            style={{
              ...styles.chip,
              ...(selectedId === id ? styles.chipActive : null),
            }}
          >
            Article #{id}
            {prefetched.has(id) && <span style={styles.dot} title="prefetched" />}
          </button>
        ))}
      </div>

      <Card style={{ marginTop: 12, minHeight: 84 }}>
        {selectedId == null ? (
          <span style={styles.muted}>Hover a chip (prefetch), then click it to open.</span>
        ) : isFetching && openedFromCache === false ? (
          <span style={styles.muted}>
            <Spinner size={13} /> fetching (you clicked before prefetch finished)…
          </span>
        ) : article ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>{article.title}</strong>
              {openedFromCache ? (
                <Badge tone="green">⚡ from cache (instant)</Badge>
              ) : (
                <Badge tone="amber">network</Badge>
              )}
            </div>
            <p style={{ fontSize: 13.5, color: tokens.muted, margin: '6px 0 0' }}>{article.body}</p>
          </>
        ) : null}
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Polling — refetchInterval                                       */
/* ------------------------------------------------------------------ */
function PollingSection() {
  const [polling, setPolling] = useState(true);

  const { data: stats, dataUpdatedAt, isFetching } = useGetStats({
    query: { refetchInterval: polling ? 2000 : false },
  });

  return (
    <section>
      <SectionTitle>3 · Polling</SectionTitle>
      <p style={styles.lead}>
        <Code>refetchInterval: 2000</Code> re-runs the query every 2s. The server returns a fresh{' '}
        <Code>active_users</Code> each call, so you can watch it tick.
      </p>

      <label style={styles.switch}>
        <input type="checkbox" checked={polling} onChange={(e) => setPolling(e.target.checked)} />
        Poll every 2s {isFetching && <Spinner size={12} />}
      </label>

      <div style={styles.statGrid}>
        <Stat label="Active users" value={stats?.active_users ?? '—'} live />
        <Stat label="Articles" value={stats?.total_articles ?? '—'} />
        <Stat label="Todos" value={stats?.total_todos ?? '—'} />
      </div>
      <p style={styles.muted}>
        Last updated: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—'}
      </p>
    </section>
  );
}

function Stat({ label, value, live }: { label: string; value: number | string; live?: boolean }) {
  return (
    <Card style={{ textAlign: 'center', padding: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: tokens.muted, display: 'flex', justifyContent: 'center', gap: 6 }}>
        {label}
        {live && <span style={styles.livePill}>live</span>}
      </div>
    </Card>
  );
}

const styles: Record<string, React.CSSProperties> = {
  lead: { fontSize: 13.5, color: tokens.muted, margin: '2px 0 12px', lineHeight: 1.5 },
  input: { width: '100%', padding: '9px 12px', fontSize: 15, boxSizing: 'border-box', borderRadius: 8, border: `1px solid ${tokens.border}` },
  statusRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 },
  muted: { color: tokens.muted, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 },
  resultList: { listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 6 },
  resultItem: { fontSize: 14, padding: '8px 12px', border: `1px solid ${tokens.border}`, borderRadius: 8, background: '#fff' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 },
  chipActive: { background: tokens.accentSoft, borderColor: tokens.accentBorder, color: tokens.accent, fontWeight: 600 },
  dot: { width: 7, height: 7, borderRadius: '50%', background: tokens.green, display: 'inline-block' },
  switch: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '12px 0 8px' },
  livePill: { fontSize: 10, fontWeight: 700, color: '#fff', background: tokens.green, padding: '1px 6px', borderRadius: 999, textTransform: 'uppercase' },
};
