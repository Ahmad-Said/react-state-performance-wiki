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
      clean: true,
      prettier: false,
      override: {
        mutator: {
          path: './src/api/axios-instance.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
    },
  },
});
