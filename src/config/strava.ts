import { Capacitor } from '@capacitor/core';

export const stravaConfig = {
  // You'll need to replace these with your actual Strava app credentials
  // Get them from https://www.strava.com/settings/api
  clientId: import.meta.env.VITE_STRAVA_CLIENT_ID || 'YOUR_CLIENT_ID',
  clientSecret: import.meta.env.VITE_STRAVA_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
  redirectUri: Capacitor.isNativePlatform() ? 'myapp://auth/callback' : (import.meta.env.VITE_STRAVA_REDIRECT_URI || `${window.location.origin}/auth/callback`)
}
