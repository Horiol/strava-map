import { App as CapacitorApp } from '@capacitor/app';

// Listen for deep link redirects (OAuth callback)
CapacitorApp.addListener('appUrlOpen', (event: { url: string }) => {
  // Example: myapp://auth/callback?code=...
  if (event.url && event.url.startsWith('myapp://auth/callback')) {
    // You can use window.location.href = event.url or parse the code and route in your app
    // For example, use your router to navigate to the callback handler
    // router.push({ path: '/auth/callback', query: { ... } })
    // Or handle the OAuth code directly here
  }
});
