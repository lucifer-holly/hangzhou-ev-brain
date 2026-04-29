import axios, { AxiosError } from 'axios'

import { env } from './env'

/**
 * Shared axios instance for all REST calls to the FastAPI backend.
 *
 * `baseURL` is read from `VITE_API_BASE_URL` (see `lib/env.ts`).
 * Per-domain modules (`api/piles.ts`, etc.) build on top of this client
 * rather than instantiating their own.
 */
export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ detail?: unknown }>) => {
    const detail = error.response?.data?.detail
    const msg =
      typeof detail === 'string'
        ? detail
        : detail
          ? JSON.stringify(detail)
          : error.message
    return Promise.reject(
      Object.assign(new Error(`[${error.response?.status ?? 'NET'}] ${msg}`), {
        cause: error,
        status: error.response?.status,
      }),
    )
  },
)
