import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Capacitor } from '@capacitor/core'

import App from './App.vue'
import router from './router'
import './styles/main.css'
import { applyActivityColorsToRoot } from '@/utils/activityStyle'

// Project the authoritative TS color map onto CSS custom properties
// so stylesheets can reference them as `var(--color-activity-*)`
// without duplicating the palette.
applyActivityColorsToRoot()

// Register the native deep-link handler only on Capacitor targets.
// Web builds don't need (and must not load) the listener — the
// browser handles the OAuth redirect normally.
if (Capacitor.isNativePlatform()) {
  // Side-effect import: attaching the listener happens at module load.
  import('./capacitor-deeplink').catch((err) => {
    console.warn('[capacitor-deeplink] Failed to register handler', err)
  })
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
