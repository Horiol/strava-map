<template>
  <div class="map-container">
    <div id="activity-map" ref="mapContainer" class="activity-map"></div>
    <button class="zoom-user-btn" @click="zoomToUserLocation" title="Zoom to your location">
      📍 My Location
    </button>
    <div v-if="loading" class="map-loading">
      <div class="spinner"></div>
      <p>Loading activities...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Zoom to user's location
const zoomToUserLocation = () => {
  if (!map) return
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.')
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      map.setView([lat, lng], 14, { animate: true })
      // Optionally add a marker for user location
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'user-location-marker',
          html: '<div class="user-location-dot"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map)
    },
    (err) => {
      alert('Unable to retrieve your location.')
    },
  )
}
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { Ref } from 'vue'
import L from 'leaflet'
import type { StravaActivity } from '@/services/strava'
import { decodePolyline } from '@/utils/polyline'

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

const getActivityColor = (type: string): string => {
  const colors: Record<string, string> = {
    Ride: '#fc4c02', // Strava orange
    Run: '#e34902',
    Walk: '#00d4aa',
    Hike: '#8b6914',
    Swim: '#0077be',
    Workout: '#7b68ee',
    Yoga: '#dda0dd',
    WeightTraining: '#4b0082',
    default: '#fc4c02',
  }
  return colors[type] || colors.default
}

const addActivitiesToMap = () => {
  if (!map || !activityLayers) return

  // Clear existing activities
  activityLayers.clearLayers()

  if (props.activities.length === 0) return

  const bounds = L.latLngBounds([])
  let hasValidCoordinates = false

  props.activities.forEach((activity) => {
    try {
      // Add start marker if available
      if (activity.start_latlng && activity.start_latlng.length === 2) {
        const [lat, lng] = activity.start_latlng

        const startMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'activity-start-marker',
            html: `<div class="marker-content" style="background-color: ${getActivityColor(activity.type)}">
                     <span class="marker-text">${activity.type.charAt(0)}</span>
                   </div>`,
            iconSize: [15, 15],
            iconAnchor: [15, 15],
          }),
        })

        startMarker.bindPopup(`
          <div class="activity-popup">
            <h3>${activity.name}</h3>
            <p><strong>Type:</strong> ${activity.type}</p>
            <p><strong>Distance:</strong> ${(activity.distance / 1000).toFixed(2)} km</p>
            <p><strong>Duration:</strong> ${Math.floor(activity.moving_time / 60)} min</p>
            <p><strong>Date:</strong> ${new Date(activity.start_date).toLocaleDateString()}</p>
            <p>
                <a href="https://www.strava.com/activities/${activity.id}" target="_blank" rel="noopener noreferrer">
                View on Strava
                </a>
              </p>
          </div>
        `)

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

            polyline.bindPopup(`
                <div class="activity-popup">
                <h3>${activity.name}</h3>
                <p><strong>Type:</strong> ${activity.type}</p>
                <p><strong>Distance:</strong> ${(activity.distance / 1000).toFixed(2)} km</p>
                <p><strong>Avg Speed:</strong> ${(activity.average_speed * 3.6).toFixed(1)} km/h</p>
                <p>
                  <a href="https://www.strava.com/activities/${activity.id}" target="_blank" rel="noopener noreferrer">
                  View on Strava
                  </a>
                </p>
                </div>
            `)

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
  if (hasValidCoordinates && bounds.isValid()) {
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
/* Zoom to user button */
.zoom-user-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1001;
  background: #fff;
  border: 1px solid #fc4c02;
  color: #fc4c02;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: background 0.2s;
}
.zoom-user-btn:hover {
  background: #fc4c02;
  color: #fff;
}

.user-location-marker .user-location-dot {
  width: 14px;
  height: 14px;
  background: #0077be;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 6px #0077be;
}
.map-container {
  position: relative;
  height: 100%;
  width: 100%;
}

.activity-map {
  height: 100%;
  width: 100%;
  z-index: 1;
}

.map-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  z-index: 1000;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #fc4c02;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

:deep(.activity-start-marker) {
  background: transparent;
  border: none;
}

:deep(.marker-content) {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 12px;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

:deep(.activity-popup) {
  min-width: 200px;
}

:deep(.activity-popup h3) {
  margin: 0 0 0.5rem 0;
  color: #fc4c02;
  font-size: 1.1rem;
}

:deep(.activity-popup p) {
  margin: 0.25rem 0;
  font-size: 0.9rem;
}
</style>
