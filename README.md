# Strava Activity Map PWA

A Progressive Web App (PWA) built with Vue.js that displays your Strava activities on an interactive map.

## Features

- 🗺️ **Interactive Map**: View all your activities plotted on an interactive Leaflet map
- 📱 **PWA Support**: Install on mobile devices and use offline
- 🏃 **Activity Visualization**: See your running, cycling, hiking routes as colored polylines
- 📊 **Detailed Stats**: View distance, duration, speed, and elevation data for each activity  
- 🔍 **Search & Filter**: Find specific activities by type or name
- 📱 **Responsive Design**: Optimized for both desktop and mobile devices

## Prerequisites

- Node.js (v20.19+ or v22.12+) - **Important**: Vite 7.x requires newer Node.js versions
- A Strava account
- Strava API application credentials

> **Note**: This project is now configured with Node.js v22.18.0 and includes full PWA support.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Strava API Application

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Create a new application
3. Set the Authorization Callback Domain to your domain (for local development: `localhost`)
4. Note down your Client ID and Client Secret

### 3. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Strava credentials:
   ```
   VITE_STRAVA_CLIENT_ID=your_client_id_here
   VITE_STRAVA_CLIENT_SECRET=your_client_secret_here  
   VITE_STRAVA_REDIRECT_URI=http://localhost:5173/auth/callback
   ```

### 4. Update Strava App Settings

In your Strava API application settings, make sure the Authorization Callback Domain includes:
- For local development: `localhost`
- For production: your domain (e.g., `yourdomain.com`)

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` folder, ready to deploy to any static hosting service.

## PWA Features

This app includes:
- Service Worker for offline functionality
- Web App Manifest for installation
- Responsive design for all screen sizes
- Optimized performance with code splitting

## Technology Stack

- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type safety and better development experience
- **Vite** - Fast build tool and development server
- **Leaflet** - Interactive maps library
- **Pinia** - State management
- **PWA Plugin** - Service worker and manifest generation

## API Usage

The app uses the Strava API v3 to fetch:
- Athlete activities list
- Activity details and GPS tracks
- Activity statistics

All data is processed client-side and not stored on any external servers.

## License

This project is licensed under the MIT License.

## Disclaimer

This application is not affiliated with Strava. Strava is a registered trademark of Strava, Inc.
