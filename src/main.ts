import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './styles/main.css'
import { applyActivityColorsToRoot } from '@/utils/activityStyle'

// Project the authoritative TS color map onto CSS custom properties
// so stylesheets can reference them as `var(--color-activity-*)`
// without duplicating the palette.
applyActivityColorsToRoot()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
