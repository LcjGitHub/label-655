<template>
  <div v-if="isLoggedIn" class="user-profile-panel">
    <div class="profile-header">
      <div class="user-avatar-large">
        <span>{{ userInitial }}</span>
      </div>
      <div class="user-info-main">
        <div class="user-row">
          <span class="username">{{ currentUser?.username }}</span>
          <LevelBadge
            :level="currentUser?.level || '新手'"
            :icon="currentUser?.level_info?.icon"
            :points="currentUser?.points"
          />
        </div>
        <p class="user-email">{{ currentUser?.email }}</p>
        <p class="user-join-date">加入于 {{ formatJoinDate }}</p>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-item points-stat">
        <div class="stat-icon">🏆</div>
        <div class="stat-content">
          <div class="stat-value">{{ currentUser?.points ?? 0 }}</div>
          <div class="stat-label">总积分</div>
        </div>
      </div>
      <div class="stat-item level-stat">
        <div class="stat-icon">{{ currentUser?.level_info?.icon || '🌱' }}</div>
        <div class="stat-content">
          <div class="stat-value">{{ currentUser?.level || '新手' }}</div>
          <div class="stat-label">当前等级</div>
        </div>
      </div>
      <div class="stat-item checkin-stat">
        <button
          class="checkin-btn"
          :class="{ 'checked-in': isCheckedIn, 'checking-in': checkingIn }"
          :disabled="isCheckedIn || checkingIn"
          @click="handleCheckIn"
        >
          <span v-if="checkingIn">签到中...</span>
          <span v-else-if="isCheckedIn">✓ 今日已签到</span>
          <span v-else>📅 每日签到 +2</span>
        </button>
      </div>
    </div>

    <div v-if="nextLevel" class="level-progress-section">
      <div class="level-progress-header">
        <span>距离下一等级「{{ nextLevel.name }} {{ nextLevel.icon }}」</span>
        <span class="progress-text">{{ progressToNext }}%</span>
      </div>
      <div class="level-progress-bar">
        <div class="level-progress-fill" :style="{ width: progressToNext + '%' }"></div>
      </div>
      <p class="level-progress-hint">
        还需 {{ nextLevel.minPoints - (currentUser?.points || 0) }} 积分升级
      </p>
    </div>
    <div v-else class="level-max-section">
      <p class="level-max-text">🎉 已达到最高等级！继续保持活跃吧~</p>
    </div>

    <div class="rules-section">
      <h4>💡 积分规则</h4>
      <ul>
        <li>📝 发表留言：<strong>+5 分</strong>（每日上限 50 分）</li>
        <li>👍 留言被点赞：<strong>+1 分</strong>（每个赞）</li>
        <li>📅 每日签到：<strong>+2 分</strong></li>
      </ul>
    </div>

    <p v-if="checkInMessage" class="checkin-message" :class="{ success: checkInSuccess }">
      {{ checkInMessage }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../store/auth.js'
import { checkIn } from '../utils/api.js'
import LevelBadge from './LevelBadge.vue'

const emit = defineEmits(['check-in-success'])
const authStore = useAuthStore()

const isLoggedIn = authStore.isLoggedIn
const currentUser = authStore.currentUser

const checkingIn = ref(false)
const checkInMessage = ref('')
const checkInSuccess = ref(false)

const userInitial = computed(() => {
  return currentUser.value?.username?.charAt(0)?.toUpperCase() || 'U'
})

const formatJoinDate = computed(() => {
  if (!currentUser.value?.created_at) return '未知'
  const date = new Date(currentUser.value.created_at)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const todayKey = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
})

const isCheckedIn = computed(() => {
  return currentUser.value?.last_checkin_date === todayKey.value
})

const nextLevel = computed(() => {
  return currentUser.value?.level_info?.nextLevel || null
})

const progressToNext = computed(() => {
  const points = currentUser.value?.points || 0
  const currentMin = currentUser.value?.level_info?.minPoints || 0
  const nextMin = nextLevel.value?.minPoints
  if (!nextMin) return 100
  const range = nextMin - currentMin
  if (range <= 0) return 100
  const progress = ((points - currentMin) / range) * 100
  return Math.min(Math.max(Math.round(progress), 0), 100)
})

const handleCheckIn = async () => {
  if (isCheckedIn.value || checkingIn.value) return

  checkingIn.value = true
  checkInMessage.value = ''
  checkInSuccess.value = false

  try {
    const response = await checkIn()
    const result = response.data
    if (result.checkedIn) {
      checkInSuccess.value = true
      checkInMessage.value = `🎉 签到成功！获得 ${result.earnedPoints} 积分`
      await authStore.refreshUserInfo()
      emit('check-in-success', result)
    } else {
      checkInMessage.value = result.message || '今日已签到'
    }
  } catch (err) {
    checkInMessage.value = err.response?.data?.error || '签到失败，请稍后重试'
    console.error('签到失败:', err)
  } finally {
    checkingIn.value = false
    setTimeout(() => {
      checkInMessage.value = ''
    }, 3000)
  }
}
</script>

<style scoped>
.user-profile-panel {
  background: linear-gradient(135deg, #f8f9ff 0%, #fff8f0 100%);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid #e8eaf0;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.user-avatar-large {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  font-weight: bold;
  flex-shrink: 0;
}

.user-info-main {
  flex: 1;
  min-width: 0;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.username {
  font-size: 1.2rem;
  font-weight: 700;
  color: #333;
}

.user-email {
  font-size: 0.85rem;
  color: #888;
  margin: 2px 0;
}

.user-join-date {
  font-size: 0.8rem;
  color: #aaa;
  margin: 0;
}

.stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 12px;
  margin-bottom: 20px;
}

.stat-item {
  background: white;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #eef0f5;
}

.stat-icon {
  font-size: 1.8rem;
  line-height: 1;
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 1.3rem;
  font-weight: 700;
  color: #333;
  line-height: 1.2;
}

.points-stat .stat-value {
  color: #f39c12;
}

.level-stat .stat-value {
  color: #667eea;
  font-size: 1rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #999;
  margin-top: 2px;
}

.checkin-btn {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
  color: white;
  border: none;
  padding: 14px 24px;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.checkin-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(39, 174, 96, 0.4);
}

.checkin-btn.checked-in {
  background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
  cursor: not-allowed;
  opacity: 0.8;
}

.checkin-btn.checking-in {
  opacity: 0.7;
  cursor: not-allowed;
}

.level-progress-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid #eef0f5;
}

.level-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 0.85rem;
  color: #666;
}

.progress-text {
  font-weight: 600;
  color: #667eea;
}

.level-progress-bar {
  width: 100%;
  height: 8px;
  background: #ecf0f1;
  border-radius: 4px;
  overflow: hidden;
}

.level-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.level-progress-hint {
  font-size: 0.8rem;
  color: #999;
  margin: 8px 0 0;
}

.level-max-section {
  background: linear-gradient(135deg, #fef5e7 0%, #fdedec 100%);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
  text-align: center;
}

.level-max-text {
  font-size: 0.9rem;
  color: #e67e22;
  margin: 0;
  font-weight: 500;
}

.rules-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #eef0f5;
}

.rules-section h4 {
  margin: 0 0 10px;
  font-size: 0.95rem;
  color: #555;
}

.rules-section ul {
  margin: 0;
  padding-left: 18px;
  font-size: 0.85rem;
  color: #666;
  line-height: 1.8;
}

.rules-section strong {
  color: #667eea;
}

.checkin-message {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
  text-align: center;
  background: #fff3cd;
  color: #856404;
}

.checkin-message.success {
  background: #d4edda;
  color: #155724;
}

@media (max-width: 600px) {
  .user-profile-panel {
    padding: 16px;
  }

  .stats-row {
    grid-template-columns: 1fr 1fr;
  }

  .checkin-stat {
    grid-column: span 2;
  }

  .checkin-btn {
    width: 100%;
  }
}
</style>
