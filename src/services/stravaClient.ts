/**
 * Shared axios client for the Strava API.
 *
 * Adds three cross-cutting concerns every Strava request benefits from:
 *   1. Transparent retry on `429 Too Many Requests`, honouring the
 *      `Retry-After` response header (Strava sends a value in seconds).
 *   2. Exponential backoff retry on 5xx responses (max 3 attempts).
 *   3. Parsing of the `X-RateLimit-Usage` / `X-RateLimit-Limit` headers
 *      so callers can react when utilisation is close to the quota.
 *
 * Strava enforces two concurrent limits: a short 15-minute window and a
 * daily window. Both are reported in the same header as
 * `short_usage,daily_usage`.
 *
 * Docs: https://developers.strava.com/docs/rate-limits/
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

export const STRAVA_API_BASE_URL = 'https://www.strava.com/api/v3'

export interface RateLimitInfo {
  /** Requests made in the current 15-minute window. */
  shortUsage?: number
  /** Configured limit for the 15-minute window (typically 100 or 200). */
  shortLimit?: number
  /** Requests made in the current day. */
  dailyUsage?: number
  /** Configured daily limit (typically 1 000 or 2 000). */
  dailyLimit?: number
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  __retryCount?: number
}

const MAX_RETRIES_5XX = 3
const MAX_RETRIES_429 = 2
const BASE_BACKOFF_MS = 500
const DEFAULT_RETRY_AFTER_SECONDS = 30
const RATE_LIMIT_WARN_THRESHOLD = 0.8

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type HeaderBag = AxiosResponse['headers'] | undefined
type HeaderValue = string | string[] | number | boolean | null | undefined

function readHeader(headers: HeaderBag, name: string): string | undefined {
  if (!headers) return undefined
  // axios headers can be a plain object or an AxiosHeaders instance,
  // and values are typed as `string | string[]`. Treat the object as a
  // case-insensitive bag and collapse array values to their first entry.
  const bag = headers as unknown as Record<string, HeaderValue>
  const raw = bag[name] ?? bag[name.toLowerCase()] ?? bag[name.toUpperCase()]
  if (raw == null) return undefined
  if (Array.isArray(raw)) return raw[0]
  return String(raw)
}

function parseRateLimit(headers: HeaderBag): RateLimitInfo | null {
  const usage = readHeader(headers, 'X-RateLimit-Usage')
  const limit = readHeader(headers, 'X-RateLimit-Limit')
  if (!usage || !limit) return null

  const [shortUsage, dailyUsage] = usage.split(',').map((n) => Number.parseInt(n.trim(), 10))
  const [shortLimit, dailyLimit] = limit.split(',').map((n) => Number.parseInt(n.trim(), 10))

  return {
    shortUsage: Number.isFinite(shortUsage) ? shortUsage : undefined,
    shortLimit: Number.isFinite(shortLimit) ? shortLimit : undefined,
    dailyUsage: Number.isFinite(dailyUsage) ? dailyUsage : undefined,
    dailyLimit: Number.isFinite(dailyLimit) ? dailyLimit : undefined,
  }
}

export function isNearRateLimit(info: RateLimitInfo): boolean {
  // Explicitly compare against `undefined` so that a reported limit of
  // `0` (unlikely but valid numeric configuration) isn't silently
  // treated as "unknown". Guard against division by zero separately.
  const short =
    info.shortUsage !== undefined && info.shortLimit !== undefined && info.shortLimit > 0
      ? info.shortUsage / info.shortLimit
      : 0
  const daily =
    info.dailyUsage !== undefined && info.dailyLimit !== undefined && info.dailyLimit > 0
      ? info.dailyUsage / info.dailyLimit
      : 0
  return Math.max(short, daily) >= RATE_LIMIT_WARN_THRESHOLD
}

export interface CreateStravaClientOptions {
  /** Called on every response that contains rate-limit headers. */
  onRateLimit?: (info: RateLimitInfo) => void
}

export function createStravaClient(options: CreateStravaClientOptions = {}): AxiosInstance {
  const instance = axios.create({
    baseURL: STRAVA_API_BASE_URL,
  })

  instance.interceptors.response.use(
    (response) => {
      const info = parseRateLimit(response.headers)
      if (info) {
        options.onRateLimit?.(info)
        if (isNearRateLimit(info)) {
          console.warn('[Strava] Approaching rate limit', info)
        }
      }
      return response
    },
    async (error: AxiosError) => {
      const config = error.config as RetryableConfig | undefined
      if (!config) throw error

      const info = parseRateLimit(error.response?.headers)
      if (info) options.onRateLimit?.(info)

      config.__retryCount = config.__retryCount ?? 0
      const status = error.response?.status

      // 429 — respect Retry-After (seconds). Retry up to MAX_RETRIES_429
      // times before giving up.
      if (status === 429 && config.__retryCount < MAX_RETRIES_429) {
        const retryAfterHeader = readHeader(error.response?.headers, 'Retry-After')
        const retryAfter =
          Number.parseInt(retryAfterHeader ?? '', 10) || DEFAULT_RETRY_AFTER_SECONDS
        console.warn(`[Strava] 429 rate limited — retrying in ${retryAfter}s`)
        await sleep(retryAfter * 1000)
        config.__retryCount += 1
        return instance.request(config)
      }

      // 5xx — exponential backoff: 500ms → 1s → 2s.
      if (
        status !== undefined &&
        status >= 500 &&
        status < 600 &&
        config.__retryCount < MAX_RETRIES_5XX
      ) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, config.__retryCount)
        await sleep(backoff)
        config.__retryCount += 1
        return instance.request(config)
      }

      throw error
    },
  )

  return instance
}
