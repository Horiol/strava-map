<template>
  <div class="map-container">
    <div id="activity-map" ref="mapContainer" class="activity-map"></div>
    <div v-if="loading" class="map-loading">
      <div class="spinner"></div>
      <p>Loading activities...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch } from 'vue'
  import type { Ref } from 'vue'
  import L from 'leaflet'
  import type { StravaActivity } from '@/services/strava'
  import { decodePolyline } from '@/utils/polyline'
  import { useMapStore } from '@/stores/map'
  import { formatDate } from '@/utils/date'
  import { getActivityColor, getActivityIconSvgMarkup } from '@/utils/activityStyle'

  const mapStore = useMapStore()

  // Import Leaflet CSS
  import 'leaflet/dist/leaflet.css'

  // Fix Leaflet default markers in Vite/Webpack
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  })

  interface Props {
    activities: StravaActivity[]
    loading?: boolean
    selectedActivity?: number | null
  }

  const props = withDefaults(defineProps<Props>(), {
    loading: false,
    selectedActivity: null,
  })

  const emit = defineEmits<{
    activitySelected: [activity: StravaActivity]
  }>()

  const mapContainer: Ref<HTMLElement | null> = ref(null)
  let map: L.Map | null = null
  let activityLayers: L.LayerGroup | null = null

  const initializeMap = () => {
    if (!mapContainer.value) return

    map = L.map(mapContainer.value, {
      center: [40.7128, -74.006], // Default to NYC
      zoom: 10,
      zoomControl: true,
      minZoom: 3,
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
    })

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    // Initialize activity layers group
    activityLayers = L.layerGroup().addTo(map)
  }

  const activityPopup = (activity: StravaActivity) => {
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

    // Clear existing activities
    activityLayers.clearLayers()

    if (props.activities.length === 0) return

    const bounds = L.latLngBounds([])
    let hasValidCoordinates = false

    props.activities.forEach((activity) => {
      try {
        // Add start marker if available and showMarkers is true
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
        // Add route polyline if available
        if (activity.map && activity.map.summary_polyline) {
          try {
            const coordinates = decodePolyline(activity.map.summary_polyline)
            if (coordinates.length > 0) {
              const polyline = L.polyline(coordinates, {
                color: getActivityColor(activity.type),
                weight: 3,
                opacity: 0.7,
              })
              polyline.bindPopup(activityPopup(activity))
              polyline.on('click', () => {
                emit('activitySelected', activity)
              })
              activityLayers?.addLayer(polyline)
              coordinates.forEach((coord) => bounds.extend(coord))
              hasValidCoordinates = true
            }
          } catch (error) {
            console.warn('Error decoding polyline for activity:', activity.id, error)
          }
        }
      } catch (error) {
        console.error('Error processing activity:', activity.id, error)
      }
    })

    // Fit map to show all activities
    if (hasValidCoordinates && bounds.isValid() && moveBounds) {
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  }

  const highlightActivity = (activityId: number | null) => {
    if (!map || !activityLayers) return

    // Reset all activity styles
    activityLayers.eachLayer((layer: any) => {
      if (layer instanceof L.Polyline) {
        layer.setStyle({
          weight: 3,
          opacity: 0.7,
        })
      }
    })

    // Highlight and zoom to selected activity
    if (activityId) {
      const activity = props.activities.find((a) => a.id === activityId)
      if (activity) {
        // Highlight polyline if available
        if (activity.map?.summary_polyline) {
          activityLayers.eachLayer((layer: any) => {
            if (layer instanceof L.Polyline) {
              layer.setStyle({
                weight: 5,
                opacity: 1,
              })
            }
          })
          // Zoom to polyline bounds
          try {
            const coordinates = decodePolyline(activity.map.summary_polyline)
            if (coordinates.length > 0) {
              const bounds = L.latLngBounds(coordinates)
              map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 })
              return
            }
          } catch {}
        }
        // Fallback: zoom to start/end latlng
        if (activity.start_latlng && activity.start_latlng.length === 2) {
          map.setView(activity.start_latlng as [number, number], 15, { animate: true })
        } else if (activity.end_latlng && activity.end_latlng.length === 2) {
          map.setView(activity.end_latlng as [number, number], 15, { animate: true })
        }
      }
    }
  }

  // Watch for activities changes
  watch(
    () => props.activities,
    () => {
      addActivitiesToMap()
    },
    { deep: true },
  )

  // Watch for selected activity changes
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
