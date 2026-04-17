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
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : ariaLabel"
    :aria-hidden="decorative ? 'true' : undefined"
    focusable="false"
  >
    <path v-for="d in paths" :key="d" :d="d" />
  </svg>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { getActivityIconPaths } from '@/utils/activityStyle'

  interface Props {
    type: string | null | undefined
    size?: number | string
    color?: string
    /**
     * When true, the icon is hidden from assistive technologies with
     * `aria-hidden`. Use for icons that sit next to labeled text (e.g.
     * inside a badge with an adjacent activity name) so screen readers
     * don't announce them twice.
     */
    decorative?: boolean
    /**
     * Override the accessible name used when `decorative` is false.
     * Defaults to `type` (or "activity" if type is empty).
     */
    label?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    size: 18,
    color: undefined,
    decorative: false,
    label: undefined,
  })

  const paths = computed(() => getActivityIconPaths(props.type))
  const ariaLabel = computed(() => props.label ?? props.type ?? 'activity')
</script>

<style scoped>
  .activity-icon {
    display: inline-block;
    flex-shrink: 0;
  }
</style>
