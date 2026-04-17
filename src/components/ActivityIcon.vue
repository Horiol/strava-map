<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="activity-icon"
    :aria-label="type || 'activity'"
    role="img"
    v-html="iconMarkup"
  />
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { getActivityIcon } from '@/utils/activityStyle'

  interface Props {
    type: string | null | undefined
    size?: number | string
    color?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    size: 18,
    color: undefined,
  })

  const iconMarkup = computed(() => getActivityIcon(props.type))
</script>

<style scoped>
  .activity-icon {
    display: inline-block;
    flex-shrink: 0;
  }
</style>
