<template>
  <div class="notification-center">
    <div class="center-header">
      <div class="header-left">
        <h1>🔔 通知中心</h1>
        <p class="subtitle">管理所有系统通知</p>
      </div>
      <div class="header-actions">
        <button v-if="unreadCount > 0" class="action-btn mark-all" @click="handleMarkAllRead" :disabled="loading">
          ✓ 全部标记已读
        </button>
        <button class="action-btn secondary" @click="goBack">返回</button>
      </div>
    </div>

    <div class="center-content">
      <div class="filter-tabs">
        <button
          v-for="tab in filterTabs"
          :key="tab.value"
          class="filter-tab"
          :class="{ active: currentFilter === tab.value }"
          @click="switchFilter(tab.value)"
        >
          {{ tab.label }}
          <span v-if="tab.count !== undefined" class="tab-count">({{ tab.count }})</span>
        </button>
      </div>

      <div class="notification-container">
        <div v-if="loading" class="loading">
          <div class="spinner"></div>
          <p>加载中...</p>
        </div>

        <div v-else-if="error" class="error-box">
          <p>😢 {{ error }}</p>
          <button @click="fetchNotifications" class="retry-btn">重试</button>
        </div>

        <div v-else-if="notifications.length === 0" class="empty-state">
          <div class="empty-icon">📭</div>
          <p class="empty-text">暂无通知</p>
        </div>

        <div v-else class="notification-list">
          <div
            v-for="notification in notifications"
            :key="notification.id"
            class="notification-card"
            :class="{ unread: notification.is_read === 0 }"
            @click="handleNotificationClick(notification)"
          >
            <div class="card-left">
              <div class="notification-icon">
                <svg v-if="notification.type === 'new_message'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
            </div>
            <div class="card-content">
              <div class="card-header">
                <span class="type-badge" :class="notification.type">
                  {{ getTypeLabel(notification.type) }}
                </span>
                <span v-if="notification.is_read === 0" class="unread-badge">未读</span>
              </div>
              <div class="notification-text">{{ notification.content }}</div>
              <div class="notification-meta">
                <span class="meta-time">{{ formatTime(notification.created_at) }}</span>
                <span v-if="notification.message_id" class="meta-link">点击查看相关留言 →</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="pagination.totalPages > 1" class="pagination">
        <button
          class="page-btn"
          :disabled="!pagination.hasPrev || loading"
          @click="changePage(pagination.currentPage - 1)"
        >
          上一页
        </button>
        <span class="page-info">
          第 {{ pagination.currentPage }} / {{ pagination.totalPages }} 页
          （共 {{ pagination.total }} 条）
        </span>
        <button
          class="page-btn"
          :disabled="!pagination.hasNext || loading"
          @click="changePage(pagination.currentPage + 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../utils/api.js'

const router = useRouter()

const notifications = ref([])
const loading = ref(false)
const error = ref('')
const currentFilter = ref(null)
const unreadCount = ref(0)
let pollTimer = null

const pagination = reactive({
  currentPage: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false
})

const filterTabs = computed(() => [
  { label: '全部', value: null },
  { label: '未读', value: false, count: unreadCount.value },
  { label: '已读', value: true }
])

const getTypeLabel = (type) => {
  const map = {
    new_message: '新留言'
  }
  return map[type] || type
}

const formatTime = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const fetchUnreadCount = async () => {
  try {
    const response = await getUnreadNotificationCount()
    unreadCount.value = response.data.unreadCount
  } catch (err) {
    console.error('获取未读数失败:', err)
  }
}

const fetchNotifications = async (page = 1) => {
  loading.value = true
  error.value = ''
  try {
    const response = await getNotifications(page, pagination.pageSize, currentFilter.value)
    notifications.value = response.data.notifications
    Object.assign(pagination, response.data.pagination)
  } catch (err) {
    error.value = '获取通知列表失败，请稍后重试'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const switchFilter = (filter) => {
  currentFilter.value = filter
  fetchNotifications(1)
}

const changePage = (page) => {
  fetchNotifications(page)
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
  if (notification.message_id) {
    router.push(`/admin/dashboard?messageId=${notification.message_id}`)
  }
}

const handleMarkAllRead = async () => {
  if (!confirm('确定要将所有通知标记为已读吗？')) return
  try {
    const response = await markAllNotificationsAsRead()
    alert(response.data.message)
    notifications.value.forEach(n => n.is_read = 1)
    unreadCount.value = 0
  } catch (err) {
    alert(err.response?.data?.error || '操作失败')
  }
}

const goBack = () => {
  router.back()
}

const startPolling = () => {
  stopPolling()
  pollTimer = setInterval(fetchUnreadCount, 30000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(() => {
  document.body.classList.add('admin-page-body')
  const appEl = document.getElementById('app')
  if (appEl) appEl.classList.add('admin-page-app')
  fetchUnreadCount()
  fetchNotifications(1)
  startPolling()
})

onUnmounted(() => {
  document.body.classList.remove('admin-page-body')
  const appEl = document.getElementById('app')
  if (appEl) appEl.classList.remove('admin-page-app')
  stopPolling()
})
</script>

<style scoped>
.notification-center {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 0;
  margin: 0;
  border-radius: 0;
  max-width: 100%;
}

.center-header {
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  color: white;
  padding: 25px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.header-left h1 {
  margin: 0 0 5px 0;
  font-size: 1.6rem;
}

.subtitle {
  margin: 0;
  opacity: 0.85;
  font-size: 0.95rem;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.mark-all {
  background: #27ae60;
  color: white;
}

.action-btn.mark-all:hover:not(:disabled) {
  background: #229954;
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.action-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.25);
}

.center-content {
  padding: 25px 30px;
  max-width: 900px;
  margin: 0 auto;
}

.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  background: white;
  padding: 8px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.filter-tab {
  padding: 10px 20px;
  border: none;
  background: transparent;
  color: #7f8c8d;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.filter-tab:hover {
  background: #ecf0f1;
}

.filter-tab.active {
  background: #3498db;
  color: white;
}

.tab-count {
  font-size: 0.8rem;
  opacity: 0.85;
}

.notification-container {
  min-height: 200px;
}

.loading,
.error-box,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.empty-text {
  color: #999;
  font-size: 1rem;
  margin: 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #ecf0f1;
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 10px 25px;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 15px;
  font-size: 0.9rem;
}

.retry-btn:hover {
  background: #2980b9;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notification-card {
  background: white;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  gap: 16px;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 4px solid transparent;
}

.notification-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.notification-card.unread {
  background: #f0f7ff;
  border-left-color: #3498db;
}

.card-left {
  flex-shrink: 0;
}

.notification-icon {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification-icon svg {
  width: 22px;
  height: 22px;
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.type-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.type-badge.new_message {
  background: #e3f2fd;
  color: #1565c0;
}

.unread-badge {
  display: inline-block;
  padding: 3px 8px;
  background: #e74c3c;
  color: white;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
}

.notification-text {
  color: #333;
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 8px;
}

.notification-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
}

.meta-time {
  color: #999;
}

.meta-link {
  color: #3498db;
  font-weight: 500;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  padding: 25px 0;
}

.page-btn {
  padding: 8px 20px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  color: #555;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f0f0f0;
  border-color: #bbb;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #666;
  font-size: 0.9rem;
}
</style>
