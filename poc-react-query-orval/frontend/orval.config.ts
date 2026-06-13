import { defineConfig } from 'orval';

/**
 * Orval reads the FastAPI OpenAPI schema and generates:
 *  - typed TypeScript models
 *  - one React Query hook per endpoint (useListTodos, useCreateTodo, ...)
 *
 * The backend must be running on :8000 when you run `npm run orval`,
 * since the input points at its live /openapi.json.
 */
export default defineConfig({
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
      prettier: false,
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
