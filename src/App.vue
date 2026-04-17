
<template>
  <div class="app">
    <header class="app-header">
      <div class="header-content">
        <div class="header-left">
          <span class="app-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M3 7l6 10l4 -7l3 5h5" />
            </svg>
          </span>
          <h1 class="app-title">Activity Map</h1>
        </div>
        <div class="header-right">
          <!-- Header slot: filled by individual views via <Teleport>. -->
        </div>
      </div>
    </header>
    <RouterView />
  </div>
</template>

<style>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-text);
}

.app-header {
  background: linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-600) 100%);
  color: var(--color-text-inverse);
  padding: 0 var(--space-4);
  box-shadow: var(--shadow-sm);
  z-index: var(--z-header);
  position: relative;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1400px;
  margin: 0 auto;
  height: var(--header-height);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.app-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.18);
}

.app-logo svg {
  width: 20px;
  height: 20px;
}

.app-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 700;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.error-banner {
  background: var(--color-danger);
  color: var(--color-text-inverse);
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.error-banner p {
  margin: 0;
}

.error-close {
  background: none;
  border: none;
  color: inherit;
  font-size: var(--font-size-2xl);
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.error-close:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
