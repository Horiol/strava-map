<template>
  <div class="activity-list">
    <div class="activity-list-header">
      <h2>Activities</h2>
      <label class="toggle-markers-label">
        <input
          type="checkbox"
          v-model="mapStore.showMarkers"
        /> Show activity markers
      </label>
      <div class="activity-stats">
        <span class="activity-count">{{ activities.length }} activities</span>
        <span v-if="totalDistance > 0" class="total-distance">
          {{ (totalDistance / 1000).toFixed(1) }} km total
        </span>
      </div>
    </div>

    <div class="activity-filters">
      <select v-model="selectedType" class="activity-type-filter">
        <option value="">All Activities</option>
        <option v-for="type in activityTypes" :key="type" :value="type">
          {{ type }}
        </option>
      </select>

      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search activities..."
        class="activity-search"
      />
    </div>

    <div class="activity-items" v-if="filteredActivities.length > 0">
      <div
        v-for="activity in filteredActivities"
        :key="activity.id"
        class="activity-item"
        :class="{ selected: selectedActivity === activity.id }"
        @click="$emit('activitySelected', activity)"
      >
        <div class="activity-header">
          <div
            class="activity-type-badge"
            :style="{ backgroundColor: getActivityColor(activity.type) }"
          >
            {{ activity.type.charAt(0) }}
          </div>
          <div class="activity-info">
            <h3 class="activity-name">
              {{ activity.name }}
              <a
                :href="`https://www.strava.com/activities/${activity.id}`"
                target="_blank"
                rel="noopener noreferrer"
                class="strava-link"
                @click.stop
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="icon icon-tabler icons-tabler-outline icon-tabler-external-link"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" />
                  <path d="M11 13l9 -9" />
                  <path d="M15 4h5v5" />
                </svg>
              </a>
            </h3>
            <p class="activity-date">{{ formatDate(activity.start_date) }}</p>
          </div>
        </div>

        <div class="activity-stats">
          <div class="stat">
            <span class="stat-label">Distance</span>
            <span class="stat-value">{{ (activity.distance / 1000).toFixed(2) }} km</span>
          </div>
          <div class="stat">
            <span class="stat-label">Duration</span>
            <span class="stat-value">{{ formatDuration(activity.moving_time) }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Speed</span>
            <span class="stat-value">{{ (activity.average_speed * 3.6).toFixed(1) }} km/h</span>
          </div>
          <div v-if="activity.total_elevation_gain > 0" class="stat">
            <span class="stat-label">Elevation</span>
            <span class="stat-value">{{ Math.round(activity.total_elevation_gain) }} m</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activities.length === 0 && !loading" class="empty-state">
      <p>No activities found. Make sure you're connected to Strava.</p>
    </div>

    <div v-else class="empty-state">
      <p>No activities match your filters.</p>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading activities...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StravaActivity } from '@/services/strava'
import { useMapStore } from '@/stores/map'
import { formatDate } from '@/utils/date'

const mapStore = useMapStore()

interface Props {
  activities: StravaActivity[]
  selectedActivity?: number | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedActivity: null,
  loading: false,
})

const emit = defineEmits<{
  activitySelected: [activity: StravaActivity],
}>()

const selectedType = ref('')
const searchQuery = ref('')

const activityTypes = computed(() => {
  const types = new Set(props.activities.map((activity) => activity.type))
  return Array.from(types).sort()
})

const filteredActivities = computed(() => {
  let filtered = props.activities

  if (selectedType.value) {
    filtered = filtered.filter((activity) => activity.type === selectedType.value)
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    filtered = filtered.filter((activity) => activity.name.toLowerCase().includes(query))
  }

  return filtered.sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
  )
})

const totalDistance = computed(() => {
  return props.activities.reduce((sum, activity) => sum + activity.distance, 0)
})

const getActivityColor = (type: string): string | undefined => {
  const colors: Record<string, string> = {
    Ride: '#fc4c02',
    Run: '#e34902',
    Walk: '#00d4aa',
    Hike: '#8b6914',
    Swim: '#0077be',
    Workout: '#7b68ee',
    Yoga: '#dda0dd',
    WeightTraining: '#4b0082',
    default: '#fc4c02',
  }
    return colors[type] ?? colors.default
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}
</script>

<style scoped>
.activity-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
}

.activity-list-header {
  padding: 1rem;
  background: white;
  border-bottom: 1px solid #e9ecef;
}

.activity-list-header h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.25rem;
}

.activity-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #6c757d;
}

.activity-filters {
  padding: 1rem;
  background: white;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  gap: 1rem;
}

.activity-type-filter,
.activity-search {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
}

.activity-type-filter:focus,
.activity-search:focus {
  outline: none;
  border-color: #fc4c02;
  box-shadow: 0 0 0 2px rgba(252, 76, 2, 0.2);
}

.activity-items {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.activity-item {
  background: white;
  border-bottom: 1px solid #e9ecef;
  padding: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.activity-item:hover {
  background-color: #f8f9fa;
}

.activity-item.selected {
  background-color: #fff3f0;
  border-left: 4px solid #fc4c02;
}

.activity-header {
  display: flex;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.activity-type-badge {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 14px;
  margin-right: 0.75rem;
  flex-shrink: 0;
}

.activity-info {
  flex: 1;
  min-width: 0;
}

.activity-name {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-date {
  margin: 0;
  font-size: 0.875rem;
  color: #6c757d;
}

.activity-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 0.5rem;
}

.stat {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 0.75rem;
  color: #6c757d;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.stat-value {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #333;
}

.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: #6c757d;
  flex: 1;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #fc4c02;
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

/* Mobile responsiveness */
@media (max-width: 768px) {
  .activity-filters {
    flex-direction: column;
  }

  .activity-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
