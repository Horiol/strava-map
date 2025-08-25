<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue'
  import ActivityMap from '@/components/ActivityMap.vue'
  import ActivityList from '@/components/ActivityList.vue'
  import { StravaService, type StravaActivity } from '@/services/strava'
  import { stravaConfig } from '@/config/strava'

  // App state
  const activities = ref<StravaActivity[]>([])
  const selectedActivity = ref<number | null>(null)
  const loading = ref(false)
  const isAuthenticated = ref(false)
  const showMobileList = ref(false)
  const error = ref<string | null>(null)

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

<template>
  <!-- Error message -->
  <div v-if="error" class="error-banner">
    <p>{{ error }}</p>
    <button @click="error = null" class="error-close">×</button>
  </div>

  <!-- Main content -->
  <main class="app-main">
    <!-- Not authenticated view -->
    <div v-if="!isAuthenticated" class="auth-prompt">
      <div class="auth-prompt-content">
        <div class="auth-icon">🗺️</div>
        <h2>Welcome to Strava Activity Map</h2>
        <p>Connect your Strava account to visualize all your activities on an interactive map.</p>

        <div class="auth-features">
          <div class="feature">
            <div class="feature-icon">📍</div>
            <div class="feature-text">
              <h3>Activity Routes</h3>
              <p>See your running, cycling, and hiking routes plotted on the map</p>
            </div>
          </div>

          <div class="feature">
            <div class="feature-icon">📊</div>
            <div class="feature-text">
              <h3>Activity Stats</h3>
              <p>View detailed statistics for each activity</p>
            </div>
          </div>

          <div class="feature">
            <div class="feature-icon">🔍</div>
            <div class="feature-text">
              <h3>Filter & Search</h3>
              <p>Find specific activities by type or name</p>
            </div>
          </div>
        </div>

        <button @click="authenticateWithStrava" class="auth-button large" :disabled="loading">
          <span class="strava-logo">STRAVA</span>
          Connect with Strava
        </button>
      </div>
    </div>

    <!-- Authenticated view -->
    <div v-else class="app-content">
      <!-- Desktop layout -->
      <div class="desktop-layout">
        <!-- Activity list sidebar -->
        <aside class="activity-sidebar" :class="{ 'mobile-open': showMobileList }">
          <ActivityList
            :activities="activities"
            :selected-activity="selectedActivity"
            :loading="loading"
            @activity-selected="handleActivitySelected"
          />
        </aside>

        <!-- Map area -->
        <div class="map-area">
          <ActivityMap
            :activities="activities"
            :loading="loading"
            :selected-activity="selectedActivity"
            @activity-selected="handleActivitySelected"
          />
        </div>
      </div>

      <!-- Mobile overlay -->
      <div
        v-if="showMobileList && isMobile"
        class="mobile-overlay"
        @click="showMobileList = false"
      ></div>
    </div>
  </main>
</template>

<style scoped>
.app-main {
  flex: 1;
  overflow: hidden;
}

.auth-prompt {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-align: center;
  padding: 2rem;
}

.auth-prompt-content {
  max-width: 600px;
}

.auth-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.auth-prompt h2 {
  font-size: 2.5rem;
  margin: 0 0 1rem 0;
  font-weight: 300;
}

.auth-prompt > p {
  font-size: 1.2rem;
  margin-bottom: 3rem;
  opacity: 0.9;
}

.auth-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  margin: 3rem 0;
}

.feature {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  text-align: left;
}

.feature-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.feature-text h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
}

.feature-text p {
  margin: 0;
  opacity: 0.8;
  font-size: 0.9rem;
}

.app-content {
  height: 100%;
  position: relative;
}

.desktop-layout {
  height: 100%;
  display: flex;
}

.activity-sidebar {
  width: 400px;
  background: white;
  border-right: 1px solid #e9ecef;
  flex-shrink: 0;
}

.map-area {
  flex: 1;
  position: relative;
}

.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 199;
}

/* Mobile styles */
@media (max-width: 768px) {
  .app-title {
    font-size: 1.2rem;
  }

  .header-right {
    gap: 0.5rem;
  }

  .mobile-list-toggle {
    display: flex;
  }

  .auth-controls {
    gap: 0.5rem;
  }

  .auth-status {
    display: none;
  }

  .auth-prompt {
    padding: 1rem;
  }

  .auth-prompt h2 {
    font-size: 2rem;
  }

  .auth-features {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin: 2rem 0;
  }

  .feature {
    text-align: center;
    flex-direction: column;
  }

  .activity-sidebar {
    position: fixed;
    top: 60px;
    left: 0;
    height: calc(100vh - 60px);
    width: 90vw;
    max-width: 400px;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    z-index: 200;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
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
