<template>
  <div class="stats-panel">
    <div class="stats-header">
      <h2 class="stats-title">数据统计</h2>
      <button
        class="refresh-btn"
        :disabled="loading"
        @click="handleRefresh"
      >
        <span :class="{ 'spin': loading }">↻</span>
        {{ loading ? '刷新中...' : '刷新' }}
      </button>
    </div>

    <div v-if="error" class="stats-error">
      {{ error }}
      <button class="retry-btn" @click="fetchStats">重试</button>
    </div>

    <div v-else-if="!loading && stats" class="stats-content">
      <div class="stats-cards">
        <div class="stat-card stat-card-primary">
          <div class="stat-label">总留言数</div>
          <div class="stat-value">{{ stats.totalMessages }}</div>
        </div>
        <div class="stat-card stat-card-success">
          <div class="stat-label">今日新增</div>
          <div class="stat-value">{{ stats.todayMessages }}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stats-section">
          <h3 class="section-title">近 7 天留言趋势</h3>
          <div class="bar-chart">
            <div
              v-for="(day, index) in stats.last7Days"
              :key="index"
              class="bar-item"
            >
              <div class="bar-wrapper">
                <div
                  class="bar"
                  :style="{ height: getBarHeight(day.count) + '%' }"
                ></div>
              </div>
              <div class="bar-label">{{ day.label }}</div>
              <div class="bar-count">{{ day.count }}</div>
            </div>
          </div>
        </div>

        <div class="stats-section">
          <h3 class="section-title">最活跃用户</h3>
          <div v-if="stats.topUsers.length === 0" class="empty-tip">
            暂无数据
          </div>
          <ol v-else class="leaderboard">
            <li
              v-for="(user, index) in stats.topUsers"
              :key="index"
              class="leaderboard-item"
            >
              <span class="rank" :class="'rank-' + (index + 1)">{{ index + 1 }}</span>
              <span class="username">{{ user.username }}</span>
              <span class="count">{{ user.count }} 条</span>
            </li>
          </ol>
        </div>
      </div>

      <div class="stats-section full-width">
        <h3 class="section-title">留言时间分布（24 小时）</h3>
        <div class="heatmap">
          <div
            v-for="(count, hour) in stats.hourlyDistribution"
            :key="hour"
            class="heatmap-cell"
            :style="{ backgroundColor: getHeatmapColor(count) }"
            :title="`${hour}:00 - ${hour}:59 共 ${count} 条留言`"
          >
            <span class="heatmap-hour">{{ hour }}</span>
          </div>
        </div>
        <div class="heatmap-legend">
          <span>少</span>
          <div class="legend-gradient"></div>
          <span>多</span>
        </div>
      </div>
    </div>

    <div v-else-if="loading" class="stats-loading">
      加载中...
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { getStats } from '../utils/api.js'

const stats = ref(null)
const loading = ref(false)
const error = ref('')

let autoRefreshTimer = null

const maxBarCount = computed(() => {
  if (!stats.value) return 1
  const counts = stats.value.last7Days.map(d => d.count)
  return Math.max(1, ...counts)
})

const maxHourlyCount = computed(() => {
  if (!stats.value) return 1
  return Math.max(1, ...stats.value.hourlyDistribution)
})

const fetchStats = async (forceRefresh = false) => {
  loading.value = true
  error.value = ''
  try {
    const response = await getStats(forceRefresh)
    stats.value = response.data.stats
  } catch (err) {
    error.value = '获取统计数据失败，请稍后重试'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const handleRefresh = () => {
  fetchStats(true)
}

const getBarHeight = (count) => {
  if (maxBarCount.value === 0) return 0
  return Math.max(5, (count / maxBarCount.value) * 100)
}

const getHeatmapColor = (count) => {
  if (count === 0) return '#f3f4f6'
  const ratio = count / maxHourlyCount.value
  const r = Math.round(59 + (99 - 59) * (1 - ratio))
  const g = Math.round(130 + (102 - 130) * (1 - ratio))
  const b = Math.round(246 + (241 - 246) * (1 - ratio))
  return `rgb(${r}, ${g}, ${b})`
}

const startAutoRefresh = () => {
  autoRefreshTimer = setInterval(() => {
    fetchStats(false)
  }, 60 * 60 * 1000)
}

onMounted(() => {
  fetchStats()
  startAutoRefresh()
})

onUnmounted(() => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
})
</script>

<style scoped>
.stats-panel {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.stats-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #2563eb;
}

.refresh-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.refresh-btn .spin {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.stats-error {
  padding: 16px;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.retry-btn {
  padding: 6px 12px;
  background: #dc2626;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.retry-btn:hover {
  background: #b91c1c;
}

.stats-loading {
  text-align: center;
  padding: 40px;
  color: #6b7280;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  padding: 20px;
  border-radius: 10px;
  text-align: center;
}

.stat-card-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.stat-card-success {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: #fff;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stats-section {
  background: #f9fafb;
  border-radius: 10px;
  padding: 18px;
}

.stats-section.full-width {
  grid-column: 1 / -1;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 15px;
  font-weight: 600;
  color: #374151;
}

.empty-tip {
  text-align: center;
  padding: 30px;
  color: #9ca3af;
  font-size: 14px;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 180px;
  gap: 8px;
}

.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.bar-wrapper {
  width: 100%;
  height: 140px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 70%;
  max-width: 36px;
  background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%);
  border-radius: 4px 4px 0 0;
  min-height: 2px;
  transition: height 0.3s ease;
}

.bar-label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 8px;
}

.bar-count {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  margin-top: 2px;
}

.leaderboard {
  list-style: none;
  padding: 0;
  margin: 0;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: #fff;
  border-radius: 6px;
  margin-bottom: 8px;
  transition: background 0.2s;
}

.leaderboard-item:last-child {
  margin-bottom: 0;
}

.leaderboard-item:hover {
  background: #f0f9ff;
}

.rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  margin-right: 12px;
  background: #e5e7eb;
  color: #6b7280;
}

.rank-1 {
  background: #fbbf24;
  color: #fff;
}

.rank-2 {
  background: #9ca3af;
  color: #fff;
}

.rank-3 {
  background: #d97706;
  color: #fff;
}

.username {
  flex: 1;
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  font-size: 13px;
  color: #6b7280;
  font-weight: 600;
}

.heatmap {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 4px;
  margin-bottom: 12px;
}

.heatmap-cell {
  aspect-ratio: 1;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  transition: transform 0.15s;
  min-height: 32px;
}

.heatmap-cell:hover {
  transform: scale(1.1);
  z-index: 1;
}

.heatmap-hour {
  font-size: 11px;
  font-weight: 500;
  color: rgba(31, 41, 55, 0.7);
}

.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}

.legend-gradient {
  width: 120px;
  height: 12px;
  border-radius: 3px;
  background: linear-gradient(90deg, #f3f4f6 0%, #3b82f6 50%, #1e3a8a 100%);
}

@media (max-width: 640px) {
  .stats-panel {
    padding: 16px;
  }

  .stat-value {
    font-size: 28px;
  }

  .heatmap {
    grid-template-columns: repeat(8, 1fr);
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
