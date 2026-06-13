/**
 * Single source of truth for NocoBase code generation.
 *
 * Both the spec fetcher (scripts/fetch-specs.mjs) and orval (orval.config.ts)
 * import from here. To wire up another collection, just add its name to
 * COLLECTIONS below and re-run `npm run codegen`.
 */

/** NocoBase server origin (no trailing slash). Override with NOCOBASE_URL. */
export const NOCOBASE_URL = process.env.NOCOBASE_URL ?? 'http://localhost:1002';

/**
 * Token used ONLY to download the protected swagger specs at build time.
 * Override with the NOCOBASE_TOKEN env var; the fallback is the long-lived dev
 * root token. (Runtime requests from the app use their own token — see
 * src/api/nocobase-instance.ts.)
 */
export const NOCOBASE_TOKEN =
  process.env.NOCOBASE_TOKEN ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGVOYW1lIjoicm9vdCIsImlhdCI6MTc3OTcxMjQwMCwiZXhwIjozMzMzNzMxMjQwMH0.cwZGHL80jIFo1aFiYW32-LjiNrfi73BvQOxhP5gCtIk';

/**
 * NocoBase collections to generate a typed React Query client for.
 * Each one becomes its own orval target + output folder under
 * src/api/nocobase/<collection>.
 */
export const COLLECTIONS = [
  'together_news',
  'together_contact_forms',
  'plugin_sql_dump_tables',
];
