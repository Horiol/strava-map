import axios from 'axios'

const STRAVA_BASE_URL = 'https://www.strava.com/api/v3'
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize'
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'

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

export class StravaService {
  private config: StravaConfig
  private accessToken: string | null = null
  private activitiesCacheKey = 'strava_activities_cache'
  private activitiesCacheTimeKey = 'strava_activities_cache_time'
  private cacheTTL = 60 * 60

  constructor(config: StravaConfig) {
    this.config = config
    this.loadTokenFromStorage()
    // Optionally, load cache here if needed
  }
  /**
   * Fetch all activities from Strava using pagination, and cache them.
   */
  public async fetchAllActivitiesAndCache(): Promise<StravaActivity[]> {
    let allActivities: StravaActivity[] = []
    let page = 1
    const perPage = 200 // Strava max per page
    let fetched: StravaActivity[]
    do {
      fetched = await this.getActivities(page, perPage)
      allActivities = allActivities.concat(fetched)
      page++
    } while (fetched.length === perPage)

    // Cache activities and timestamp
    localStorage.setItem(this.activitiesCacheKey, JSON.stringify(allActivities))
    localStorage.setItem(this.activitiesCacheTimeKey, Math.floor(Date.now() / 1000).toString())
    return allActivities
  }

  /**
   * Get activities from cache if fresh, otherwise fetch from Strava and cache.
   */
  public async getCachedActivities(forceRefresh = false): Promise<StravaActivity[]> {
    const cacheTimeStr = localStorage.getItem(this.activitiesCacheTimeKey)
    const cacheStr = localStorage.getItem(this.activitiesCacheKey)
    const now = Math.floor(Date.now() / 1000)
    if (!forceRefresh && cacheTimeStr && cacheStr) {
      const cacheTime = parseInt(cacheTimeStr)
      if (now - cacheTime < this.cacheTTL) {
        try {
          const cached = JSON.parse(cacheStr)
          if (Array.isArray(cached)) {
            return cached
          }
        } catch {}
      }
    }
    // If no valid cache, fetch and cache
    return await this.fetchAllActivitiesAndCache()
  }

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

  public async refreshToken(): Promise<void> {
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

  public logout(): void {
    localStorage.removeItem('strava_activities_cache')
    this.clearTokenFromStorage()
  }

  private async makeAuthenticatedRequest(url: string) {
    if (!this.accessToken) {
      throw new Error('Not authenticated')
    }

    const isValid = await this.checkTokenValidity()
    if (!isValid) {
      throw new Error('Invalid or expired token')
    }

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })
      return response.data
    } catch (error: any) {
      if (error.response?.status === 401) {
        this.clearTokenFromStorage()
        throw new Error('Authentication failed')
      }
      throw error
    }
  }

  public async getActivities(page = 1, perPage = 30): Promise<StravaActivity[]> {
    const url = `${STRAVA_BASE_URL}/athlete/activities?page=${page}&per_page=${perPage}`
    return await this.makeAuthenticatedRequest(url)
    // This method is used by fetchAllActivitiesAndCache for pagination
  }

  public async getActivity(id: number): Promise<StravaActivity> {
    const url = `${STRAVA_BASE_URL}/activities/${id}`
    return await this.makeAuthenticatedRequest(url)
  }

  public async getActivityStream(id: number, types: string[] = ['latlng', 'altitude', 'time']) {
    const typeString = types.join(',')
    const url = `${STRAVA_BASE_URL}/activities/${id}/streams/${typeString}?key_by_type=true`
    return await this.makeAuthenticatedRequest(url)
  }
}
