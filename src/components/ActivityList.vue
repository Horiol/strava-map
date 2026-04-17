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
      <div class="activity-summary">
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

    <div class="activity-items" v-if="props.filteredActivities.length > 0">
      <div
        v-for="activity in props.filteredActivities"
        :key="activity.id"
        class="activity-item"
        :class="{ selected: selectedActivity === activity.id }"
        @click="$emit('activitySelected', activity)"
      >
        <div class="activity-header">
          <div
            class="activity-type-badge"
            :style="{ backgroundColor: getActivityColor(activity.type) }"
            :title="activity.type"
          >
            <ActivityIcon :type="activity.type" :size="18" color="#fff" decorative />
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
import { computed } from 'vue'
import type { CachedActivity } from '@/services/strava'
import { useMapStore } from '@/stores/map'
import { formatDate } from '@/utils/date'
import { getActivityColor } from '@/utils/activityStyle'
import ActivityIcon from '@/components/ActivityIcon.vue'

const mapStore = useMapStore()

interface Props {
  activities: CachedActivity[]
  filteredActivities: CachedActivity[]
  selectedActivity?: number | null
  loading?: boolean
  selectedType: string
  searchQuery: string
}

const props = withDefaults(defineProps<Props>(), {
  selectedActivity: null,
  loading: false,
})

const emit = defineEmits<{
  activitySelected: [activity: CachedActivity],
  'update:selectedType': [value: string],
  'update:searchQuery': [value: string],
}>()

const selectedType = computed({
  get: () => props.selectedType,
  set: (value) => emit('update:selectedType', value)
})

const searchQuery = computed({
  get: () => props.searchQuery,
  set: (value) => emit('update:searchQuery', value)
})

const activityTypes = computed(() => {
  const types = new Set(props.activities.map((activity) => activity.type))
  return Array.from(types).sort()
})

const totalDistance = computed(() => {
  return props.activities.reduce((sum, activity) => sum + activity.distance, 0)
})

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
  background: var(--color-surface);
}

.activity-list-header {
  padding: var(--space-4);
  background: var(--color-surface-2);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 2;
}

.activity-list-header h2 {
  margin: 0 0 var(--space-2) 0;
  color: var(--color-text);
  font-size: var(--font-size-xl);
  font-weight: 700;
  letter-spacing: -0.01em;
}

.toggle-markers-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
  cursor: pointer;
  user-select: none;
}

.toggle-markers-label input[type='checkbox'] {
  accent-color: var(--color-brand);
  cursor: pointer;
}

.activity-summary {
  display: flex;
  gap: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.activity-count,
.total-distance {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.total-distance {
  color: var(--color-brand);
  font-weight: 600;
}

.activity-filters {
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-2);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  gap: var(--space-3);
}

.activity-type-filter,
.activity-search {
  flex: 1;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-family: inherit;
  background: var(--color-bg);
  color: var(--color-text);
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.activity-type-filter:hover,
.activity-search:hover {
  border-color: var(--color-border-strong);
}

.activity-type-filter:focus,
.activity-search:focus {
  outline: none;
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-brand) 25%, transparent);
}

.activity-items {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.activity-item {
  background: var(--color-surface-2);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-4);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
  border-left: 4px solid transparent;
}

.activity-item:hover {
  background-color: var(--color-surface);
}

.activity-item.selected {
  background-color: var(--color-brand-50);
  border-left-color: var(--color-brand);
}

.activity-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.activity-type-badge {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.activity-info {
  flex: 1;
  min-width: 0;
}

.activity-name {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.strava-link {
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  transition: color var(--duration-fast) var(--ease-out);
}

.strava-link:hover {
  color: var(--color-brand);
}

.activity-date {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.activity-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: var(--space-2);
}

.stat {
  text-align: center;
  padding: var(--space-2) 0;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
}

.stat-label {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: var(--space-1);
}

.stat-value {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}

.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  text-align: center;
  color: var(--color-text-muted);
  flex: 1;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
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

@media (max-width: 768px) {
  .activity-filters {
    flex-direction: column;
  }

  .activity-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
