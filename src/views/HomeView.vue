<template>
  <Teleport to=".header-right">
    <button
      v-if="isAuthenticated && isMobile"
      @click="toggleMobileList"
      class="mobile-list-toggle"
      :class="{ active: showMobileList }"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    <div v-if="isAuthenticated" class="auth-controls">
      <button @click="handleLogout" class="logout-button">Logout</button>
    </div>
  </Teleport>

  <div v-if="error" class="error-banner">
    <p>{{ error }}</p>
    <button @click="error = null" class="error-close">×</button>
  </div>

  <main class="app-main">
    <div v-if="!isAuthenticated" class="auth-prompt">
      <div class="auth-prompt-bg" aria-hidden="true">
        <span class="auth-prompt-blob auth-prompt-blob--a"></span>
        <span class="auth-prompt-blob auth-prompt-blob--b"></span>
      </div>

      <div class="auth-prompt-content">
        <div class="auth-prompt-badge">
          <ActivityIcon type="Ride" :size="20" />
          <span>Your adventures, on the map</span>
        </div>

        <h2 class="auth-prompt-title">
          See every ride, run and hike
          <span class="auth-prompt-title-accent">in one place.</span>
        </h2>

        <p class="auth-prompt-subtitle">
          Connect your Strava account to visualise your activity history on a beautiful interactive
          map — distance, elevation, routes and more.
        </p>

        <div class="auth-features">
          <div v-for="feature in authFeatures" :key="feature.type" class="feature">
            <span
              class="feature-icon"
              :style="{ backgroundColor: getActivityColor(feature.type) }"
            >
              <ActivityIcon :type="feature.type" :size="22" color="#fff" />
            </span>
            <div class="feature-text">
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.description }}</p>
            </div>
          </div>
        </div>

        <button
          @click="authenticateWithStrava"
          class="auth-button large"
          :disabled="loading"
          type="button"
        >
          <svg
            class="auth-button-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066M9.644 10.72L12.538 5l2.87 5.72h3.18L12.538 0 6.4 10.72h3.244" />
          </svg>
          <span>{{ loading ? 'Connecting…' : 'Connect with Strava' }}</span>
        </button>

        <p class="auth-prompt-footnote">
          We only request read access to your activities. Your data never leaves your browser.
        </p>
      </div>
    </div>

    <div v-else class="app-content">
      <div class="desktop-layout">
        <aside class="activity-sidebar" :class="{ 'mobile-open': showMobileList }">
          <ActivityList
            :activities="activities"
            :filtered-activities="filteredActivities"
            :selected-activity="selectedActivity"
            :loading="loading"
            :activityMarkers="showMarkers"
            v-model:selected-type="selectedType"
            v-model:search-query="searchQuery"
            @activity-selected="handleActivitySelected"
          />
        </aside>

        <div class="map-area">
          <ActivityMap
            :activities="filteredActivities"
            :loading="loading"
            :selected-activity="selectedActivity"
            :showMarkers="showMarkers"
            @activity-selected="handleActivitySelected"
          />
        </div>
      </div>

      <div
        v-if="showMobileList && isMobile"
        class="mobile-overlay"
        @click="showMobileList = false"
      ></div>
    </div>
  </main>
</template>

<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue'
  import ActivityMap from '@/components/ActivityMap.vue'
  import ActivityList from '@/components/ActivityList.vue'
  import ActivityIcon from '@/components/ActivityIcon.vue'
  import { StravaService, type StravaActivity } from '@/services/strava'
  import { stravaConfig } from '@/config/strava'
  import { getActivityColor } from '@/utils/activityStyle'

  const authFeatures = [
    {
      type: 'Ride',
      title: 'Every ride, mapped',
      description: 'Road, gravel or MTB — see every route you’ve ridden.',
    },
    {
      type: 'Run',
      title: 'Runs at a glance',
      description: 'Filter by type, date or distance and zoom to any activity.',
    },
    {
      type: 'Hike',
      title: 'Hikes & adventures',
      description: 'Elevation profiles and distances for all your outings.',
    },
  ]

  // App state
  const activities = ref<StravaActivity[]>([])
  const selectedActivity = ref<number | null>(null)
  const showMarkers = ref<boolean>(false)
  const loading = ref(false)
  const isAuthenticated = ref(false)
  const showMobileList = ref(false)
  const error = ref<string | null>(null)
  
  // Filter state
  const selectedType = ref('')
  const searchQuery = ref('')

  // Initialize Strava service
  const stravaService = new StravaService(stravaConfig)

  // Check authentication status
  const checkAuthStatus = () => {
    isAuthenticated.value = stravaService.isAuthenticated()
  }

  // Handle Strava authentication
  const authenticateWithStrava = () => {
    const authUrl = stravaService.getAuthUrl()
    window.location.href = authUrl
  }

  // Handle OAuth callback
  const handleAuthCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const errorParam = urlParams.get('error')

    if (errorParam) {
      error.value = `Authentication failed: ${errorParam}`
      return
    }

    if (code) {
      try {
        loading.value = true
        await stravaService.exchangeCodeForToken(code)
        isAuthenticated.value = true

        // Clear the code from URL
        window.history.replaceState({}, document.title, window.location.pathname)

        // Load activities
        await loadActivities()
      } catch (err: any) {
        error.value = err.message || 'Authentication failed'
        console.error('Auth error:', err)
      } finally {
        loading.value = false
      }
    }
  }

  // Load activities from cache or Strava
  const loadActivities = async (forceRefresh = false) => {
    if (!isAuthenticated.value) return
    try {
      loading.value = true
      error.value = null
      activities.value = await stravaService.getCachedActivities(forceRefresh)
    } catch (err: any) {
      error.value = err.message || 'Failed to load activities'
      if (err.message.includes('Authentication failed')) {
        isAuthenticated.value = false
        stravaService.logout()
      }
    } finally {
      loading.value = false
    }
  }

  // Handle activity selection
  const handleActivitySelected = (activity: StravaActivity) => {
    selectedActivity.value = activity.id
    // Close mobile list when activity is selected
    if (window.innerWidth <= 768) {
      showMobileList.value = false
    }
  }

  // Handle logout
  const handleLogout = () => {
    stravaService.logout()
    isAuthenticated.value = false
    activities.value = []
    selectedActivity.value = null
    error.value = null
  }

  // Toggle mobile list
  const toggleMobileList = () => {
    showMobileList.value = !showMobileList.value
  }

  // Computed properties
  const isMobile = computed(() => {
    return window.innerWidth <= 768
  })

  // Filter activities based on type and search query
  const filteredActivities = computed(() => {
    let filtered = activities.value

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

  // Initialize app
  onMounted(async () => {
    checkAuthStatus()

    // Handle OAuth callback if present
    if (window.location.search.includes('code=') || window.location.search.includes('error=')) {
      await handleAuthCallback()
    } else if (isAuthenticated.value) {
      await loadActivities()
    }
  })
</script>



<style scoped>
.app-main {
  flex: 1;
  overflow: hidden;
}

.mobile-list-toggle {
  display: none;
  flex-direction: column;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  transition: background-color var(--duration-fast) var(--ease-out);
}

.mobile-list-toggle:hover {
  background: rgba(255, 255, 255, 0.15);
}

.mobile-list-toggle span {
  display: block;
  width: 22px;
  height: 2px;
  background: currentColor;
  margin: 2px 0;
  border-radius: 1px;
  transition: transform var(--duration-base) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}

.mobile-list-toggle.active span:nth-child(1) {
  transform: rotate(-45deg) translate(-5px, 5px);
}

.mobile-list-toggle.active span:nth-child(2) {
  opacity: 0;
}

.mobile-list-toggle.active span:nth-child(3) {
  transform: rotate(45deg) translate(-5px, -5px);
}

/* ---------------- Auth button ---------------- */
.auth-button {
  background: var(--color-brand);
  color: var(--color-text-inverse);
  border: none;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  transition: transform var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
  box-shadow: var(--shadow-brand);
}

.auth-button:hover:not(:disabled) {
  background: var(--color-brand-600);
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(252, 76, 2, 0.35);
}

.auth-button:active:not(:disabled) {
  transform: translateY(0);
}

.auth-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.auth-button.large {
  padding: var(--space-4) var(--space-6);
  font-size: var(--font-size-lg);
}

.auth-button-icon {
  flex-shrink: 0;
}

.auth-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.logout-button {
  background: rgba(255, 255, 255, 0.18);
  color: var(--color-text-inverse);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-family: inherit;
  font-weight: 500;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.logout-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* ---------------- Auth prompt (hero) ---------------- */
.auth-prompt {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
  text-align: center;
  padding: var(--space-6);
  overflow: hidden;
  background:
    radial-gradient(ellipse at top left, rgba(252, 76, 2, 0.15), transparent 55%),
    radial-gradient(ellipse at bottom right, rgba(255, 138, 61, 0.12), transparent 55%),
    linear-gradient(180deg, var(--color-bg) 0%, var(--color-surface) 100%);
}

.auth-prompt-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.auth-prompt-blob {
  position: absolute;
  border-radius: var(--radius-full);
  filter: blur(90px);
  opacity: 0.55;
}

.auth-prompt-blob--a {
  top: -120px;
  left: -120px;
  width: 420px;
  height: 420px;
  background: radial-gradient(circle, #ff8a3d 0%, rgba(255, 138, 61, 0) 70%);
}

.auth-prompt-blob--b {
  bottom: -140px;
  right: -140px;
  width: 460px;
  height: 460px;
  background: radial-gradient(circle, #fc4c02 0%, rgba(252, 76, 2, 0) 70%);
}

.auth-prompt-content {
  position: relative;
  z-index: 1;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.auth-prompt-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-brand-50);
  color: var(--color-brand-700);
  border: 1px solid color-mix(in srgb, var(--color-brand) 20%, transparent);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: 600;
  letter-spacing: 0.01em;
}

.auth-prompt-title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--color-text);
  max-width: 16ch;
}

.auth-prompt-title-accent {
  display: block;
  background: linear-gradient(135deg, var(--color-brand) 0%, #ff8a3d 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.auth-prompt-subtitle {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  max-width: 52ch;
  line-height: 1.5;
}

.auth-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
  width: 100%;
  margin: var(--space-4) 0 var(--space-3);
}

.feature {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  text-align: left;
  transition: transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.feature:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  color: #fff;
  box-shadow: var(--shadow-sm);
}

.feature-text {
  flex: 1;
  min-width: 0;
}

.feature-text h3 {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
}

.feature-text p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.45;
}

.auth-prompt-footnote {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* ---------------- App layout ---------------- */
.app-content {
  height: 100%;
  position: relative;
}

.desktop-layout {
  height: 100%;
  display: flex;
}

.activity-sidebar {
  width: var(--sidebar-width);
  background: var(--color-surface-2);
  border-right: 1px solid var(--color-border);
  flex-shrink: 0;
}

.map-area {
  flex: 1;
  position: relative;
}

.mobile-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: var(--z-overlay);
}

@media (max-width: 768px) {
  .mobile-list-toggle {
    display: flex;
  }

  .auth-controls {
    gap: var(--space-2);
  }

  .auth-prompt {
    padding: var(--space-5) var(--space-4);
  }

  .auth-features {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }

  .activity-sidebar {
    position: fixed;
    top: var(--header-height);
    left: 0;
    height: calc(100vh - var(--header-height));
    width: 90vw;
    max-width: var(--sidebar-width);
    transform: translateX(-100%);
    transition: transform var(--duration-base) var(--ease-out);
    z-index: var(--z-sidebar);
    box-shadow: var(--shadow-lg);
  }

  .activity-sidebar.mobile-open {
    transform: translateX(0);
  }

  .desktop-layout {
    flex-direction: column;
  }

  .map-area {
    height: 100%;
  }
}
</style>
