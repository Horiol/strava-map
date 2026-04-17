/**
 * Single source of truth for activity visuals (color + icon).
 *
 * Keep the palette in sync with the `--color-activity-*` CSS variables
 * in `src/styles/tokens.css` — these raw hex values are consumed by
 * Leaflet (which cannot read CSS variables on polyline styles).
 *
 * Icons are Tabler-style 24×24 outlines expressed as the inner `<path>`
 * / primitive markup only, so callers can wrap them in an `<svg>` with
 * the size and `stroke` they need.
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
 * Tabler-style icon markup (inner SVG only, 24×24 viewBox).
 * Use with `<svg viewBox="0 0 24 24" v-html="getActivityIcon(type)" />`.
 *
 * Source: tabler-icons (MIT) — trimmed to what we need.
 */
const DEFAULT_ACTIVITY_ICON = `
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M9 4v13a2.5 2.5 0 1 1 -2 -2.45"/>
    <path d="M9 4h8l-4 6h4l-7 7"/>`

const ACTIVITY_ICONS: Record<string, string> = {
  Ride: `
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M5 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>
    <path d="M19 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>
    <path d="M12 19l0 -4l-3 -3l5 -4l2 3l3 0"/>
    <path d="M17 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>`,
  Run: `
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>
    <path d="M4 17l5 1l.75 -1.5"/>
    <path d="M15 21l0 -4l-4 -3l1 -6"/>
    <path d="M7 12l0 -3l5 -1l3 3l3 1"/>`,
  Walk: `
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>
    <path d="M7 21l3 -4"/>
    <path d="M16 21l-2 -4l-3 -3l1 -6"/>
    <path d="M6 12l2 -3l4 -1l3 3l3 1"/>`,
  Hike: `
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M3 21l18 0"/>
    <path d="M3 21l6 -15l4 8l4 -4l4 11"/>
    <path d="M13 14l1.5 3"/>`,
  Swim: `
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M3 12c.333 -.667 1 -1 2 -1s1.667 .333 2 1c.333 .667 1 1 2 1s1.667 -.333 2 -1c.333 -.667 1 -1 2 -1s1.667 .333 2 1c.333 .667 1 1 2 1s1.667 -.333 2 -1"/>
    <path d="M3 16c.333 -.667 1 -1 2 -1s1.667 .333 2 1c.333 .667 1 1 2 1s1.667 -.333 2 -1c.333 -.667 1 -1 2 -1s1.667 .333 2 1c.333 .667 1 1 2 1s1.667 -.333 2 -1"/>
    <path d="M17 7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>
    <path d="M9 12l3 -3l-1.5 -1.5"/>`,
  Workout: `
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M3 12h1m16 0h1"/>
    <path d="M6 8h4v8h-4z"/>
    <path d="M14 8h4v8h-4z"/>
    <path d="M4 10v4"/>
    <path d="M20 10v4"/>`,
  Yoga: `
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M12 4m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>
    <path d="M4 20l4 -3l4 -2l4 2l4 3"/>
    <path d="M12 15v-5l-3 -2l-1 -2"/>
    <path d="M12 10l3 -2l1 -2"/>`,
  WeightTraining: `
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M2 12h1"/>
    <path d="M6 8v8"/>
    <path d="M9 7v10"/>
    <path d="M15 7v10"/>
    <path d="M18 8v8"/>
    <path d="M21 12h1"/>
    <path d="M9 12h6"/>`,
}

/** Aliases — Strava activity types that should share an icon. */
const ACTIVITY_ICON_ALIASES: Record<string, keyof typeof ACTIVITY_ICONS> = {
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

export function getActivityIcon(type: string | undefined | null): string {
  if (!type) return DEFAULT_ACTIVITY_ICON
  const alias = ACTIVITY_ICON_ALIASES[type]
  if (alias) {
    const aliased = ACTIVITY_ICONS[alias]
    if (aliased) return aliased
  }
  return ACTIVITY_ICONS[type] ?? DEFAULT_ACTIVITY_ICON
}

/** Human-friendly, short label — "Mountain Bike Ride" → "MTB". */
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
