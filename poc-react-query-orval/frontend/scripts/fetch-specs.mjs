/**
 * Downloads the OpenAPI spec for each configured NocoBase collection into
 * ./openapi/<collection>.json.
 *
 * Why a script instead of pointing orval straight at the URL: NocoBase's
 * `swagger:get` endpoint requires an `Authorization: Bearer` header, and
 * orval's `input.target` URL form can't send headers. So we fetch the specs
 * here (with auth) and orval reads the saved files.
 *
 * Usage: `npm run fetch:specs` (or `npm run codegen` to fetch + generate).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COLLECTIONS, NOCOBASE_TOKEN, NOCOBASE_URL } from '../nocobase.config.mjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'openapi');

async function fetchSpec(collection) {
  const ns = encodeURIComponent(`collections/${collection}`);
  const url = `${NOCOBASE_URL}/api/swagger:get?ns=${ns}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${NOCOBASE_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`${collection}: HTTP ${res.status} ${res.statusText} (${url})`);
  }

  const spec = await res.json();
  const pathCount = Object.keys(spec.paths ?? {}).length;
  if (pathCount === 0) {
    throw new Error(`${collection}: spec has no paths — is the collection name correct?`);
  }

  await writeFile(join(outDir, `${collection}.json`), JSON.stringify(spec, null, 2));
  console.log(`  ✓ ${collection} (${pathCount} paths) -> openapi/${collection}.json`);
}

await mkdir(outDir, { recursive: true });
console.log(`Fetching ${COLLECTIONS.length} spec(s) from ${NOCOBASE_URL} ...`);

const results = await Promise.allSettled(COLLECTIONS.map(fetchSpec));
const failures = results.filter((r) => r.status === 'rejected');
for (const f of failures) console.error(`  ✗ ${f.reason.message}`);

if (failures.length > 0) {
  console.error(`\n${failures.length}/${COLLECTIONS.length} spec(s) failed.`);
  process.exit(1);
}
console.log(`\nDone. Run "npm run orval" to generate the client.`);
