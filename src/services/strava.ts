import axios, { type AxiosInstance } from 'axios'
import { createStravaClient, type RateLimitInfo } from './stravaClient'
import {
  clearCachedActivities,
  enrichActivity,
  getCacheTime,
  loadCachedActivities,
  migrateLegacyCacheIfNeeded,
  saveCachedActivities,
  type CachedActivity,
} from './activityCache'

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize'
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'

/** Number of pages requested in parallel during a bulk sync. */
const SYNC_CONCURRENCY = 3
/** Strava hard cap for this endpoint — keep at 200 to minimise roundtrips. */
const SYNC_PAGE_SIZE = 200

export interface StravaActivity {
  id: number
  name: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  type: string
  start_date: string
  start_date_local: string
  timezone: string
  utc_offset: number
  start_latlng: [number, number] | null
  end_latlng: [number, number] | null
  map: {
    id: string
    summary_polyline: string
    resource_state: number
  }
  average_speed: number
  max_speed: number
  average_heartrate?: number
  max_heartrate?: number
  kudos_count: number
  comment_count: number
  athlete_count: number
  photo_count: number
  achievement_count: number
}

export interface StravaConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface SyncProgress {
  /** Pages fetched so far (successful requests). */
  pagesFetched: number
  /** Total activities currently known (including cached). */
  activitiesKnown: number
  /**
   * Cumulative activity list after merging the most recent batch. The
   * UI can assign this directly to its reactive list so the map/list
   * fill in progressively instead of waiting for the full sync.
   */
  partial: CachedActivity[]
}

export interface GetCachedActivitiesOptions {
  /** Ignore cache and re-download the entire activity history. */
  forceRefresh?: boolean
  /**
   * Bypass the cache TTL: if we have cached data, still fetch only the
   * activities newer than the newest cached one (incremental sync).
   */
  forceIncremental?: boolean
  onProgress?: (progress: SyncProgress) => void
}

export class StravaService {
  private config: StravaConfig
  private accessToken: string | null = null
  private cacheTTL = 60 * 60 // 1 hour

  private client: AxiosInstance
  private refreshPromise: Promise<void> | null = null

  /** Optional subscriber for rate-limit info. UI can use this to warn users. */
  public onRateLimit: ((info: RateLimitInfo) => void) | null = null

  constructor(config: StravaConfig) {
    this.config = config
    this.loadTokenFromStorage()
    this.client = createStravaClient({
      onRateLimit: (info) => this.onRateLimit?.(info),
    })
    // Fire-and-forget: if there's a legacy localStorage cache from a
    // previous build, move it into IDB on startup.
    migrateLegacyCacheIfNeeded()
  }

  // ---------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------

  private loadTokenFromStorage(): void {
    this.accessToken = localStorage.getItem('strava_access_token')
  }

  private saveTokenToStorage(token: string): void {
    this.accessToken = token
    localStorage.setItem('strava_access_token', token)
  }

  private clearTokenFromStorage(): void {
    this.accessToken = null
    localStorage.removeItem('strava_access_token')
    localStorage.removeItem('strava_refresh_token')
    localStorage.removeItem('strava_expires_at')
  }

  public getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'read,activity:read_all',
      approval_prompt: 'force',
    })

    return `${STRAVA_AUTH_URL}?${params.toString()}`
  }

  public async exchangeCodeForToken(code: string): Promise<void> {
    try {
      const response = await axios.post(STRAVA_TOKEN_URL, {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
      })

      const { access_token, refresh_token, expires_at } = response.data

      this.saveTokenToStorage(access_token)
      localStorage.setItem('strava_refresh_token', refresh_token)
      localStorage.setItem('strava_expires_at', expires_at.toString())
    } catch (error) {
      console.error('Error exchanging code for token:', error)
      throw new Error('Failed to authenticate with Strava')
    }
  }

  /**
   * Refresh the access token. Uses a single-flight promise so that N
   * concurrent requests that all notice the token is stale share one
   * refresh round-trip instead of racing to invalidate each other.
   */
  public async refreshToken(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise
    this.refreshPromise = this._performRefresh().finally(() => {
      this.refreshPromise = null
    })
    return this.refreshPromise
  }

  private async _performRefresh(): Promise<void> {
    const refreshToken = localStorage.getItem('strava_refresh_token')
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await axios.post(STRAVA_TOKEN_URL, {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      })

      const { access_token, refresh_token: newRefreshToken, expires_at } = response.data

      this.saveTokenToStorage(access_token)
      localStorage.setItem('strava_refresh_token', newRefreshToken)
      localStorage.setItem('strava_expires_at', expires_at.toString())
    } catch (error) {
      console.error('Error refreshing token:', error)
      this.clearTokenFromStorage()
      throw new Error('Failed to refresh Strava token')
    }
  }

  public async checkTokenValidity(): Promise<boolean> {
    const expiresAt = localStorage.getItem('strava_expires_at')

    if (!expiresAt || !this.accessToken) {
      return false
    }

    const now = Math.floor(Date.now() / 1000)
    const expires = parseInt(expiresAt)

    if (now >= expires) {
      try {
        await this.refreshToken()
        return true
      } catch {
        return false
      }
    }

    return true
  }

  public isAuthenticated(): boolean {
    return !!this.accessToken
  }

  public async logout(): Promise<void> {
    await this.clearCache()
    this.clearTokenFromStorage()
  }

  // ---------------------------------------------------------------
  // HTTP
  // ---------------------------------------------------------------

  private async makeAuthenticatedRequest<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Not authenticated')
    }

    const isValid = await this.checkTokenValidity()
    if (!isValid) {
      throw new Error('Invalid or expired token')
    }

    try {
      // `baseURL` is set once on the shared axios instance in
      // `createStravaClient`; don't duplicate it on every call.
      const response = await this.client.get<T>(path, {
        params,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        this.clearTokenFromStorage()
        throw new Error('Authentication failed')
      }
      throw error
    }
  }

  // ---------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------

  public async getActivities(
    page = 1,
    perPage = 30,
    afterTimestamp?: number,
  ): Promise<StravaActivity[]> {
    const params: Record<string, string | number | undefined> = {
      page,
      per_page: perPage,
    }
    // Use a nullish check so that a caller passing `0` (Unix epoch) still
    // results in an `after` filter — otherwise `0` would silently fetch
    // all activities.
    if (afterTimestamp != null) params.after = afterTimestamp
    return this.makeAuthenticatedRequest<StravaActivity[]>('/athlete/activities', params)
  }

  public async getActivity(id: number): Promise<StravaActivity> {
    return this.makeAuthenticatedRequest<StravaActivity>(`/activities/${id}`)
  }

  public async getActivityStream(id: number, types: string[] = ['latlng', 'altitude', 'time']) {
    return this.makeAuthenticatedRequest(`/activities/${id}/streams/${types.join(',')}`, {
      key_by_type: 'true',
    })
  }

  // ---------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------

  /**
   * Public entry point used by the UI. Returns the full mapped list of
   * activities, using cache + incremental sync whenever possible.
   *
   *   - If `forceRefresh` → discard cache and re-download everything.
   *   - If cache is fresh (< TTL) and no `forceIncremental` → return cached.
   *   - Otherwise → fetch only activities newer than the newest cached
   *     activity and merge them into the cache.
   */
  public async getCachedActivities(
    optionsOrForce: boolean | GetCachedActivitiesOptions = false,
  ): Promise<CachedActivity[]> {
    const options: GetCachedActivitiesOptions =
      typeof optionsOrForce === 'boolean' ? { forceRefresh: optionsOrForce } : optionsOrForce

    const { forceRefresh = false, forceIncremental = false, onProgress } = options

    // Make sure any leftover localStorage cache is migrated before we
    // read so a freshly upgraded client doesn't think it has no data.
    await migrateLegacyCacheIfNeeded()

    const cached = await loadCachedActivities()
    const cacheTime = await getCacheTime()
    const now = Math.floor(Date.now() / 1000)

    if (!forceRefresh && !forceIncremental && cacheTime !== null && cached.length > 0) {
      const cacheAge = now - cacheTime
      if (Number.isFinite(cacheAge) && cacheAge < this.cacheTTL) {
        return cached
      }
    }

    const afterTimestamp =
      !forceRefresh && cached.length > 0 ? this.newestStartDate(cached) : undefined

    return this.fetchAllActivitiesAndCache({
      afterTimestamp,
      existing: forceRefresh ? [] : cached,
      onProgress,
    })
  }

  /**
   * Fetch activities from Strava with bounded-concurrency paging, merge
   * them with `existing` (deduped by id) and persist the result.
   *
   * The paging strategy is probe-first:
   *   1. Fetch page 1 on its own. The common case (incremental sync)
   *      fits on a single page, so firing `SYNC_CONCURRENCY` requests
   *      up front would waste ~2 calls every refresh.
   *   2. If page 1 came back full, fetch the remaining pages in
   *      parallel batches of `SYNC_CONCURRENCY`.
   *   3. As soon as any page inside a batch comes back with
   *      `< SYNC_PAGE_SIZE` items we stop processing the rest of the
   *      batch and don't dispatch the next one.
   *
   * Progress is streamed via `onProgress` after every completed batch —
   * the UI can use `progress.partial` to fill in the map/list as new
   * pages arrive instead of waiting for the full sync.
   */
  public async fetchAllActivitiesAndCache(
    params: {
      afterTimestamp?: number
      existing?: CachedActivity[]
      onProgress?: (progress: SyncProgress) => void
    } = {},
  ): Promise<CachedActivity[]> {
    const { afterTimestamp, existing = [], onProgress } = params

    const byId = new Map<number, CachedActivity>(existing.map((a) => [a.id, a]))
    let pagesFetched = 0

    const ingest = (pageItems: StravaActivity[]) => {
      pagesFetched += 1
      for (const activity of pageItems) {
        if (!activity.start_latlng) continue
        // Decode the polyline now and cache alongside the activity so
        // re-renders don't have to decode every activity on every draw.
        byId.set(activity.id, enrichActivity(activity))
      }
    }

    const snapshotPartial = (): CachedActivity[] =>
      Array.from(byId.values()).sort(
        (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
      )

    let page = 1
    const probe = await this.getActivities(page, SYNC_PAGE_SIZE, afterTimestamp)
    ingest(probe)
    onProgress?.({
      pagesFetched,
      activitiesKnown: byId.size,
      partial: snapshotPartial(),
    })
    page += 1

    let done = probe.length < SYNC_PAGE_SIZE
    while (!done) {
      const pageNumbers = Array.from({ length: SYNC_CONCURRENCY }, (_, i) => page + i)
      const batch = await Promise.all(
        pageNumbers.map((p) => this.getActivities(p, SYNC_PAGE_SIZE, afterTimestamp)),
      )

      for (const pageItems of batch) {
        ingest(pageItems)
        if (pageItems.length < SYNC_PAGE_SIZE) {
          // We've reached the end of the activity list. Stop the outer
          // loop so we don't fire another batch of empty requests.
          done = true
          break
        }
      }

      onProgress?.({
        pagesFetched,
        activitiesKnown: byId.size,
        partial: snapshotPartial(),
      })
      page += SYNC_CONCURRENCY
    }

    const merged = snapshotPartial()
    await saveCachedActivities(merged)
    return merged
  }

  private async clearCache(): Promise<void> {
    await clearCachedActivities()
  }

  private newestStartDate(activities: CachedActivity[]): number | undefined {
    let newest = 0
    for (const activity of activities) {
      const t = new Date(activity.start_date).getTime()
      if (Number.isFinite(t) && t > newest) newest = t
    }
    if (newest === 0) return undefined
    // Strava expects a Unix-epoch second. Activities whose start_date
    // equals `after` would be excluded — add 1s so we don't re-download
    // the activity we're anchoring on.
    return Math.floor(newest / 1000) + 1
  }
}

// Re-export the cached-activity type at the service barrel so callers
// don't have to depend on the cache implementation directly.
export type { CachedActivity } from './activityCache'
