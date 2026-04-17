/**
 * Single source of truth for activity visuals (color + icon).
 *
 * Colors live here (not in CSS) because Leaflet's polyline `color`
 * option needs a real hex value at runtime. To keep CSS in sync without
 * duplication, call `applyActivityColorsToRoot()` once on app start to
 * project `ACTIVITY_COLORS` onto `:root` as `--color-activity-<key>`
 * custom properties.
 *
 * Icons are represented as arrays of `d` attributes (Tabler-style
 * outlines, 24×24 viewBox) so templates can render `<path>` elements
 * declaratively with `v-for`, avoiding `v-html`.
 */

const DEFAULT_ACTIVITY_COLOR = '#fc4c02'

export const ACTIVITY_COLORS: Record<string, string> = {
  Ride: '#fc4c02',
  VirtualRide: '#fc4c02',
  EBikeRide: '#fc4c02',
  MountainBikeRide: '#fc4c02',
  GravelRide: '#fc4c02',
  Run: '#a518a3',
  TrailRun: '#a518a3',
  VirtualRun: '#a518a3',
  Walk: '#00a884',
  Hike: '#8b6914',
  Swim: '#0077be',
  Workout: '#7b68ee',
  Yoga: '#c084fc',
  WeightTraining: '#4b0082',
}

export function getActivityColor(type: string | undefined | null): string {
  if (!type) return DEFAULT_ACTIVITY_COLOR
  return ACTIVITY_COLORS[type] ?? DEFAULT_ACTIVITY_COLOR
}

/**
 * Project the `ACTIVITY_COLORS` map onto CSS custom properties on
 * `:root`, so stylesheets can reference them as
 * `var(--color-activity-<lowercase-key>)`.
 *
 * A `--color-activity-default` is always written so stylesheets have a
 * fallback for unknown types.
 */
export function applyActivityColorsToRoot(
  root: HTMLElement = document.documentElement,
): void {
  root.style.setProperty('--color-activity-default', DEFAULT_ACTIVITY_COLOR)
  for (const [type, color] of Object.entries(ACTIVITY_COLORS)) {
    root.style.setProperty(`--color-activity-${type.toLowerCase()}`, color)
  }
}

/**
 * Aliases — Strava activity types that should inherit a base type's
 * icon. The base types are defined in `ACTIVITY_ICON_PATHS`; anything
 * not listed falls back to the default icon.
 */
const ACTIVITY_ICON_ALIASES: Record<string, string> = {
  VirtualRide: 'Ride',
  EBikeRide: 'Ride',
  MountainBikeRide: 'Ride',
  GravelRide: 'Ride',
  Handcycle: 'Ride',
  TrailRun: 'Run',
  VirtualRun: 'Run',
  Elliptical: 'Run',
  StairStepper: 'Run',
  Snowshoe: 'Hike',
  AlpineSki: 'Hike',
  BackcountrySki: 'Hike',
  NordicSki: 'Hike',
  Kayaking: 'Swim',
  Canoeing: 'Swim',
  Rowing: 'Swim',
  StandUpPaddling: 'Swim',
  Surfing: 'Swim',
  Crossfit: 'Workout',
  Pilates: 'Yoga',
}

const DEFAULT_ICON_PATHS: readonly string[] = [
  'M9 4v13a2.5 2.5 0 1 1 -2 -2.45',
  'M9 4h8l-4 6h4l-7 7',
]

/**
 * Base icon set — values are the `d` attribute of each `<path>`, in
 * draw order. The SVG viewBox is always `0 0 24 24`.
 */
const ACTIVITY_ICON_PATHS: Record<string, readonly string[]> = {
  Ride: [
    'M5 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
    'M19 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
    'M12 19l0 -4l-3 -3l5 -4l2 3l3 0',
    'M17 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
  ],
  Run: [
    'M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    'M4 17l5 1l.75 -1.5',
    'M15 21l0 -4l-4 -3l1 -6',
    'M7 12l0 -3l5 -1l3 3l3 1',
  ],
  Walk: [
    'M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    'M7 21l3 -4',
    'M16 21l-2 -4l-3 -3l1 -6',
    'M6 12l2 -3l4 -1l3 3l3 1',
  ],
  Hike: ['M3 21l18 0', 'M3 21l6 -15l4 8l4 -4l4 11', 'M13 14l1.5 3'],
  Swim: [
    'M3 12c.333 -.667 1 -1 2 -1s1.667 .333 2 1c.333 .667 1 1 2 1s1.667 -.333 2 -1c.333 -.667 1 -1 2 -1s1.667 .333 2 1c.333 .667 1 1 2 1s1.667 -.333 2 -1',
    'M3 16c.333 -.667 1 -1 2 -1s1.667 .333 2 1c.333 .667 1 1 2 1s1.667 -.333 2 -1c.333 -.667 1 -1 2 -1s1.667 .333 2 1c.333 .667 1 1 2 1s1.667 -.333 2 -1',
    'M17 7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M9 12l3 -3l-1.5 -1.5',
  ],
  Workout: [
    'M3 12h1m16 0h1',
    'M6 8h4v8h-4z',
    'M14 8h4v8h-4z',
    'M4 10v4',
    'M20 10v4',
  ],
  Yoga: [
    'M12 4m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M4 20l4 -3l4 -2l4 2l4 3',
    'M12 15v-5l-3 -2l-1 -2',
    'M12 10l3 -2l1 -2',
  ],
  WeightTraining: [
    'M2 12h1',
    'M6 8v8',
    'M9 7v10',
    'M15 7v10',
    'M18 8v8',
    'M21 12h1',
    'M9 12h6',
  ],
}

/**
 * Return the ordered `d` path values that compose the icon for a given
 * Strava activity type. The returned array is safe to pass to
 * `v-for="d in paths"` / `<path :d="d" />`.
 */
export function getActivityIconPaths(type: string | undefined | null): readonly string[] {
  if (!type) return DEFAULT_ICON_PATHS
  const alias = ACTIVITY_ICON_ALIASES[type]
  if (alias) {
    const aliased = ACTIVITY_ICON_PATHS[alias]
    if (aliased) return aliased
  }
  return ACTIVITY_ICON_PATHS[type] ?? DEFAULT_ICON_PATHS
}

/**
 * Render the icon for `type` as a concatenated `<path />` SVG string.
 *
 * Intended for consumers that can only accept a raw HTML/SVG string
 * (e.g. Leaflet's `L.divIcon({ html })`), where a Vue component is not
 * available. Uses only values we control — the keys come from a closed
 * set — so the output is safe to embed without escaping.
 */
export function getActivityIconSvgMarkup(type: string | undefined | null): string {
  return getActivityIconPaths(type)
    .map((d) => `<path d="${d}" />`)
    .join('')
}

/** Human-friendly, short label — "MountainBikeRide" → "MTB". */
export function getActivityShortLabel(type: string | undefined | null): string {
  if (!type) return ''
  const map: Record<string, string> = {
    Ride: 'Ride',
    VirtualRide: 'Virtual',
    EBikeRide: 'E-Bike',
    MountainBikeRide: 'MTB',
    GravelRide: 'Gravel',
    Run: 'Run',
    TrailRun: 'Trail',
    VirtualRun: 'Virtual',
    Walk: 'Walk',
    Hike: 'Hike',
    Swim: 'Swim',
    Workout: 'Workout',
    Yoga: 'Yoga',
    WeightTraining: 'Weights',
  }
  return map[type] ?? type
}
