import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useMapStore = defineStore('map', () => {
  const showMarkers = ref(false)

  function toggleMarkers() {
    showMarkers.value = !showMarkers.value
  }

  return { showMarkers, toggleMarkers }
})
