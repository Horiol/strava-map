<script setup lang="ts">
  import { useRoute, useRouter } from 'vue-router'
  import { onMounted, ref } from 'vue'
  import { stravaConfig } from '@/config/strava'
  import { StravaService } from '@/services/strava'

  const router = useRouter()
  const route = useRoute()
  const stravaService = new StravaService(stravaConfig)

  const errorMessage = ref<string | null>(null)

  /**
   * Read a string query param. `route.query.code` may be `string`,
   * `string[]` or `undefined` depending on the URL shape — collapse
   * everything to a single string or `null` so the caller doesn't
   * have to do the narrowing itself.
   */
  function queryString(name: string): string | null {
    const raw = route.query[name]
    if (typeof raw === 'string') return raw
    if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
    return null
  }

  onMounted(async () => {
    const code = queryString('code')
    const errorParam = queryString('error')

    if (errorParam) {
      errorMessage.value = `Authentication failed: ${errorParam}`
      setTimeout(() => router.push('/'), 2000)
      return
    }

    if (!code) {
      errorMessage.value = 'No authorization code found in the callback URL.'
      setTimeout(() => router.push('/'), 2000)
      return
    }

    try {
      await stravaService.exchangeCodeForToken(code)
      router.push('/')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token exchange failed'
      errorMessage.value = message
      console.error('[AuthCallback] Token exchange failed', err)
      setTimeout(() => router.push('/'), 3000)
    }
  })
</script>

<template>
  <div class="auth-callback">
    <div class="callback-content">
      <div class="spinner" role="status" aria-live="polite"></div>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p v-else class="status">Finishing sign-in…</p>
    </div>
  </div>
</template>

<style scoped>
  .auth-callback {
    min-height: calc(100vh - var(--header-height, 60px));
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-brand) 80%, #ff8a3d) 0%,
      var(--color-brand) 55%,
      color-mix(in srgb, var(--color-brand) 20%, #7a2400) 100%
    );
    color: #fff;
    text-align: center;
  }

  .callback-content {
    max-width: 400px;
    padding: var(--space-6);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: var(--radius-full);
    animation: spin 1s linear infinite;
    margin: 0 auto var(--space-4);
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .status,
  .error {
    margin: 0;
    opacity: 0.95;
  }

  .error {
    font-weight: 600;
  }
</style>
