/**
 * Native deep-link handler for Capacitor builds.
 *
 * When Strava completes OAuth on the system browser it opens a URL of
 * the form configured in `stravaConfig.redirectUri`. On Android /
 * iOS that URL is handed to us as an `appUrlOpen` event instead of a
 * normal navigation — we have to parse it ourselves and route the
 * Vue app to `/auth/callback` so `AuthCallback.vue` can finish the
 * token exchange.
 *
 * This module is imported from `main.ts` inside a Capacitor-native
 * guard so web builds pay none of its cost.
 */

import { App as CapacitorApp } from '@capacitor/app'
import router from './router'
import { stravaConfig } from './config/strava'

/**
 * Extract the router path (plus search + hash) from an incoming deep
 * link, using the configured redirect URI as the reference point.
 *
 * Falls back to parsing the URL as-is if it doesn't match the expected
 * origin — better to still attempt a navigation than to silently drop
 * the event.
 */
function extractRoutePath(incomingUrl: string): string | null {
  let url: URL
  try {
    url = new URL(incomingUrl)
  } catch {
    return null
  }

  // If the URL matches the configured redirect URI's origin we just
  // reuse its pathname. This handles the standard
  // `https://<host>/auth/callback?code=...` shape.
  let redirectOrigin: string | null = null
  try {
    redirectOrigin = new URL(stravaConfig.redirectUri).origin
  } catch {
    /* `redirectUri` may be a relative path at build time. */
  }

  if (redirectOrigin && url.origin !== redirectOrigin) {
    // Unknown origin — still try to route using the path/search if
    // there's anything useful (`?code=`). Otherwise give up.
    if (!url.searchParams.has('code') && !url.searchParams.has('error')) {
      return null
    }
  }

  // Always send OAuth results to `/auth/callback` — even if the native
  // app was opened with a bare `?code=` on `/` we want the dedicated
  // component to handle the exchange.
  const pathname =
    url.searchParams.has('code') || url.searchParams.has('error')
      ? '/auth/callback'
      : url.pathname || '/'

  return `${pathname}${url.search}${url.hash}`
}

CapacitorApp.addListener('appUrlOpen', (event: { url: string }) => {
  const routePath = extractRoutePath(event.url)
  if (routePath) {
    router.push(routePath)
  }
})

// Exported for tests.
export { extractRoutePath }
