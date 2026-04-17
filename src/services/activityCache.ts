/**
 * IndexedDB-backed cache for the user's Strava activity history.
 *
 * Why IndexedDB (and not `localStorage`)?
 *   - Non-blocking writes: the previous `localStorage.setItem(JSON.stringify(...))`
 *     path could stall the main thread for tens of ms on heavy-user accounts
 *     (2 000+ activities, 1–2 MB of JSON).
 *   - Much larger quota (hundreds of MB vs. ~5 MB), which lets us cache
 *     *decoded* polylines alongside each activity.
 *   - Structured clone semantics — we can persist typed arrays / arrays
 *     of tuples without re-serialising through JSON.
 *
 * The store is a single `idb-keyval` bucket with two keys:
 *   - `activities` → `CachedActivity[]`
 *   - `cache_time` → `number` (unix seconds)
 *
 * On first run we transparently migrate whatever was in the old
 * `localStorage` cache, decode the polylines, write the result to IDB,
 * then delete the legacy keys. See `migrateLegacyCacheIfNeeded`.
 */

import { createStore, del, get, set } from 'idb-keyval'
import type { StravaActivity } from './strava'
import { decodePolyline } from '@/utils/polyline'

const DB_NAME = 'strava-map'
const STORE_NAME = 'activity-cache'

const KEY_ACTIVITIES = 'activities'
const KEY_CACHE_TIME = 'cache_time'

const LEGACY_ACTIVITIES_KEY = 'strava_activities_cache'
const LEGACY_CACHE_TIME_KEY = 'strava_activities_cache_time'

const store = createStore(DB_NAME, STORE_NAME)

/**
 * A Strava activity enriched with its decoded polyline. We cache the
 * decoded form so the map renderer doesn't have to run `decodePolyline`
 * once per activity on every redraw.
 *
 * `coords` is `null` for activities that don't have a `summary_polyline`
 * (indoor workouts, manual entries, etc.) so we can distinguish
 * "no route" from "not yet decoded".
 */
export interface CachedActivity extends StravaActivity {
  coords: [number, number][] | null
}

/**
 * Attach `coords` to a plain `StravaActivity` by decoding its
 * `summary_polyline`. Never throws — malformed polylines just yield
 * `null`, which matches "no route" semantically.
 */
export function enrichActivity(activity: StravaActivity): CachedActivity {
  const summary = activity.map?.summary_polyline
  if (!summary) {
    return { ...activity, coords: null }
  }
  try {
    const coords = decodePolyline(summary)
    return { ...activity, coords: coords.length > 0 ? coords : null }
  } catch {
    return { ...activity, coords: null }
  }
}

/** Load the cached activity list. Returns `[]` if nothing is cached. */
export async function loadCachedActivities(): Promise<CachedActivity[]> {
  const raw = await get<CachedActivity[]>(KEY_ACTIVITIES, store)
  if (!Array.isArray(raw)) return []
  return raw
}

/** Overwrite the activity list and bump the cache timestamp to now. */
export async function saveCachedActivities(activities: CachedActivity[]): Promise<void> {
  await set(KEY_ACTIVITIES, activities, store)
  await set(KEY_CACHE_TIME, Math.floor(Date.now() / 1000), store)
}

/** Returns the cache timestamp in unix seconds, or `null` if unset. */
export async function getCacheTime(): Promise<number | null> {
  const t = await get<number>(KEY_CACHE_TIME, store)
  return typeof t === 'number' && Number.isFinite(t) ? t : null
}

/** Delete both the activity list and the timestamp. */
export async function clearCachedActivities(): Promise<void> {
  await del(KEY_ACTIVITIES, store)
  await del(KEY_CACHE_TIME, store)
}

let migrationPromise: Promise<void> | null = null

/**
 * One-time migration from the legacy `localStorage` cache. Idempotent:
 * once IDB has any data, or once legacy keys are gone, it's a no-op.
 *
 * Single-flighted via `migrationPromise` so concurrent callers (the
 * service constructor + an eager read) don't duplicate the work.
 */
export function migrateLegacyCacheIfNeeded(): Promise<void> {
  if (migrationPromise) return migrationPromise
  migrationPromise = runMigration().catch((err) => {
    console.warn('[activityCache] Legacy migration failed', err)
  })
  return migrationPromise
}

async function runMigration(): Promise<void> {
  // If IDB already has activities, we've migrated previously. We still
  // want to sweep the old localStorage keys in that case so they don't
  // keep hanging around after an interrupted earlier run.
  const existing = await get<CachedActivity[]>(KEY_ACTIVITIES, store)
  if (Array.isArray(existing) && existing.length > 0) {
    localStorage.removeItem(LEGACY_ACTIVITIES_KEY)
    localStorage.removeItem(LEGACY_CACHE_TIME_KEY)
    return
  }

  const legacyRaw = localStorage.getItem(LEGACY_ACTIVITIES_KEY)
  if (!legacyRaw) return

  try {
    const parsed: unknown = JSON.parse(legacyRaw)
    if (!Array.isArray(parsed)) return

    const enriched = (parsed as StravaActivity[]).map(enrichActivity)
    await set(KEY_ACTIVITIES, enriched, store)

    const legacyTime = localStorage.getItem(LEGACY_CACHE_TIME_KEY)
    if (legacyTime) {
      const parsedTime = Number.parseInt(legacyTime, 10)
      if (Number.isFinite(parsedTime)) {
        await set(KEY_CACHE_TIME, parsedTime, store)
      }
    }
  } finally {
    localStorage.removeItem(LEGACY_ACTIVITIES_KEY)
    localStorage.removeItem(LEGACY_CACHE_TIME_KEY)
  }
}
