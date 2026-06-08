<template>
  <div class="notification-bell-wrapper" v-if="isAdminLoggedIn" ref="bellWrapperRef">
    <button class="bell-btn" @click="toggleDropdown" :class="{ active: showDropdown }">
      <svg class="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span v-if="unreadCount > 0" class="badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <transition name="dropdown">
      <div v-if="showDropdown" class="notification-dropdown">
        <div class="dropdown-header">
          <span class="header-title">通知中心</span>
          <button v-if="unreadCount > 0" class="mark-all-btn" @click="handleMarkAllRead">
            全部已读
          </button>
        </div>

        <div class="notification-list">
          <div v-if="loading" class="loading-state">
            <div class="spinner-sm"></div>
            <span>加载中...</span>
          </div>

          <div v-else-if="notifications.length === 0" class="empty-state">
            <span>暂无通知</span>
          </div>

          <div
            v-for="notification in notifications"
            :key="notification.id"
            class="notification-item"
            :class="{ unread: notification.is_read === 0 }"
            @click="handleNotificationClick(notification)"
          >
            <div class="notification-icon">
              <svg v-if="notification.type === 'new_message'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div class="notification-content">
              <div class="notification-text">{{ notification.content }}</div>
              <div class="notification-time">{{ formatTime(notification.created_at) }}</div>
            </div>
            <div v-if="notification.is_read === 0" class="unread-dot"></div>
          </div>
        </div>

        <div class="dropdown-footer">
          <router-link to="/admin/notifications" class="view-all-link" @click="showDropdown = false">
            查看全部 →
          </router-link>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../store/admin.js'
import { getRecentNotifications, getUnreadNotificationCount, markNotificationAsRead, markAllNotificationsAsRead } from '../utils/api.js'

const router = useRouter()
const adminStore = useAdminStore()
const isAdminLoggedIn = adminStore.isLoggedIn

const bellWrapperRef = ref(null)
const showDropdown = ref(false)
const notifications = ref([])
const unreadCount = ref(0)
const loading = ref(false)
let pollTimer = null

const POLL_INTERVAL = 30000

const fetchUnreadCount = async () => {
  if (!isAdminLoggedIn.value) return
  try {
    const response = await getUnreadNotificationCount()
    unreadCount.value = response.data.unreadCount
  } catch (err) {
    console.error('获取未读通知数失败:', err)
  }
}

const fetchRecentNotifications = async () => {
  if (!isAdminLoggedIn.value) return
  loading.value = true
  try {
    const response = await getRecentNotifications()
    notifications.value = response.data.notifications
  } catch (err) {
    console.error('获取最近通知失败:', err)
  } finally {
    loading.value = false
  }
}

const toggleDropdown = async () => {
  showDropdown.value = !showDropdown.value
  if (showDropdown.value) {
    await fetchRecentNotifications()
  }
}

const handleDocumentClick = (e) => {
  if (bellWrapperRef.value && !bellWrapperRef.value.contains(e.target)) {
    showDropdown.value = false
  }
}

const formatTime = (dateStr) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const handleNotificationClick = async (notification) => {
  if (notification.is_read === 0) {
    try {
      await markNotificationAsRead(notification.id)
      notification.is_read = 1
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    } catch (err) {
      console.error('标记已读失败:', err)
    }
  }
  showDropdown.value = false
  if (notification.message_id) {
    router.push(`/admin/dashboard?messageId=${notification.message_id}`)
  } else {
    router.push('/admin/notifications')
  }
}

const handleMarkAllRead = async () => {
  try {
    await markAllNotificationsAsRead()
    notifications.value.forEach(n => n.is_read = 1)
    unreadCount.value = 0
  } catch (err) {
    console.error('标记全部已读失败:', err)
  }
}

const pollTick = async () => {
  if (!isAdminLoggedIn.value) return
  try {
    if (showDropdown.value) {
      const [countResp, listResp] = await Promise.all([
        getUnreadNotificationCount(),
        getRecentNotifications()
      ])
      unreadCount.value = countResp.data.unreadCount
      notifications.value = listResp.data.notifications
    } else {
      const response = await getUnreadNotificationCount()
      unreadCount.value = response.data.unreadCount
    }
  } catch (err) {
    console.error('轮询获取通知失败:', err)
  }
}

const startPolling = () => {
  stopPolling()
  pollTimer = setInterval(pollTick, POLL_INTERVAL)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

watch(isAdminLoggedIn, (val) => {
  if (val) {
    fetchUnreadCount()
    startPolling()
  } else {
    stopPolling()
    unreadCount.value = 0
    notifications.value = []
    showDropdown.value = false
  }
})

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  if (isAdminLoggedIn.value) {
    fetchUnreadCount()
    startPolling()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  stopPolling()
})
</script>

<style scoped>
.notification-bell-wrapper {
  position: relative;
  display: inline-block;
}

.bell-btn {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  color: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.bell-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #333;
}

.bell-btn.active {
  background: rgba(52, 152, 219, 0.1);
  color: #3498db;
}

.bell-icon {
  width: 22px;
  height: 22px;
}

.badge {
  position: absolute;
  top: 0;
  right: 0;
  background: #e74c3c;
  color: white;
  font-size: 10px;
  font-weight: bold;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.notification-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 360px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 500px;
}

.dropdown-header {
  padding: 14px 18px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafbfc;
}

.header-title {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.95rem;
}

.mark-all-btn {
  background: none;
  border: none;
  color: #3498db;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.mark-all-btn:hover {
  background: rgba(52, 152, 219, 0.1);
}

.notification-list {
  flex: 1;
  overflow-y: auto;
  max-height: 380px;
}

.loading-state,
.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #999;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.spinner-sm {
  width: 24px;
  height: 24px;
  border: 3px solid #ecf0f1;
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.notification-item {
  padding: 14px 18px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
  transition: background 0.2s;
  position: relative;
}

.notification-item:hover {
  background: #f8f9fa;
}

.notification-item.unread {
  background: #f0f7ff;
}

.notification-item.unread:hover {
  background: #e5f1ff;
}

.notification-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notification-icon svg {
  width: 18px;
  height: 18px;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-text {
  color: #333;
  font-size: 0.9rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-time {
  color: #999;
  font-size: 0.75rem;
  margin-top: 4px;
}

.unread-dot {
  width: 8px;
  height: 8px;
  background: #3498db;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
}

.dropdown-footer {
  padding: 12px 18px;
  border-top: 1px solid #f0f0f0;
  text-align: center;
  background: #fafbfc;
}

.view-all-link {
  color: #3498db;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: color 0.2s;
}

.view-all-link:hover {
  color: #2980b9;
}
</style>
