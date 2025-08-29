<script setup lang="ts">
  import { Capacitor } from '@capacitor/core';
  import { useRouter } from 'vue-router';
  import { onMounted } from 'vue';
  import { stravaConfig } from '@/config/strava'
  import { StravaService } from '@/services/strava'

  const router = useRouter();
  const stravaService = new StravaService(stravaConfig)

  onMounted( async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    console.log('AuthCallback component mounted');
    console.log('URL search params:', window.location.search);
    console.log('Authorization code:', code);
    console.log('Is native platform:', Capacitor.isNativePlatform());
    console.log('User agent:', navigator.userAgent);

    if (code) {
      await stravaService.exchangeCodeForToken(code)
      router.push('/');
      // if (Capacitor.isNativePlatform()) {
      //   router.push('/');
      // } else {
      //   console.log('Authorization code received in browser');
      //   tryOpenNativeApp(code);
      // }
    } else {
      console.error('No authorization code found in URL');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    }
  });

  const tryOpenNativeApp = (code: string) => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isAndroid || isIOS) {
      console.log('Mobile browser detected, attempting to open native app');

      // Try to open the native app
      const nativeUrl = `stravamap://auth/callback?code=${code}`;

      // Create a hidden iframe to attempt app launch
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = nativeUrl;
      document.body.appendChild(iframe);

      // Fallback timer - if app doesn't open, continue with web flow
      const fallbackTimer = setTimeout(() => {
        console.log('Native app not available, continuing with web flow');
        handleWebAuth(code);
        document.body.removeChild(iframe);
      }, 2500);

      // If the page loses focus, assume app opened successfully
      const handleVisibilityChange = () => {
        if (document.hidden) {
          console.log('Page hidden, app likely opened');
          clearTimeout(fallbackTimer);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Additional fallback for older browsers
      window.addEventListener('blur', () => {
        clearTimeout(fallbackTimer);
      }, { once: true });

    } else {
      // Desktop browser - just handle web auth
      console.log('Desktop browser detected');
      handleWebAuth(code);
    }
  };

  const handleWebAuth = (code: string) => {
    console.log('Handling web authentication with code:', code);
    // Redirect to home page after processing
    setTimeout(() => {
      router.push('/');
    }, 1500);
  };
</script>

<template>
  <div class="auth-callback">
    <div class="callback-content">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<style scoped>
.auth-callback {
  height: calc(100vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-align: center;
}

.callback-content {
  max-width: 400px;
  padding: 2rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 2rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.callback-content h2 {
  margin: 0 0 1rem 0;
  font-weight: 300;
}

.callback-content p {
  margin: 0;
  opacity: 0.9;
}
</style>
