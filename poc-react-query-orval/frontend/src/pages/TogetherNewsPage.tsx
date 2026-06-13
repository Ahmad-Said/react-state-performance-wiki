import { useState } from 'react';
import { useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  useGetTogetherNewslist,
  usePostTogetherNewscreate,
  usePostTogetherNewsupdate,
  usePostTogetherNewsdestroy,
  getGetTogetherNewslistQueryKey,
} from '../api/nocobase/together_news/together-news/together-news';
import type { TogetherNews } from '../api/nocobase/together_news/model';
import { Badge, Button, Callout, Card, Code, Footnote, PageHeader, Spinner, tokens } from '../ui/kit';

const PAGE_SIZE = 8;

/** The editable subset of a news record (readonly id/timestamps are stripped). */
type NewsForm = {
  title_en: string;
  title_ar: string;
  slug: string;
  status: string;
  published_at: string;
  headline_en: string;
  headline_ar: string;
  content_en: string;
  content_ar: string;
};

const EMPTY_FORM: NewsForm = {
  title_en: '',
  title_ar: '',
  slug: '',
  status: 'draft',
  published_at: '',
  headline_en: '',
  headline_ar: '',
  content_en: '',
  content_ar: '',
};

const STATUS_TONE: Record<string, 'green' | 'amber' | 'neutral'> = {
  published: 'green',
  draft: 'amber',
};

/** Map a record from the API into form values (nulls → empty strings). */
function toForm(news: TogetherNews): NewsForm {
  return {
    title_en: news.title_en?? '',
    title_ar: news.title_ar ?? '',
    slug: news.slug ?? '',
    status: news.status ?? 'draft',
    // <input type="datetime-local"> wants `YYYY-MM-DDTHH:mm`, not an ISO string.
    published_at: news.published_at ? news.published_at.slice(0, 16) : '',
    headline_en: news.headline_en ?? '',
    headline_ar: news.headline_ar ?? '',
    content_en: news.content_en ?? '',
    content_ar: news.content_ar ?? '',
  };
}

/** Drop empty strings so we don't send blank fields, and re-ISO the date. */
function toPayload(form: NewsForm) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(form)) {
    if (!value) continue;
    out[key] = key === 'published_at' ? new Date(value).toISOString() : value;
  }
  return out;
}

/**
 * Full CRUD over the NocoBase `together_news` collection. Every hook and type
 * below is Orval-generated from the NocoBase OpenAPI spec — list/create/update/
 * destroy all go through `nocobaseInstance`. We just wire them to a form and a
 * list, invalidating the list query after each mutation.
 */
export function TogetherNewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<NewsForm>(EMPTY_FORM);

  // GET /together_news:list — newest first, paged.
  const { data, isLoading, isFetching, isError, error } = useGetTogetherNewslist(
    { page, pageSize: PAGE_SIZE, sort: '-createdAt' },
    { query: { placeholderData: keepPreviousData } },
  );

  const items = data?.data ?? [];
  const totalPages = data?.meta?.totalPage ?? 1;
  const total = data?.meta?.count;

  // Re-fetch every page of the list after any write.
  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: getGetTogetherNewslistQueryKey() });

  const createNews = usePostTogetherNewscreate({ mutation: { onSuccess: invalidateList } });
  const updateNews = usePostTogetherNewsupdate({ mutation: { onSuccess: invalidateList } });
  const deleteNews = usePostTogetherNewsdestroy({ mutation: { onSuccess: invalidateList } });

  const isSaving = createNews.isPending || updateNews.isPending;
  const set = (key: keyof NewsForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (news: TogetherNews) => {
    setEditingId(news.id ?? null);
    setForm(toForm(news));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title_en.trim()) return;
    const payload = toPayload(form);

    if (editingId != null) {
      updateNews.mutate(
        { data: payload, params: { filterByTk: editingId } },
        { onSuccess: resetForm },
      );
    } else {
      createNews.mutate({ data: payload }, { onSuccess: resetForm });
    }
  };

  return (
    <div>
      <PageHeader
        icon="📰"
        title="Together News"
        subtitle={
          <>
            CRUD over the NocoBase <Code>together_news</Code> collection, using
            Orval-generated React Query hooks.
          </>
        }
      />

      {/* ---- Create / edit form ---- */}
      <Card highlight={editingId != null} style={{ marginBottom: 20 }}>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formHeader}>
            <strong>{editingId != null ? `Editing #${editingId}` : 'New article'}</strong>
            {editingId != null && (
              <Button type="button" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>

          <div style={styles.grid}>
            <Field label="Title (EN) *">
              <input value={form.title_en} onChange={set('title_en')} style={styles.input} placeholder="Headline in English" />
            </Field>
            <Field label="Title (AR)">
              <input value={form.title_ar} onChange={set('title_ar')} style={styles.input} dir="rtl" placeholder="العنوان بالعربية" />
            </Field>
            <Field label="Slug">
              <input value={form.slug} onChange={set('slug')} style={styles.input} placeholder="my-article-slug" />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={set('status')} style={styles.input}>
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </select>
            </Field>
            <Field label="Published at">
              <input type="datetime-local" value={form.published_at} onChange={set('published_at')} style={styles.input} />
            </Field>
            <Field label="Headline (EN)">
              <input value={form.headline_en} onChange={set('headline_en')} style={styles.input} />
            </Field>
            <Field label="Headline (AR)">
              <input value={form.headline_ar} onChange={set('headline_ar')} style={styles.input} dir="rtl" />
            </Field>
          </div>

          <Field label="Content (EN)">
            <textarea value={form.content_en} onChange={set('content_en')} style={styles.textarea} rows={3} />
          </Field>
          <Field label="Content (AR)">
            <textarea value={form.content_ar} onChange={set('content_ar')} style={styles.textarea} rows={3} dir="rtl" />
          </Field>

          <div>
            <Button primary type="submit" disabled={isSaving || !form.title_en.trim()}>
              {isSaving ? 'Saving…' : editingId != null ? 'Save changes' : 'Create article'}
            </Button>
          </div>
        </form>
      </Card>

      {/* ---- List ---- */}
      <div style={styles.listHeader}>
        <strong>Articles{total != null ? ` (${total})` : ''}</strong>
        {isFetching && (
          <span style={styles.fetching}>
            <Spinner size={13} /> refreshing…
          </span>
        )}
      </div>

      {isError && <Callout tone="danger">Failed to load: {error?.message ?? 'unknown error'}</Callout>}

      {isLoading ? (
        <div style={styles.center}>
          <Spinner size={28} />
        </div>
      ) : items.length === 0 ? (
        <Callout>No articles yet. Create the first one above.</Callout>
      ) : (
        <ul style={styles.list}>
          {items.map((news) => (
            <Card key={news.id} highlight={news.id === editingId} style={styles.item}>
              <div style={{ minWidth: 0 }}>
                <div style={styles.itemTitle}>{news.title_en || news.title_ar || '(untitled)'}</div>
                <div style={styles.itemMeta}>
                  <Badge tone={STATUS_TONE[news.status ?? ''] ?? 'neutral'}>{news.status ?? '—'}</Badge>
                  {news.slug && <Code>{news.slug}</Code>}
                  <span style={{ color: tokens.faint }}>#{news.id}</span>
                </div>
              </div>
              <div style={styles.itemActions}>
                <Button type="button" onClick={() => startEdit(news)}>
                  Edit
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (news.id != null && confirm(`Delete "${news.title_en || news.slug || news.id}"?`)) {
                      deleteNews.mutate({ params: { filterByTk: news.id } });
                    }
                  }}
                  style={{ color: tokens.red, borderColor: '#fecaca' }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </ul>
      )}

      {/* ---- Pager ---- */}
      {totalPages > 1 && (
        <div style={styles.pager}>
          <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            ← Prev
          </Button>
          <span style={{ fontSize: 14 }}>
            Page <strong>{page}</strong> of {totalPages}
          </span>
          <Button primary onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next →
          </Button>
        </div>
      )}

      <Footnote>
        Source: <Code>src/pages/TogetherNewsPage.tsx</Code> · NocoBase actions{' '}
        <Code>together_news:list/create/update/destroy</Code>.
      </Footnote>
    </div>
  );
}

/** Labelled vertical field wrapper. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  formHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 12.5, fontWeight: 600, color: tokens.muted },
  input: { padding: '7px 9px', fontSize: 14, border: `1px solid ${tokens.border}`, borderRadius: 8, width: '100%', boxSizing: 'border-box' },
  textarea: { padding: '7px 9px', fontSize: 14, border: `1px solid ${tokens.border}`, borderRadius: 8, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' },
  listHeader: { display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 12px' },
  fetching: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: tokens.muted },
  center: { display: 'flex', justifyContent: 'center', padding: '48px 0' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 },
  item: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px' },
  itemTitle: { fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemMeta: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12.5 },
  itemActions: { display: 'flex', gap: 8, flexShrink: 0 },
  pager: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 },
};
