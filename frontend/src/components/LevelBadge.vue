<template>
  <span
    class="level-badge"
    :style="{ background: badgeColor, color: textColor }"
    :title="tooltipText"
  >
    <span class="level-icon">{{ icon }}</span>
    <span class="level-name">{{ levelName }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  level: {
    type: String,
    default: '新手'
  },
  icon: {
    type: String,
    default: '🌱'
  },
  color: {
    type: String,
    default: '#95a5a6'
  },
  points: {
    type: Number,
    default: null
  },
  size: {
    type: String,
    default: 'normal'
  }
})

const levelColors = {
  '新手': { bg: '#ecf0f1', text: '#7f8c8d', border: '#bdc3c7' },
  '活跃用户': { bg: '#e8f8f0', text: '#27ae60', border: '#2ecc71' },
  '达人': { bg: '#fef5e7', text: '#f39c12', border: '#f1c40f' },
  '专家': { bg: '#fdedec', text: '#e74c3c', border: '#ec7063' }
}

const badgeColor = computed(() => {
  if (props.color && levelColors[props.level]) {
    return levelColors[props.level].bg
  }
  return '#ecf0f1'
})

const textColor = computed(() => {
  if (levelColors[props.level]) {
    return levelColors[props.level].text
  }
  return '#7f8c8d'
})

const tooltipText = computed(() => {
  if (props.points !== null) {
    return `${props.level} · ${props.points} 积分`
  }
  return props.level
})

const levelName = computed(() => props.level)
</script>

<style scoped>
.level-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid;
  vertical-align: middle;
  line-height: 1.4;
}

.level-icon {
  font-size: 0.8rem;
  line-height: 1;
}

.level-name {
  white-space: nowrap;
}
</style>
