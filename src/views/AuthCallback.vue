<script setup lang="ts">
  import { Capacitor } from '@capacitor/core';
  import { useRouter } from 'vue-router';
  import { onMounted } from 'vue';

  const router = useRouter();

  onMounted(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    console.log('AuthCallback component mounted');
    console.log('URL search params:', window.location.search);
    console.log('Authorization code:', code);

    if (Capacitor.isNativePlatform() && code) {
      // Redirect to custom scheme for native app
      console.log('Redirecting to native app scheme');
      window.location.href = `stravamap://auth/callback?code=${code}`;
    } else if (code) {
      console.log('Authorization code received:', code);
      // Redirect to home page after processing
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } else {
      console.error('No authorization code found in URL');
      // Redirect to home if no code
      setTimeout(() => {
        router.push('/');
      }, 2000);
    }
  });
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
