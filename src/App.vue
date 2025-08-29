
<template>
  <div class="app">
    <!-- Header -->
    <header class="app-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="app-title">
              Activity Map
          </h1>
        </div>
        <div class="header-right">
          <!-- Header content will be provided by individual views -->
        </div>
      </div>
    </header>
    <RouterView/>
  </div>
</template>

<style>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-header {
  background: #fc4c02;
  color: white;
  padding: 0 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1400px;
  margin: 0 auto;
  height: 60px;
}

.header-left {
  display: flex;
  align-items: center;
}

.app-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.strava-icon {
  font-size: 1.8rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.error-banner {
  background: #dc3545;
  color: white;
  padding: 1rem;
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
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
