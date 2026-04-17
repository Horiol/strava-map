<template>
  <div class="map-container">
    <div id="activity-map" ref="mapContainer" class="activity-map"></div>
    <div v-if="loading" class="map-loading">
      <div class="spinner"></div>
      <p>{{ loadingStatus || 'Loading activities…' }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch } from 'vue'
  import type { Ref } from 'vue'
  import L from 'leaflet'
  import type { CachedActivity } from '@/services/strava'
  import { useMapStore } from '@/stores/map'
  import { formatDate } from '@/utils/date'
  import { getActivityColor, getActivityIconSvgMarkup } from '@/utils/activityStyle'

  const mapStore = useMapStore()

  import 'leaflet/dist/leaflet.css'

  // Fix Leaflet's default marker URLs under Vite. `_getIconUrl` is an
  // internal Leaflet prop that has no public typing, hence the cast.
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  })

  interface Props {
    activities: CachedActivity[]
    loading?: boolean
    loadingStatus?: string | null
    selectedActivity?: number | null
  }

  const props = withDefaults(defineProps<Props>(), {
    loading: false,
    loadingStatus: null,
    selectedActivity: null,
  })

  const emit = defineEmits<{
    activitySelected: [activity: CachedActivity]
  }>()

  const mapContainer: Ref<HTMLElement | null> = ref(null)
  let map: L.Map | null = null
  let activityLayers: L.LayerGroup | null = null
  // Dedicated canvas renderer reused by every polyline we add to the
  // map. A single canvas is dramatically cheaper than N SVG layers when
  // rendering thousands of routes.
  let canvasRenderer: L.Canvas | null = null
  // Track which polylines belong to which activity id so highlighting
  // can find them in O(1) instead of walking every layer.
  const polylinesByActivityId = new Map<number, L.Polyline>()
  // Whether we've already fit the map to the initial activity set. We
  // only auto-fit once per sync so streaming updates don't keep
  // yanking the viewport around.
  let hasFitInitialBounds = false

  const initializeMap = () => {
    if (!mapContainer.value) return

    canvasRenderer = L.canvas({ padding: 0.5 })

    map = L.map(mapContainer.value, {
      center: [40.7128, -74.006],
      zoom: 10,
      zoomControl: true,
      minZoom: 3,
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
      preferCanvas: true,
      renderer: canvasRenderer,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    activityLayers = L.layerGroup().addTo(map)
  }

  const activityPopup = (activity: CachedActivity) => {
    return `
      <div class="activity-popup">
        <h3>${activity.name}</h3>
        <p><strong>Type:</strong> ${activity.type}</p>
        <p><strong>Distance:</strong> ${(activity.distance / 1000).toFixed(2)} km</p>
        <p><strong>Duration:</strong> ${Math.floor(activity.moving_time / 60)} min</p>
        <p><strong>Date:</strong> ${formatDate(activity.start_date)}</p>
        <p>
            <a href="https://www.strava.com/activities/${activity.id}" target="_blank" rel="noopener noreferrer">
            View on Strava
            </a>
          </p>
      </div>
    `
  }

  const addActivitiesToMap = (moveBounds = true) => {
    if (!map || !activityLayers) return

    activityLayers.clearLayers()
    polylinesByActivityId.clear()

    if (props.activities.length === 0) {
      hasFitInitialBounds = false
      return
    }

    const bounds = L.latLngBounds([])
    let hasValidCoordinates = false

    props.activities.forEach((activity) => {
      try {
        if (mapStore.showMarkers && activity.start_latlng && activity.start_latlng.length === 2) {
          const [lat, lng] = activity.start_latlng
          const startMarker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: 'activity-start-marker',
              html: `<div class="marker-content" style="background-color: ${getActivityColor(activity.type)}">
                      <svg class="marker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${getActivityIconSvgMarkup(activity.type)}</svg>
                    </div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            }),
          })
          startMarker.bindPopup(activityPopup(activity))
          startMarker.on('click', () => {
            emit('activitySelected', activity)
          })
          activityLayers?.addLayer(startMarker)
          bounds.extend([lat, lng])
          hasValidCoordinates = true
        }
        // Use the pre-decoded polyline stored alongside the activity.
        // `coords` is populated once by the sync pipeline so we avoid
        // re-decoding the polyline on every redraw.
        const coordinates = activity.coords
        if (coordinates && coordinates.length > 0) {
          const polyline = L.polyline(coordinates, {
            color: getActivityColor(activity.type),
            weight: 3,
            opacity: 0.7,
            renderer: canvasRenderer ?? undefined,
            // Simplify at low zooms to cut canvas work further.
            smoothFactor: 2,
          })
          polyline.bindPopup(activityPopup(activity))
          polyline.on('click', () => {
            emit('activitySelected', activity)
          })
          activityLayers?.addLayer(polyline)
          polylinesByActivityId.set(activity.id, polyline)
          coordinates.forEach((coord) => bounds.extend(coord))
          hasValidCoordinates = true
        }
      } catch (error) {
        console.error('Error processing activity:', activity.id, error)
      }
    })

    // Only auto-fit the first time we paint a non-empty list so that
    // streaming updates (new pages arriving) don't keep snapping the
    // viewport around while the user is interacting with the map.
    if (hasValidCoordinates && bounds.isValid() && moveBounds && !hasFitInitialBounds) {
      map.fitBounds(bounds, { padding: [20, 20] })
      hasFitInitialBounds = true
    }
  }

  const highlightActivity = (activityId: number | null) => {
    if (!map) return

    for (const line of polylinesByActivityId.values()) {
      line.setStyle({ weight: 3, opacity: 0.7 })
    }

    if (activityId == null) return
    const activity = props.activities.find((a) => a.id === activityId)
    if (!activity) return

    const highlighted = polylinesByActivityId.get(activityId)
    if (highlighted) {
      highlighted.setStyle({ weight: 5, opacity: 1 })
      highlighted.bringToFront()
      const b = highlighted.getBounds()
      if (b.isValid()) {
        map.fitBounds(b, { padding: [30, 30], maxZoom: 16 })
        return
      }
    }

    // Fallback: zoom to start/end latlng when there's no polyline.
    if (activity.start_latlng && activity.start_latlng.length === 2) {
      map.setView(activity.start_latlng as [number, number], 15, { animate: true })
    } else if (activity.end_latlng && activity.end_latlng.length === 2) {
      map.setView(activity.end_latlng as [number, number], 15, { animate: true })
    }
  }

  // Rebuild the map when the activity list is replaced. We watch on
  // reference + length (shallow) rather than deep — the sync pipeline
  // always assigns a fresh array, so mutation-watching isn't needed
  // and deep watching over thousands of activities is expensive.
  watch(
    [() => props.activities, () => props.activities.length],
    () => {
      addActivitiesToMap()
    },
  )

  // Reset the "auto-fit once" flag whenever the list becomes empty
  // (e.g. on logout) so the next sync re-fits the viewport.
  watch(
    () => props.activities.length,
    (len) => {
      if (len === 0) hasFitInitialBounds = false
    },
  )

  watch(
    () => props.selectedActivity,
    (newActivityId) => {
      highlightActivity(newActivityId)
    },
  )

  watch(
    () => mapStore.showMarkers,
    () => {
      addActivitiesToMap(false)
    },
  )

  onMounted(() => {
    initializeMap()
    if (props.activities.length > 0) {
      addActivitiesToMap()
    }
  })

  onUnmounted(() => {
    if (map) {
      map.remove()
      map = null
    }
    activityLayers = null
    canvasRenderer = null
    polylinesByActivityId.clear()
  })
</script>

<style scoped>
  .map-container {
    position: relative;
    height: 100%;
    width: 100%;
  }

  .activity-map {
    height: 100%;
    width: 100%;
    z-index: 1;
    min-height: 300px;
  }

  @media (max-width: 768px) {
    .activity-map {
      min-height: 60vh;
    }

    .map-container {
      height: calc(100% - 70px);
    }
  }

  .map-loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--color-bg) 90%, transparent);
    z-index: var(--z-loading);
    color: var(--color-text);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--color-border);
    border-top-color: var(--color-brand);
    border-radius: var(--radius-full);
    animation: spin 1s linear infinite;
    margin-bottom: var(--space-4);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  :deep(.activity-start-marker) {
    background: transparent;
    border: none;
  }

  :deep(.marker-content) {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    border: 2px solid #fff;
    box-shadow: var(--shadow-md);
  }

  :deep(.marker-content .marker-icon) {
    width: 16px;
    height: 16px;
  }

  :deep(.activity-popup) {
    min-width: 200px;
  }

  :deep(.activity-popup h3) {
    margin: 0 0 var(--space-2) 0;
    color: var(--color-brand);
    font-size: var(--font-size-lg);
  }

  :deep(.activity-popup p) {
    margin: var(--space-1) 0;
    font-size: var(--font-size-sm);
  }

  :deep(.activity-popup a) {
    color: var(--color-brand);
    font-weight: 600;
    text-decoration: none;
  }

  :deep(.activity-popup a:hover) {
    text-decoration: underline;
  }
</style>
