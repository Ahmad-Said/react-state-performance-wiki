import { useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { useListArticles } from '../api/generated/articles/articles';
import { Badge, Button, Callout, Card, Code, Footnote, PageHeader, Spinner, tokens } from '../ui/kit';

const PAGE_SIZE = 10;

/**
 * Offset pagination with `placeholderData: keepPreviousData`. While the next
 * page loads, React Query keeps the previous page on screen (dimmed) instead of
 * flashing to a spinner. The toggle turns that off so you can feel the jank.
 */
export function PaginationPage() {
  const [page, setPage] = useState(1);
  const [keepPrev, setKeepPrev] = useState(true);

  const { data, isLoading, isFetching, isPlaceholderData, isError } = useListArticles(
    { page, page_size: PAGE_SIZE },
    { query: { placeholderData: keepPrev ? keepPreviousData : undefined } },
  );

  const totalPages = data?.total_pages ?? 1;
  // With keepPreviousData the old page lingers; dim it to signal "stale".
  const showingStale = isPlaceholderData;

  return (
    <div>
      <PageHeader
        icon="📄"
        title="Pagination"
        subtitle={
          <>
            Offset paging that doesn't flicker, via{' '}
            <Code>placeholderData: keepPreviousData</Code>.
          </>
        }
      />

      <div style={styles.controls}>
        <label style={styles.switch}>
          <input
            type="checkbox"
            checked={keepPrev}
            onChange={(e) => setKeepPrev(e.target.checked)}
          />
          keepPreviousData
        </label>
        <span style={{ flex: 1 }} />
        {isFetching && (
          <span style={styles.fetching}>
            <Spinner size={13} /> fetching…
          </span>
        )}
      </div>

      <Callout style={{ marginBottom: 16 }}>
        {keepPrev ? (
          <>
            Click <strong>Next</strong> repeatedly: the list stays put and just dims while the new
            page loads — no layout jump, no spinner. That's <Code>keepPreviousData</Code>.
          </>
        ) : (
          <>
            With it off, every page change is a brand-new cache key, so the list{' '}
            <strong>blanks to a spinner</strong> for 0.6s each time. Turn it back on to compare.
          </>
        )}
      </Callout>

      {isError && <Callout tone="danger">Failed to load articles.</Callout>}

      {isLoading ? (
        <div style={styles.center}>
          <Spinner size={28} />
        </div>
      ) : (
        <ul
          style={{
            ...styles.list,
            opacity: showingStale ? 0.45 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {data?.items.map((a) => (
            <Card key={a.id} style={styles.item}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
                <div style={{ fontSize: 12.5, color: tokens.muted }}>
                  {a.author} · {a.read_minutes} min read
                </div>
              </div>
              <Badge tone="neutral">#{a.id}</Badge>
            </Card>
          ))}
        </ul>
      )}

      <div style={styles.pager}>
        <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
          ← Prev
        </Button>
        <span style={styles.pageInfo}>
          Page <strong>{data?.page ?? page}</strong> of {totalPages}
          <span style={{ color: tokens.faint }}> · {data?.total ?? '—'} articles</span>
          {showingStale && (
            <Badge tone="amber" style={{ marginLeft: 8 }}>
              showing previous page
            </Badge>
          )}
        </span>
        <Button
          primary
          onClick={() => {
            if (!isPlaceholderData && data?.has_next) setPage((p) => p + 1);
          }}
          // Canonical guard: don't skip ahead until the next page has resolved.
          disabled={isLoading || isPlaceholderData || !data?.has_next}
        >
          Next →
        </Button>
      </div>

      <Footnote>
        Source: <Code>src/pages/PaginationPage.tsx</Code> · backend route{' '}
        <Code>GET /articles?page=&amp;page_size=</Code> (97 articles, {PAGE_SIZE}/page).
      </Footnote>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  controls: { display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 14px' },
  switch: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' },
  fetching: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: tokens.muted },
  center: { display: 'flex', justifyContent: 'center', padding: '48px 0' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8, minHeight: 200 },
  item: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' },
  pager: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 },
  pageInfo: { fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
};
