<template>
  <div class="admin-dashboard">
    <div class="dashboard-header">
      <div class="header-left">
        <h1>🛡️ 管理控制台</h1>
        <p class="welcome">欢迎，{{ currentAdmin?.username }}</p>
      </div>
      <div class="header-actions">
        <div class="bell-wrapper">
          <NotificationBell />
        </div>
        <button class="action-btn secondary" @click="goHome">返回首页</button>
        <button class="action-btn logout" @click="handleLogout">退出登录</button>
      </div>
    </div>

    <div class="dashboard-content">
      <div class="stats-bar">
        <div class="stat-card pending">
          <span class="stat-label">待审核</span>
          <span class="stat-value">{{ stats.pending }}</span>
        </div>
        <div class="stat-card approved">
          <span class="stat-label">已通过</span>
          <span class="stat-value">{{ stats.approved }}</span>
        </div>
        <div class="stat-card rejected">
          <span class="stat-label">已拒绝</span>
          <span class="stat-value">{{ stats.rejected }}</span>
        </div>
        <div class="stat-card deleted">
          <span class="stat-label">已删除</span>
          <span class="stat-value">{{ stats.deleted }}</span>
        </div>
      </div>

      <div class="toolbar">
        <div class="filter-group">
          <button
            v-for="tab in statusTabs"
            :key="tab.value"
            class="filter-tab"
            :class="{ active: currentStatus === tab.value }"
            @click="switchStatus(tab.value)"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="batch-actions" v-if="selectedIds.length > 0">
          <span class="selected-count">已选择 {{ selectedIds.length }} 条</span>
          <button class="batch-btn approve" @click="handleBatchReview('approved')" :disabled="loading">
            ✓ 批量通过
          </button>
          <button class="batch-btn reject" @click="handleBatchReview('rejected')" :disabled="loading">
            ✕ 批量拒绝
          </button>
          <button class="batch-btn delete" @click="handleBatchDelete" :disabled="loading">
            🗑️ 批量删除
          </button>
          <button class="batch-btn clear" @click="clearSelection">清除选择</button>
        </div>
      </div>

      <div class="messages-table-container">
        <div v-if="loading" class="loading">
          <div class="spinner"></div>
          <p>加载中...</p>
        </div>

        <div v-else-if="error" class="error-box">
          <p>😢 {{ error }}</p>
          <button @click="fetchMessages" class="retry-btn">重试</button>
        </div>

        <table v-else class="messages-table">
          <thead>
            <tr>
              <th class="col-check">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  @change="toggleSelectAll"
                  :disabled="messages.length === 0"
                />
              </th>
              <th class="col-id">ID</th>
              <th class="col-user">用户</th>
              <th class="col-content">内容</th>
              <th class="col-status">状态</th>
              <th class="col-time">时间</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="messages.length === 0">
              <td colspan="7" class="empty-row">暂无留言</td>
            </tr>
            <tr
              v-for="msg in messages"
              :key="msg.id"
              :id="`message-row-${msg.id}`"
              :class="{ deleted: msg.is_deleted, highlighted: highlightedMessageId === msg.id }"
            >
              <td class="col-check">
                <input
                  type="checkbox"
                  :checked="selectedIds.includes(msg.id)"
                  @change="toggleSelection(msg.id)"
                />
              </td>
              <td class="col-id">{{ msg.id }}</td>
              <td class="col-user">
                <div class="user-cell">
                  <span class="avatar-sm">{{ getAvatar(msg.username) }}</span>
                  <span class="username">{{ msg.username }}</span>
                </div>
              </td>
              <td class="col-content">
                <div class="content-text" :title="stripHtml(msg.content)">{{ stripHtml(msg.content) }}</div>
                <div class="content-badges">
                  <span v-if="msg.is_pinned === 1" class="pinned-badge">📌 已置顶</span>
                  <span v-if="msg.is_deleted" class="deleted-badge">已删除</span>
                </div>
              </td>
              <td class="col-status">
                <span class="status-badge" :class="msg.is_deleted ? 'deleted' : msg.status">
                  {{ getStatusText(msg.status, msg.is_deleted) }}
                </span>
              </td>
              <td class="col-time">{{ formatTime(msg.created_at) }}</td>
              <td class="col-actions">
                <div class="action-buttons">
                  <button
                    v-if="!msg.is_deleted && msg.is_pinned !== 1"
                    class="row-btn pin"
                    @click="handlePin(msg.id)"
                    :disabled="loading"
                    title="置顶"
                  >
                    📌
                  </button>
                  <button
                    v-if="!msg.is_deleted && msg.is_pinned === 1"
                    class="row-btn unpin"
                    @click="handleUnpin(msg.id)"
                    :disabled="loading"
                    title="取消置顶"
                  >
                    📍
                  </button>
                  <button
                    class="row-btn approve"
                    @click="handleReview(msg.id, 'approved')"
                    :disabled="loading || msg.is_deleted"
                    :class="{ active: msg.status === 'approved' }"
                    title="通过"
                  >
                    ✓
                  </button>
                  <button
                    class="row-btn reject"
                    @click="handleReview(msg.id, 'rejected')"
                    :disabled="loading || msg.is_deleted"
                    :class="{ active: msg.status === 'rejected' }"
                    title="拒绝"
                  >
                    ✕
                  </button>
                  <button
                    v-if="!msg.is_deleted"
                    class="row-btn delete"
                    @click="handleDelete(msg.id)"
                    :disabled="loading"
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  getAdminStats,
  getAdminMessages,
  reviewMessage,
  deleteMessage,
  batchReviewMessages,
  batchDeleteMessages,
  pinMessage,
  unpinMessage
} from '../utils/api.js'
import { useAdminStore } from '../store/admin.js'
import { stripHtml } from '../utils/sanitize.js'
import NotificationBell from '../components/NotificationBell.vue'

const router = useRouter()
const route = useRoute()
const adminStore = useAdminStore()
const currentAdmin = computed(() => adminStore.currentAdmin.value)

const messages = ref([])
const loading = ref(false)
const error = ref('')
const selectedIds = ref([])
const currentStatus = ref(null)
const highlightedMessageId = ref(null)
let highlightTimer = null

const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false
})

const stats = reactive({
  pending: 0,
  approved: 0,
  rejected: 0,
  deleted: 0
})

const statusTabs = [
  { label: '全部', value: null },
  { label: '待审核', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
  { label: '已删除', value: 'deleted' }
]

const isAllSelected = computed(() => {
  if (messages.value.length === 0) return false
  return messages.value.every(m => selectedIds.value.includes(m.id))
})

const getAvatar = (username) => {
  return username ? username.charAt(0).toUpperCase() : '?'
}

const getStatusText = (status, isDeleted) => {
  if (isDeleted) return '已删除'
  const map = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝'
  }
  return map[status] || status
}

const formatTime = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const fetchStats = async () => {
  try {
    const response = await getAdminStats()
    Object.assign(stats, response.data.stats)
  } catch (err) {
    console.error('获取统计失败:', err)
  }
}

const fetchMessages = async (page = 1) => {
  loading.value = true
  error.value = ''
  selectedIds.value = []
  try {
    const response = await getAdminMessages(page, pagination.pageSize, currentStatus.value)
    messages.value = response.data.messages
    Object.assign(pagination, response.data.pagination)
    await nextTick()
    locateTargetMessage(response.data)
  } catch (err) {
    error.value = '获取留言列表失败，请稍后重试'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const locateTargetMessage = (data) => {
  const rawId = route.query.messageId
  if (!rawId) return
  const targetId = parseInt(rawId)
  if (isNaN(targetId) || targetId <= 0) return

  const found = messages.value.find(m => m.id === targetId)
  if (found) {
    scrollAndHighlight(targetId)
    return
  }

  const totalPages = data?.pagination?.totalPages || pagination.totalPages
  const total = data?.pagination?.total || pagination.total
  const pageSize = pagination.pageSize
  if (!total || !pageSize) return

  const targetIndex = messagesSortedIndex(targetId, data)
  if (targetIndex === -1) return
  const targetPage = Math.floor(targetIndex / pageSize) + 1
  if (targetPage >= 1 && targetPage <= totalPages && targetPage !== pagination.currentPage) {
    currentStatus.value = null
    fetchMessages(targetPage)
  }
}

const messagesSortedIndex = (targetId, data) => {
  const allIds = data?.messages?.map(m => m.id) || messages.value.map(m => m.id)
  return allIds.indexOf(targetId)
}

const scrollAndHighlight = (msgId) => {
  if (highlightTimer) {
    clearTimeout(highlightTimer)
    highlightTimer = null
  }
  highlightedMessageId.value = msgId
  const el = document.getElementById(`message-row-${msgId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  highlightTimer = setTimeout(() => {
    highlightedMessageId.value = null
  }, 4000)
}

const switchStatus = (status) => {
  currentStatus.value = status
  fetchMessages(1)
}

const changePage = (page) => {
  fetchMessages(page)
}

const toggleSelection = (id) => {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = messages.value.map(m => m.id)
  }
}

const clearSelection = () => {
  selectedIds.value = []
}

const handleReview = async (id, status) => {
  const action = status === 'approved' ? '通过' : '拒绝'
  if (!confirm(`确定要${action}这条留言吗？`)) return

  try {
    await reviewMessage(id, status)
    alert(`已${action}`)
    fetchMessages(pagination.currentPage)
    fetchStats()
  } catch (err) {
    alert(err.response?.data?.error || '操作失败')
  }
}

const handleDelete = async (id) => {
  if (!confirm('确定要删除这条留言吗？删除后前台将不再显示，但数据库保留记录。')) return

  try {
    await deleteMessage(id)
    alert('已删除')
    fetchMessages(pagination.currentPage)
    fetchStats()
  } catch (err) {
    alert(err.response?.data?.error || '删除失败')
  }
}

const handlePin = async (id) => {
  if (!confirm('确定要将这条留言置顶吗？')) return

  try {
    await pinMessage(id)
    alert('已置顶')
    fetchMessages(pagination.currentPage)
  } catch (err) {
    alert(err.response?.data?.error || '置顶失败')
  }
}

const handleUnpin = async (id) => {
  if (!confirm('确定要取消这条留言的置顶吗？')) return

  try {
    await unpinMessage(id)
    alert('已取消置顶')
    fetchMessages(pagination.currentPage)
  } catch (err) {
    alert(err.response?.data?.error || '取消置顶失败')
  }
}

const handleBatchReview = async (status) => {
  const action = status === 'approved' ? '通过' : '拒绝'
  if (!confirm(`确定要${action}选中的 ${selectedIds.value.length} 条留言吗？`)) return

  try {
    const response = await batchReviewMessages([...selectedIds.value], status)
    alert(response.data.message)
    fetchMessages(pagination.currentPage)
    fetchStats()
  } catch (err) {
    alert(err.response?.data?.error || '批量操作失败')
  }
}

const handleBatchDelete = async () => {
  if (!confirm(`确定要删除选中的 ${selectedIds.value.length} 条留言吗？删除后前台将不再显示，但数据库保留记录。`)) return

  try {
    const response = await batchDeleteMessages([...selectedIds.value])
    alert(response.data.message)
    fetchMessages(pagination.currentPage)
    fetchStats()
  } catch (err) {
    alert(err.response?.data?.error || '批量删除失败')
  }
}

const handleLogout = () => {
  if (!confirm('确定要退出登录吗？')) return
  adminStore.clearAuth()
  router.push('/admin/login')
}

const goHome = () => {
  router.push('/')
}

onMounted(() => {
  document.body.classList.add('admin-page-body')
  const appEl = document.getElementById('app')
  if (appEl) appEl.classList.add('admin-page-app')
  fetchMessages(1)
  fetchStats()
})

watch(() => route.query.messageId, (newVal) => {
  if (newVal) {
    const targetId = parseInt(newVal)
    if (!isNaN(targetId) && targetId > 0) {
      const found = messages.value.find(m => m.id === targetId)
      if (found) {
        scrollAndHighlight(targetId)
      } else {
        currentStatus.value = null
        fetchMessages(1)
      }
    }
  }
})

onUnmounted(() => {
  document.body.classList.remove('admin-page-body')
  const appEl = document.getElementById('app')
  if (appEl) appEl.classList.remove('admin-page-app')
  if (highlightTimer) {
    clearTimeout(highlightTimer)
    highlightTimer = null
  }
})
</script>

<style scoped>
.admin-dashboard {
  padding: 0;
  min-height: 100vh;
  background: #f5f7fa;
  border-radius: 0;
  margin: 0;
  max-width: 100%;
}

.dashboard-header {
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

.welcome {
  margin: 0;
  opacity: 0.85;
  font-size: 0.95rem;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.bell-wrapper {
  display: flex;
  align-items: center;
}

.bell-wrapper :deep(.bell-btn) {
  color: rgba(255, 255, 255, 0.9);
}

.bell-wrapper :deep(.bell-btn:hover) {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.bell-wrapper :deep(.bell-btn.active) {
  background: rgba(255, 255, 255, 0.2);
  color: white;
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

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.action-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.25);
}

.action-btn.logout {
  background: #e74c3c;
  color: white;
}

.action-btn.logout:hover {
  background: #c0392b;
}

.dashboard-content {
  padding: 25px 30px;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-left: 4px solid #ccc;
}

.stat-card.pending {
  border-left-color: #f39c12;
}

.stat-card.approved {
  border-left-color: #27ae60;
}

.stat-card.rejected {
  border-left-color: #e74c3c;
}

.stat-card.deleted {
  border-left-color: #95a5a6;
}

.stat-label {
  color: #7f8c8d;
  font-size: 0.9rem;
}

.stat-value {
  color: #2c3e50;
  font-size: 1.8rem;
  font-weight: 700;
}

.toolbar {
  background: white;
  padding: 15px 20px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.filter-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-tab {
  padding: 8px 18px;
  border: none;
  background: #ecf0f1;
  color: #7f8c8d;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.filter-tab:hover {
  background: #dfe6e9;
}

.filter-tab.active {
  background: #3498db;
  color: white;
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.selected-count {
  color: #2c3e50;
  font-size: 0.9rem;
  font-weight: 500;
}

.batch-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
}

.batch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.batch-btn.approve {
  background: #27ae60;
  color: white;
}

.batch-btn.approve:hover:not(:disabled) {
  background: #229954;
}

.batch-btn.reject {
  background: #e74c3c;
  color: white;
}

.batch-btn.reject:hover:not(:disabled) {
  background: #c0392b;
}

.batch-btn.delete {
  background: #e67e22;
  color: white;
}

.batch-btn.delete:hover:not(:disabled) {
  background: #d35400;
}

.batch-btn.clear {
  background: #95a5a6;
  color: white;
}

.batch-btn.clear:hover:not(:disabled) {
  background: #7f8c8d;
}

.messages-table-container {
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.loading,
.error-box {
  text-align: center;
  padding: 60px 20px;
  color: #7f8c8d;
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
  to {
    transform: rotate(360deg);
  }
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

.messages-table {
  width: 100%;
  border-collapse: collapse;
}

.messages-table thead {
  background: #f8f9fa;
}

.messages-table th {
  padding: 14px 16px;
  text-align: left;
  font-size: 0.9rem;
  color: #555;
  font-weight: 600;
  border-bottom: 2px solid #e9ecef;
}

.messages-table td {
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 0.9rem;
  color: #333;
  vertical-align: top;
}

.messages-table tr.deleted {
  background: #fafafa;
  opacity: 0.6;
}

.messages-table tr:hover:not(.deleted) {
  background: #f8f9fa;
}

.messages-table tr.highlighted {
  background: #fff9e6 !important;
  animation: highlightPulse 1s ease-in-out 2;
}

@keyframes highlightPulse {
  0%, 100% { background: #fff9e6; }
  50% { background: #ffe58f; }
}

.col-check {
  width: 50px;
  text-align: center;
}

.col-id {
  width: 60px;
  color: #999;
  font-family: monospace;
}

.col-user {
  width: 130px;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar-sm {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: bold;
  flex-shrink: 0;
}

.username {
  font-weight: 500;
  color: #2c3e50;
}

.col-content {
  min-width: 250px;
}

.content-text {
  line-height: 1.6;
  color: #444;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-wrap: break-word;
}

.deleted-badge {
  display: inline-block;
  margin-top: 6px;
  padding: 2px 8px;
  background: #e74c3c;
  color: white;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.content-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.pinned-badge {
  display: inline-block;
  padding: 2px 10px;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(238, 90, 36, 0.3);
}

.col-status {
  width: 100px;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-badge.pending {
  background: #fef3cd;
  color: #856404;
}

.status-badge.approved {
  background: #d4edda;
  color: #155724;
}

.status-badge.rejected {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.deleted {
  background: #e2e3e5;
  color: #383d41;
}

.col-time {
  width: 160px;
  color: #888;
  font-size: 0.85rem;
  white-space: nowrap;
}

.col-actions {
  width: 180px;
}

.action-buttons {
  display: flex;
  gap: 6px;
}

.row-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.row-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.row-btn.approve {
  background: #d4edda;
  color: #155724;
}

.row-btn.approve:hover:not(:disabled) {
  background: #27ae60;
  color: white;
}

.row-btn.approve.active {
  background: #27ae60;
  color: white;
}

.row-btn.reject {
  background: #f8d7da;
  color: #721c24;
}

.row-btn.reject:hover:not(:disabled) {
  background: #e74c3c;
  color: white;
}

.row-btn.reject.active {
  background: #e74c3c;
  color: white;
}

.row-btn.delete {
  background: #fdf1e3;
  color: #8a4d00;
}

.row-btn.delete:hover:not(:disabled) {
  background: #e67e22;
  color: white;
}

.row-btn.pin {
  background: #fff3cd;
  color: #856404;
}

.row-btn.pin:hover:not(:disabled) {
  background: #f39c12;
  color: white;
}

.row-btn.unpin {
  background: #d1ecf1;
  color: #0c5460;
}

.row-btn.unpin:hover:not(:disabled) {
  background: #17a2b8;
  color: white;
}

.empty-row {
  text-align: center;
  color: #999;
  padding: 50px 20px !important;
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

input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

@media (max-width: 900px) {
  .dashboard-content {
    padding: 15px;
  }

  .messages-table {
    display: block;
    overflow-x: auto;
  }
}
</style>
