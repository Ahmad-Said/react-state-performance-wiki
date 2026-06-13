import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/**
 * Orval mutator for the NocoBase-generated clients.
 *
 * Kept separate from `axios-instance.ts` (the FastAPI :8000 demo) because the
 * two backends differ in base URL and auth. The generated NocoBase URLs are
 * relative action paths like `/together_news:list`; the spec's server is
 * `/api/`, which orval drops, so the base URL must include `/api`.
 *
 * Auth: requests carry a Bearer token. Provide it via the VITE_NOCOBASE_TOKEN
 * env var (e.g. in a .env file); the fallback is the dev root token.
 */
const NOCOBASE_BASE_URL =
  import.meta.env.VITE_NOCOBASE_URL ?? 'http://localhost:1002/api';

const NOCOBASE_TOKEN =
  import.meta.env.VITE_NOCOBASE_TOKEN ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGVOYW1lIjoicm9vdCIsImlhdCI6MTc3OTcxMjQwMCwiZXhwIjozMzMzNzMxMjQwMH0.cwZGHL80jIFo1aFiYW32-LjiNrfi73BvQOxhP5gCtIk';

export const NOCOBASE_AXIOS_INSTANCE = axios.create({
  baseURL: NOCOBASE_BASE_URL,
  headers: { Authorization: `Bearer ${NOCOBASE_TOKEN}` },
});

export const nocobaseInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const source = axios.CancelToken.source();

  const promise = NOCOBASE_AXIOS_INSTANCE({
    ...config,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // React Query cancels in-flight requests via this attached method.
  // @ts-expect-error -- attaching cancel for React Query
  promise.cancel = () => source.cancel('Query was cancelled');

  return promise;
};

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
