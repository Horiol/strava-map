import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * The single source of truth for the "mobile" breakpoint, kept in sync
 * with the `@media (max-width: 768px)` rules in the component styles.
 * Update here if the value ever needs to change.
 */
export const MOBILE_BREAKPOINT = '(max-width: 768px)'

/**
 * Reactive wrapper around `window.matchMedia`. Returns a ref whose
 * value reflects whether the given media query currently matches, and
 * automatically updates on viewport changes.
 *
 * Safe to call at setup time: during SSR / non-browser environments
 * the initial value is `false` and no listener is registered.
 */
export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false)

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return matches
  }

  const media = window.matchMedia(query)
  matches.value = media.matches

  const listener = (event: MediaQueryListEvent) => {
    matches.value = event.matches
  }

  onMounted(() => {
    media.addEventListener('change', listener)
    // Re-sync in case the viewport changed between setup and mount.
    matches.value = media.matches
  })

  onBeforeUnmount(() => {
    media.removeEventListener('change', listener)
  })

  return matches
}

/** Convenience shorthand for the app's "mobile" breakpoint. */
export function useIsMobile(): Ref<boolean> {
  return useMediaQuery(MOBILE_BREAKPOINT)
}
