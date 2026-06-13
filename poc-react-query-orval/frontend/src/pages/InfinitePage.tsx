import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { listArticleFeed, getListArticleFeedQueryKey } from '../api/generated/articles/articles';
import { Badge, Button, Callout, Card, Code, Footnote, PageHeader, Spinner, tokens } from '../ui/kit';

const LIMIT = 8;

/**
 * `useInfiniteQuery` over the cursor route. Orval generates one typed fetcher
 * per endpoint (`listArticleFeed`); we compose the infinite hook from it, so the
 * request/response types still flow straight through from the backend schema.
 */
export function InfinitePage() {
  const [autoLoad, setAutoLoad] = useState(false);

  const {
    data,
    error,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: getListArticleFeedQueryKey({ limit: LIMIT }),
    queryFn: ({ pageParam }) => listArticleFeed({ start: pageParam, limit: LIMIT }),
    initialPageParam: 0,
    // Each page hands back the cursor for the next slice; `undefined` ends it.
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  // Flatten the page array into a single list for rendering.
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const loadedPages = data?.pages.length ?? 0;

  // Optional: auto-load when a sentinel scrolls into view (infinite scroll).
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!autoLoad || !hasNextPage) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoLoad, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div>
      <PageHeader
        icon="♾️"
        title="Infinite Query"
        subtitle={
          <>
            <Code>useInfiniteQuery</Code> turns a cursor route into an append-only feed.
          </>
        }
      />

      <div style={styles.controls}>
        <label style={styles.switch}>
          <input
            type="checkbox"
            checked={autoLoad}
            onChange={(e) => setAutoLoad(e.target.checked)}
          />
          Auto-load on scroll
        </label>
        <span style={{ flex: 1 }} />
        <Badge tone="accent">
          {items.length} loaded · {loadedPages} page{loadedPages === 1 ? '' : 's'}
        </Badge>
      </div>

      <Callout style={{ marginBottom: 16 }}>
        Each <Code>fetchNextPage()</Code> calls the cursor route and{' '}
        <strong>appends</strong> a page to <Code>data.pages</Code> — earlier pages stay cached, so
        nothing re-fetches. {autoLoad ? 'Scroll to the bottom and pages load automatically.' : 'Use the button, or flip on auto-load.'}
      </Callout>

      {error && <Callout tone="danger">Failed to load the feed.</Callout>}

      {isLoading ? (
        <div style={styles.center}>
          <Spinner size={28} />
        </div>
      ) : (
        <ul style={styles.list}>
          {items.map((a, i) => (
            <Card key={a.id} style={styles.item}>
              <span style={styles.index}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
                <div style={{ fontSize: 12.5, color: tokens.muted }}>
                  {a.author} · {a.read_minutes} min read
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />

      <div style={styles.footer}>
        {hasNextPage ? (
          <Button primary onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? (
              <>
                <Spinner size={13} /> &nbsp;Loading…
              </>
            ) : (
              'Load more'
            )}
          </Button>
        ) : (
          !isLoading && <Badge tone="green">🎉 End of feed — all {items.length} loaded</Badge>
        )}
      </div>

      <Footnote>
        Source: <Code>src/pages/InfinitePage.tsx</Code> · backend route{' '}
        <Code>GET /articles/feed?cursor=&amp;limit={LIMIT}</Code>.
      </Footnote>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  controls: { display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 14px' },
  switch: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' },
  center: { display: 'flex', justifyContent: 'center', padding: '48px 0' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 },
  item: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' },
  index: {
    fontSize: 12,
    fontWeight: 700,
    color: tokens.faint,
    minWidth: 24,
    fontVariantNumeric: 'tabular-nums',
  },
  footer: { display: 'flex', justifyContent: 'center', padding: '16px 0' },
};
