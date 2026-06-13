import { defineConfig } from 'orval';

import { COLLECTIONS } from './nocobase.config.mjs';

/**
 * Orval reads the FastAPI OpenAPI schema and generates:
 *  - typed TypeScript models
 *  - one React Query hook per endpoint (useListTodos, useCreateTodo, ...)
 *
 * The backend must be running on :8000 when you run `npm run orval`,
 * since the input points at its live /openapi.json.
 */

/**
 * Works around a bug in NocoBase's generated spec: the component parameter
 * keyed `filterByTks` carries `name: "filterByTk"`, so the relation `:set`/
 * `:remove` endpoints emit two query params with the same name but different
 * types — which produces a TS type with a duplicate property. Every other
 * NocoBase component parameter's `name` already equals its key, so re-aligning
 * name->key is a safe, general fix.
 */
const fixNocobaseSpec = (spec: any) => {
  const params = spec?.components?.parameters ?? {};
  for (const [key, param] of Object.entries<any>(params)) {
    if (param && typeof param === 'object' && 'name' in param && param.name !== key) {
      param.name = key;
    }
  }

  // Skip nested relation endpoints (e.g. /together_news/{collectionIndex}/...).
  // We only generate the top-level collection CRUD; orval drops the now-unused
  // relation-only schemas/params on its own.
  for (const path of Object.keys(spec?.paths ?? {})) {
    if (path.includes('{collectionIndex}')) {
      delete spec.paths[path];
    }
  }

  return spec;
};

/**
 * One target per NocoBase collection, built from the shared COLLECTIONS list
 * in nocobase.config.mjs. Each reads a spec saved under ./openapi by
 * `npm run fetch:specs` and generates into its own folder (NocoBase specs each
 * redeclare shared schemas, so isolating them avoids name clashes and keeps
 * `clean` from wiping sibling collections). Add a collection there, not here.
 */
const nocobaseTargets = Object.fromEntries(
  COLLECTIONS.map((collection) => [
    collection,
    {
      input: {
        target: `./openapi/${collection}.json`,
        override: { transformer: fixNocobaseSpec },
      },
      output: {
        mode: 'tags-split',
        target: `./src/api/nocobase/${collection}`,
        schemas: `./src/api/nocobase/${collection}/model`,
        client: 'react-query',
        httpClient: 'axios',
        clean: true,
        override: {
          mutator: {
            path: './src/api/nocobase-instance.ts',
            name: 'nocobaseInstance',
          },
        },
      },
    },
  ]),
);

export default defineConfig({
  ...nocobaseTargets,
  todo: {
    input: {
      target: 'http://localhost:8000/openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: './src/api/generated',
      schemas: './src/api/generated/model',
      client: 'react-query',
      // Orval v8 flipped the default HTTP client to `fetch`, which changes the
      // mutator contract to `(url, RequestInit)` and wraps responses in
      // `{ data, status, headers }`. Pin `axios` so our `customInstance`
      // mutator (single AxiosRequestConfig arg) keeps working and responses
      // stay the plain backend models.
      httpClient: 'axios',
      clean: true,
      override: {
        mutator: {
          path: './src/api/axios-instance.ts',
          name: 'customInstance',
        },
        // Let orval pick the hook kind from the HTTP method (GET -> useQuery,
        // POST/PATCH/DELETE -> useMutation). In v8, forcing both flags on
        // generates a query *and* a mutation for every endpoint and mislabels
        // the default hook, so we rely on the method-based default instead.
      },
    },
  },
});
