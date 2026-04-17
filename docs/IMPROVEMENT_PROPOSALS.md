# Strava Activity Map — Review & Improvement Proposals

A review of the current state of the project together with concrete, prioritised proposals covering:

1. Look & feel (styling / UX)
2. Performance of the Strava route ingestion
3. General improvements, fixes and technical debt

The file paths reference the current code so each item can be turned into its own PR / ticket.

---

## 1. Look & Feel — Design Refresh

### 1.1 Current state (what's painful today)

- No design tokens. Colours (`#fc4c02`, `#fff3f0`, `#6c757d`, `#e9ecef`, …), radii (`4px`, `6px`) and spacing are hard-coded in every `.vue` file. The **activity colour palette is also duplicated** in `src/components/ActivityMap.vue` and `src/components/ActivityList.vue` (see `getActivityColor`), with a bug: `Ride` and `Run` are near-identical oranges in one file and different in the other.
- The header is a flat orange bar with a hard shadow and no brand illustration — very "boilerplate Vue starter".
- The **auth prompt gradient is purple** (`#667eea → #764ba2`), which clashes with the Strava orange brand used everywhere else.
- The auth prompt has CSS for `.auth-icon`, `.auth-features`, `.feature-icon`, `.feature-text` etc. that are **never rendered** in the template — dead markup.
- Loading states are plain spinners in an empty viewport. No skeleton placeholders, no optimistic rendering.
- The hamburger icon uses three white `<span>`s — when the sidebar is closed on mobile the icon can blend into the orange bar but the toggle itself has no hit-feedback (no hover/press state).
- Activity cards only show **the first letter of the activity type** in a circle. "R" ambiguously means both Ride and Run (both start with R); the two also use similar oranges.
- The map popup uses `innerHTML` string templating with no Strava logo, no heart-rate, no elevation.
- The scrollbars are styled only for Webkit; the filter `<select>` is the default OS one.
- No dark mode, no reduced-motion variant of the spinner, no `prefers-color-scheme` support (even though `prefers-reduced-motion` is already handled in `src/styles/main.css`).
- `src/App.vue` uses `.header-right` with an HTML comment "Header content will be provided by individual views" — this is done via `<Teleport>` from `HomeView.vue`, which is fragile (breaks as soon as there is a second view that also wants header content).

### 1.2 Proposal

**a) Introduce a design system with CSS variables**

Centralise tokens in `src/styles/tokens.css` (imported from `main.css`):

```css
:root {
  /* Brand */
  --color-brand: #fc4c02;
  --color-brand-600: #e04800;
  --color-brand-50:  #fff3f0;

  /* Neutrals */
  --color-bg:        #ffffff;
  --color-surface:   #f7f8fa;
  --color-border:    #e5e7eb;
  --color-text:      #111827;
  --color-text-muted:#6b7280;

  /* Activity palette (single source of truth) */
  --color-ride: #fc4c02;
  --color-run:  #a518a3;
  --color-walk: #00d4aa;
  --color-hike: #8b6914;
  --color-swim: #0077be;

  /* Radii + spacing */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 24px; --space-6: 32px;

  /* Elevation */
  --shadow-sm: 0 1px 2px rgba(0,0,0,.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,.08);
  --shadow-lg: 0 12px 32px rgba(0,0,0,.12);

  /* Type */
  --font-sans: Inter, -apple-system, "Segoe UI", Roboto, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg:        #0b0d10;
    --color-surface:   #14181d;
    --color-border:    #232a31;
    --color-text:      #f3f4f6;
    --color-text-muted:#9ca3af;
  }
}
```

Then refactor components to use them (`background: var(--color-brand)` instead of `#fc4c02`). This also removes the duplicated `getActivityColor` maps — create `src/utils/activityStyle.ts` and import from both the list and the map.

**b) Replace the purple auth prompt with an on-brand hero**

- Keep the branding coherent: use a subtle orange-to-warm-sunset gradient (`linear-gradient(135deg, #ff8a3d 0%, #fc4c02 50%, #7a2400 100%)`) or a dark neutral background with an orange accent.
- Add the illustration/features grid that is already styled but never rendered — or delete the dead CSS.

**c) Cards and map polish**

- Activity card: replace the single-letter circle with a real sport icon (`@tabler/icons-vue` or inline SVGs: running shoe, bike, hiker, swimmer, dumbbell). The project already uses a Tabler SVG inline for the external link — stay consistent.
- Use a 2-column stat grid with an icon next to each stat (distance, time, elevation, speed, heart rate if available).
- Render the popup as a Vue component via `L.popup()` + `DomUtil` or use a Leaflet plugin like `vue-leaflet` (already declared in `package.json`), which lets us reuse the same card for the sidebar and the popup.
- On selection, scroll the activity card into view in the sidebar (currently selection is silent on the list).

**d) Theming and accessibility**

- Add dark-mode variants using `prefers-color-scheme` and `[data-theme="dark"]` overrides.
- Add `:focus-visible` styles so the orange outline from `main.css` only shows on keyboard focus, not on every mouse click.
- Ensure colour contrast ≥ 4.5:1 (current `#6c757d` text on `#f8f9fa` is close to the minimum; darken slightly).
- Make the filter row sticky at the top of the sidebar so it stays visible while scrolling long lists.

**e) Replace the `<Teleport>` header pattern**

Move the logout button and mobile toggle into `App.vue` or use a Pinia `uiStore` to drive the header, so every view doesn't have to teleport into `.header-right` (which breaks as soon as two views mount at once during a route transition).

### 1.3 Quick wins (< 1 day)

- Delete the duplicated `getActivityColor` function and create `src/utils/activityStyle.ts`.
- Add `tokens.css` + migrate at least colours to variables.
- Switch the auth-prompt gradient to an on-brand palette.
- Remove the dead `.auth-features` / `.feature` CSS from `src/views/HomeView.vue`.
- Replace the letter badge with SVG icons per sport type.

---

## 2. Performance — Fetching All Strava Routes

### 2.1 Current state (bottlenecks)

File: `src/services/strava.ts`

```58:75:src/services/strava.ts
  public async fetchAllActivitiesAndCache(): Promise<StravaActivity[]> {
    let allActivities: StravaActivity[] = []
    let mapActivities: StravaActivity[] = []
    let page = 1
    const perPage = 200 // Strava max per page
    let fetched: StravaActivity[]
    do {
      fetched = await this.getActivities(page, perPage)
      mapActivities = fetched.filter((activity) => activity.start_latlng)
      allActivities = allActivities.concat(mapActivities)
      page++
    } while (fetched.length === perPage)

    // Cache activities and timestamp
    localStorage.setItem(this.activitiesCacheKey, JSON.stringify(allActivities))
    localStorage.setItem(this.activitiesCacheTimeKey, Math.floor(Date.now() / 1000).toString())
    return allActivities
  }
```

Issues:

1. **Sequential pagination.** Every page waits for the previous one. With, e.g., 2 000 activities, that's 10 serial round-trips (~3–5 seconds best case, much worse on mobile).
2. **No incremental sync.** Every refresh re-downloads the entire history even though Strava's `/athlete/activities` endpoint supports `after=<unix-timestamp>` to only fetch newer activities.
3. **Full rewrite of the cache** on every sync — we serialise the whole list even if only one activity was added. `localStorage.setItem` is synchronous and blocks the main thread; with thousands of activities the JSON can easily exceed 1–2 MB and approach the 5 MB quota.
4. **Wrong variable reuse.** `mapActivities = fetched.filter(...)` overwrites the previous page's filtered list — harmless because it's immediately concatenated, but confusing and error-prone.
5. **Bug: trailing page may be dropped.** The exit condition is `fetched.length === perPage`, but the variable being concatenated is the *filtered* `mapActivities`. That part is fine, but if Strava returns fewer than `perPage` and *all* of them have a `start_latlng`, the loop still exits correctly — okay, but the code is brittle: any future change to the filter could accidentally skip the last page.
6. **Deep watch re-renders everything.** `src/components/ActivityMap.vue` has `watch(() => props.activities, ..., { deep: true })`. Any reactive nudge triggers a full `clearLayers()` and re-creation of every polyline.
7. **Polylines decoded on every redraw.** `decodePolyline` runs every time we rebuild the map; the decoded coordinates are never cached alongside the activity.
8. **Each polyline is its own Leaflet SVG layer**, each with its own popup. With thousands of activities this is expensive to paint and hit-test.
9. **No rate-limit handling.** Strava enforces 200 requests / 15 min and 2 000 / day. A 429 is never detected. A cold sync for a heavy user can hit the short-window limit.
10. **No retry with backoff** on 5xx or network errors.
11. **Token refresh race.** Every `makeAuthenticatedRequest` calls `checkTokenValidity()`; when the token expires *during* a bulk sync, N parallel requests could each call `refreshToken()` and invalidate each other.

### 2.2 Proposal

**a) Parallelise page fetches with a prefetch window + incremental sync**

Two-phase algorithm:

1. *Head probe* — fetch page 1 to learn the shape of the response and the newest activity date.
2. *Fan-out* — kick off pages 2..N in parallel in batches of e.g. 3–4 (to stay well under the 200 req / 15 min window).

Because Strava doesn't return a total count, do bounded parallelism: always keep `CONCURRENCY` inflight requests, stop when any page returns fewer than `perPage`.

Pseudo-code:

```ts
const CONCURRENCY = 3
const perPage = 200
const newest = lastCachedStart ? Math.floor(lastCachedStart / 1000) : undefined

// Fetch only activities newer than what we already have.
async function fetchPage(page: number) {
  const url = `${BASE}/athlete/activities?page=${page}&per_page=${perPage}` +
              (newest ? `&after=${newest}` : '')
  return this.makeAuthenticatedRequest(url)
}

const results: StravaActivity[][] = []
let page = 1
let done = false
while (!done) {
  const batch = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => fetchPage(page + i))
  )
  for (const pageItems of batch) {
    results.push(pageItems)
    if (pageItems.length < perPage) done = true
  }
  page += CONCURRENCY
}
const fresh = results.flat().filter(a => a.start_latlng)
const merged = dedupeById([...fresh, ...cached])
```

Expected effect: 3-4× wall-clock reduction on the first full sync and near-zero cost on subsequent syncs (incremental).

**b) Move the cache from `localStorage` to IndexedDB**

Use `[idb-keyval](https://github.com/jakearchibald/idb-keyval)` (tiny, no schema) or `[dexie](https://dexie.org/)` (typed). Benefits:

- Asynchronous — doesn't block the main thread on write.
- Much larger quota (hundreds of MB vs ~5 MB).
- Store decoded polylines alongside the activity so we decode once per activity, not once per render:
  ```ts
  type CachedActivity = StravaActivity & { coords: [number, number][] }
  ```

**c) Throttle + detect rate limits**

Wrap `axios` with an interceptor:

```ts
axios.interceptors.response.use(undefined, async (err) => {
  if (err.response?.status === 429) {
    const retryAfter = Number(err.response.headers['retry-after'] ?? 30)
    await sleep(retryAfter * 1000)
    return axios.request(err.config)
  }
  if (err.response?.status >= 500) {
    return retryWithBackoff(err.config) // 500ms → 1s → 2s, max 3 tries
  }
  throw err
})
```

Strava also returns `X-RateLimit-Usage` / `X-RateLimit-Limit` headers — surface them in a small toast when you're within 10 % of the limit.

**d) Single-flight the token refresh**

```ts
private refreshPromise: Promise<void> | null = null
public async refreshToken(): Promise<void> {
  if (this.refreshPromise) return this.refreshPromise
  this.refreshPromise = this._doRefresh().finally(() => (this.refreshPromise = null))
  return this.refreshPromise
}
```

So N concurrent requests during a bulk sync share one refresh round-trip.

**e) Render with Leaflet's canvas renderer**

In `src/components/ActivityMap.vue`:

```ts
map = L.map(mapContainer.value, {
  ...,
  preferCanvas: true,
  renderer: L.canvas({ padding: 0.5 }),
})
```

Canvas polylines are an order of magnitude cheaper than SVG when drawing thousands of routes. Also:

- Set `smoothFactor: 2` on polylines — simplifies rendering at far-out zoom.
- Drop the deep watch: `watch(() => props.activities.length, ...)` is enough because the array is replaced, not mutated.
- Replace the per-polyline `bindPopup` with a single delegated `map.on('click')` that resolves the activity from a spatial index (e.g. `L.FeatureGroup` + `getBounds()`), or simply re-use the same popup instance and update its content.

**f) Stream results to the UI as they arrive**

Instead of awaiting all pages before the user sees anything, push each page to `activities.value` as it resolves. The map will progressively fill in — much better perceived performance.

**g) Progress indicator**

Expose `fetchProgress = { page, totalFetched }` on the store so the UI can show *"Loaded 1 200 activities…"* instead of a blank spinner.

### 2.3 Summary table


| Change                  | Expected impact on cold sync         | Expected impact on warm sync      | Effort |
| ----------------------- | ------------------------------------ | --------------------------------- | ------ |
| Incremental `after=`    | ~none (same on cold)                 | **~100× faster** (0–1 pages vs N) | S      |
| Parallel paging (×3)    | **~3× faster**                       | minor                             | S      |
| IndexedDB cache         | faster writes, no main-thread stalls | faster reads on startup           | M      |
| Canvas renderer         | —                                    | **smoother pan/zoom**             | S      |
| Cache decoded polylines | —                                    | faster re-renders                 | S      |
| Rate-limit handling     | avoids silent failures               | avoids silent failures            | S      |
| Single-flight refresh   | prevents auth invalidation           | same                              | XS     |
| Stream results          | better perceived perf                | better perceived perf             | M      |


---

## 3. Other Issues, Fixes and Improvements

### 3.1 Security — Client secret is exposed to the browser

`src/config/strava.ts` reads `VITE_STRAVA_CLIENT_SECRET`:

```4:7:src/config/strava.ts
  clientId: import.meta.env.VITE_STRAVA_CLIENT_ID || 'YOUR_CLIENT_ID',
  clientSecret: import.meta.env.VITE_STRAVA_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
```

Anything prefixed with `VITE_` is **shipped to every client**. This means your Strava app's client secret is embedded in the production bundle — anyone can read it, impersonate the app, phish users, etc.

**Proposal:** move the OAuth token exchange (`exchangeCodeForToken`) and refresh (`refreshToken`) behind a tiny serverless function (Cloudflare Worker, Vercel Edge Function, Netlify Function, …). The frontend only ever holds the access/refresh tokens, never the secret. Alternatively, rotate the Strava credentials and use **PKCE** — Strava supports OAuth 2.0 authorization-code flow, so PKCE is the correct frontend-only pattern.

### 3.2 Duplicated OAuth-callback handling

Both `src/views/HomeView.vue` (in `handleAuthCallback`) and `src/views/AuthCallback.vue` inspect `window.location.search` for `code=`. The router already has a dedicated `/auth/callback` route, so the home-view copy is dead code *unless* a user somehow lands on `/` with `?code=` — in which case they've bypassed the callback route entirely. Remove the home-view copy and centralise auth handling inside `AuthCallback.vue` (plus a Pinia `authStore`).

### 3.3 `AuthCallback.vue`

- Has unused `tryOpenNativeApp` and `handleWebAuth` helpers.
- Logs the auth `code` and URL to the console — should be removed.
- No error handling around `exchangeCodeForToken(code)`; if it rejects the user is left on the spinner screen forever.
- Use the Vue router `route.query.code` instead of manually parsing `window.location.search`.

### 3.4 `src/capacitor-deeplink.ts`

```1:10:src/capacitor-deeplink.ts
import { App as CapacitorApp } from '@capacitor/app'
import router from './router'

CapacitorApp.addListener('appUrlOpen', (event: { url: string }) => {
  const slug = event.url.split('amplify.com').pop()
  if (slug) {
    router.push({ path: slug })
  }
})
```

- **The file is never imported in `src/main.ts`**, so the listener is never attached on native builds. Deep links won't navigate anywhere.
- `event.url.split('amplify.com')` is a leftover from an AWS Amplify tutorial — it won't match a Strava OAuth redirect. Should split on the configured `redirectUri` host/scheme.

### 3.5 Stale / unused code

- `src/stores/counter.ts` — Vue/Pinia scaffolding, not used.
- `encodePolyline` in `src/utils/polyline.ts` — never called.
- `vue-leaflet` in `package.json` — declared but never imported.
- `.auth-features`, `.feature`, `.feature-icon`, `.feature-text`, `.auth-icon` in `HomeView.vue` styles — never rendered.
- `strava-icon`, `.strava-logo` styles in `App.vue` / `HomeView.vue` — never rendered.

### 3.6 Reactivity bugs

```175:177:src/views/HomeView.vue
  const isMobile = computed(() => {
    return window.innerWidth <= 768
  })
```

This computed has no reactive dependency on window size, so it evaluates once and never updates on resize. Replace with a `useMediaQuery` composable (`matchMedia('(max-width: 768px)')`) or listen to `resize`.

Also in `HomeView.vue`:

```154:157:src/views/HomeView.vue
  const handleActivitySelected = (activity: StravaActivity) => {
    selectedActivity.value = activity.id
    if (window.innerWidth <= 768) {
      showMobileList.value = false
    }
  }
```

The magic `768` is duplicated from CSS and the `isMobile` computed. Move to a single composable.

### 3.7 Cache inconsistencies

`StravaService.logout()` clears `strava_activities_cache` but not `strava_activities_cache_time`, leaving an orphan key that can mislead future cache-hit checks:

```200:203:src/services/strava.ts
  public logout(): void {
    localStorage.removeItem('strava_activities_cache')
    this.clearTokenFromStorage()
  }
```

Also, `clearTokenFromStorage()` should probably invalidate the activities cache too — re-logging in as a different athlete currently re-uses the previous user's routes.

### 3.8 Router & PWA

- `createWebHistory` means the service worker must serve `index.html` for every route. The current PWA config only precaches `**/*.{js,css,html,ico,png,svg}` and has no `navigateFallback` — deep-linking to `/auth/callback` offline will 404. Add `workbox.navigateFallback: '/index.html'`.
- The PWA manifest references `pwa-192x192.png` / `pwa-512x512.png` / `apple-touch-icon.png` but the `public/` folder only contains `favicon.ico` — the PWA install prompt will use the default browser icon. See `public/icons-needed.txt` for the TODO that is still open.

### 3.9 Leaflet default marker URLs

```28:31:src/components/ActivityMap.vue
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
```

- They point to **Leaflet 1.7.1** via `cdnjs`, but the app depends on Leaflet `^1.9.4` — version drift.
- External CDN means markers fail when the PWA is offline. Import the assets via Vite instead:
  ```ts
  import iconUrl from 'leaflet/dist/images/marker-icon.png'
  import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
  import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
  ```

### 3.10 Dependency hygiene

- `@capacitor/cli` is listed in `dependencies`; it is a build tool and belongs in `devDependencies`.
- No lockfile policy in CI, no `npm audit` / `npm outdated` step in the pre-commit config.
- Consider adding [Biome](https://biomejs.dev/) or keeping ESLint + Prettier but enabling `@typescript-eslint/no-explicit-any` — there are several `any` types in `src/services/strava.ts` and in the map component (`(layer: any)`).

### 3.11 Testing

There are no tests. Suggested baseline:

- Vitest for unit tests: `decodePolyline` / `encodePolyline`, `formatDate`, `StravaService.getCachedActivities` (stubbing `axios`).
- Playwright or Cypress for an E2E smoke test of the `/auth/callback` redirect and the activity list rendering with a mocked token.

### 3.12 DX / misc

- `App.vue` template starts with an empty line; several files have trailing whitespace.
- `eslint.config.ts` and `.prettierrc.json` exist but the `lint` script `eslint . --fix` will also lint `dist/` etc. — add `--ignore-pattern`.
- `type-check` runs `vue-tsc --build` but there is no `tsconfig.build.json` that excludes tests — not a problem yet but worth planning before tests are added.
- Add a small `AGENTS.md` / `CONTRIBUTING.md` describing the run/build flow and the Strava API quirks (after parameter, rate-limits, scopes).
- README claims *"Optimized performance with code splitting"* — nothing is code-split today. Either lazy-import `ActivityMap.vue` (it pulls Leaflet, the biggest dep) via a dynamic `import()` in the router/home view, or drop the claim.

---

## 4. Suggested Rollout Order

A pragmatic order that maximises perceived improvement vs. risk:

1. **Security fix** — move the client secret behind a backend (3.1). Blocks everything else that touches auth.
2. **Incremental sync + parallel paging** (§2.2 a) — biggest, safest perf win for real users.
3. **Single-flight token refresh + rate-limit interceptor** (§2.2 c, d).
4. **Design tokens + activity colour de-duplication** (§1.2 a) — unlocks the rest of the UI work.
5. **Auth-prompt redesign + icons per sport** (§1.2 b, c).
6. **IndexedDB cache + decoded-polyline caching + canvas renderer** (§2.2 b, e, f).
7. **Clean-up pass** — stale code (§3.5), reactivity bugs (§3.6), cache inconsistencies (§3.7), PWA icons and offline fallback (§3.8, 3.9), Capacitor deep-link fix (§3.4).
8. **Tests** (§3.11), dependency hygiene (§3.10), dark mode (§1.2 d).

