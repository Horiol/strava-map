import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '../views/HomeView.vue'
import AuthCallback from '../views/AuthCallback.vue'


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      name: 'HomeView',
      component: HomeView,
    },
    {
      path: '/auth/callback',
      name: 'AuthCallback',
      component: AuthCallback,
    },
  ],
})

export default router
