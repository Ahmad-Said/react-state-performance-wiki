import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/**
 * Custom axios instance used as Orval's "mutator".
 *
 * Every generated hook calls `customInstance` instead of fetch/axios directly,
 * which gives us a single place to set the base URL, auth headers, interceptors,
 * cancellation, etc.
 */
export const AXIOS_INSTANCE = axios.create({
  baseURL: 'http://localhost:8000',
});

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const source = axios.CancelToken.source();

  const promise = AXIOS_INSTANCE({
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
