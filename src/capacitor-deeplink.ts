import { App as CapacitorApp } from '@capacitor/app'
import router from './router'

// Listen for deep link redirects (OAuth callback)
CapacitorApp.addListener('appUrlOpen', (event: { url: string }) => {
  const slug = event.url.split('amplify.com').pop()
  if (slug) {
    router.push({ path: slug })
  }
})
