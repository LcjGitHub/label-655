<template>
  <div class="message-list">
    <h2>💬 留言列表 <span class="count">({{ total }} 条)</span></h2>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>😢 {{ error }}</p>
      <button @click="$emit('retry')" class="retry-btn">重试</button>
    </div>

    <div v-else-if="messages.length === 0" class="empty">
      <p>📭 暂无留言，快来发表第一条吧！</p>
    </div>

    <div v-else class="messages">
      <div v-for="message in messages" :key="message.id" class="message-card">
        <div class="message-header">
            <div class="avatar">
              <img v-if="message.avatar" :src="message.avatar" :alt="message.username" class="avatar-img" />
              <span v-else>{{ getAvatar(message.username) }}</span>
            </div>
          <div class="user-info">
            <div class="user-name-row">
              <span class="username">{{ message.username }}</span>
              <span v-if="message.updated_at" class="edited-tag">（已编辑）</span>
            </div>
            <span class="time">{{ formatTime(message.created_at) }}</span>
          </div>
          <button
            v-if="canEdit(message) && isWithinEditTime(message)"
            @click="openEditDialog(message)"
            class="edit-btn"
            :title="getEditButtonTitle(message)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span class="edit-countdown">{{ getCountdownText(message.id) }}</span>
          </button>
          <span
            v-else-if="canEdit(message) && !isWithinEditTime(message)"
            class="edit-expired"
            title="编辑时间已过期（发布后5分钟内可编辑）"
          >
            已超时
          </span>
        </div>
        <div class="message-content">{{ message.content }}</div>

        <div class="message-actions">
          <button @click="toggleReplyForm(message.id)" class="action-btn">
            💬 回复
          </button>
          <button
            @click="handleLike(message.id)"
            class="like-btn"
            :class="{ 'liked': getLocalLikeStatus(message.id) }"
            :disabled="liking[message.id]"
            :aria-label="getLocalLikeStatus(message.id) ? '取消点赞' : '点赞'"
            :title="getLocalLikeStatus(message.id) ? '取消点赞' : '点赞'"
          >
            <span class="heart-icon">
              <svg v-if="getLocalLikeStatus(message.id)" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </span>
            <span class="like-count">{{ getLocalLikes(message.id) }}</span>
          </button>
          <p v-if="likeErrors[message.id]" class="error-text like-error">{{ likeErrors[message.id] }}</p>
        </div>

        <div v-if="showReplyForm[message.id]" class="reply-form">
          <textarea
            v-model="replyContent[message.id]"
            :placeholder="isLoggedIn ? '写下你的回复...' : '请先登录后回复'"
            :disabled="!isLoggedIn || replying[message.id]"
            maxlength="300"
            rows="2"
            @keydown.ctrl.enter="submitReply(message.id)"
          ></textarea>
          <div class="reply-form-actions">
            <span class="char-count">{{ (replyContent[message.id] || '').length }}/300</span>
            <div>
              <button @click="cancelReply(message.id)" class="cancel-btn" :disabled="replying[message.id]">
                取消
              </button>
              <button
                @click="submitReply(message.id)"
                class="submit-reply-btn"
                :disabled="!isLoggedIn || replying[message.id] || !replyContent[message.id]?.trim()"
              >
                {{ replying[message.id] ? '提交中...' : '发布回复' }}
              </button>
            </div>
          </div>
          <p v-if="replyErrors[message.id]" class="error-text">{{ replyErrors[message.id] }}</p>
        </div>

        <div v-if="replies[message.id]" class="replies-section" :id="`replies-${message.id}`">
          <div v-if="replies[message.id].total > 0" class="replies-header">
            <span>{{ replies[message.id].total }} 条回复</span>
          </div>

          <div class="replies-list">
            <div
              v-for="reply in getDisplayedReplies(message.id)"
              :key="reply.id"
              class="reply-item"
            >
              <div class="reply-header">
                <span class="reply-avatar">
                  <img v-if="reply.avatar" :src="reply.avatar" :alt="reply.username" class="reply-avatar-img" />
                  <span v-else>{{ getAvatar(reply.username) }}</span>
                </span>
                <span class="reply-username">{{ reply.username }}</span>
                <span class="reply-time">{{ formatTime(reply.created_at) }}</span>
                <button
                  v-if="isLoggedIn"
                  @click="toggleChildReplyForm(message.id, reply.id)"
                  class="reply-link-btn"
                >
                  回复
                </button>
              </div>
              <div class="reply-content">{{ reply.content }}</div>

              <div v-if="showChildReplyForm[`${message.id}-${reply.id}`]" class="child-reply-form">
                <textarea
                  v-model="childReplyContent[`${message.id}-${reply.id}`]"
                  placeholder="写下你的回复..."
                  :disabled="childReplying[`${message.id}-${reply.id}`]"
                  maxlength="300"
                  rows="2"
                  @keydown.ctrl.enter="submitChildReply(message.id, reply.id)"
                ></textarea>
                <div class="reply-form-actions">
                  <span class="char-count">{{ (childReplyContent[`${message.id}-${reply.id}`] || '').length }}/300</span>
                  <div>
                    <button @click="cancelChildReply(message.id, reply.id)" class="cancel-btn" :disabled="childReplying[`${message.id}-${reply.id}`]">
                      取消
                    </button>
                    <button
                      @click="submitChildReply(message.id, reply.id)"
                      class="submit-reply-btn"
                      :disabled="childReplying[`${message.id}-${reply.id}`] || !childReplyContent[`${message.id}-${reply.id}`]?.trim()"
                    >
                      {{ childReplying[`${message.id}-${reply.id}`] ? '提交中...' : '发布回复' }}
                    </button>
                  </div>
                </div>
                <p v-if="childReplyErrors[`${message.id}-${reply.id}`]" class="error-text">{{ childReplyErrors[`${message.id}-${reply.id}`] }}</p>
              </div>

              <div v-if="reply.children && reply.children.length > 0" class="child-replies">
                <div
                  v-for="childReply in reply.children"
                  :key="childReply.id"
                  class="child-reply-item"
                >
                  <div class="child-reply-header">
                    <span class="reply-avatar small">
                      <img v-if="childReply.avatar" :src="childReply.avatar" :alt="childReply.username" class="reply-avatar-img" />
                      <span v-else>{{ getAvatar(childReply.username) }}</span>
                    </span>
                    <span class="reply-username">{{ childReply.username }}</span>
                    <span class="reply-to">
                      回复@{{ childReply.parent_username }}
                    </span>
                    <span class="reply-time">{{ formatTime(childReply.created_at) }}</span>
                  </div>
                  <div class="reply-content">{{ childReply.content }}</div>
                </div>
              </div>
            </div>
          </div>

          <button
            v-if="!showAllReplies[message.id] && replies[message.id].total > 3"
            @click="showAllReplies[message.id] = true"
            class="view-all-btn"
          >
            查看全部 {{ replies[message.id].total }} 条回复 ▼
          </button>
          <button
            v-if="showAllReplies[message.id] && replies[message.id].total > 3"
            @click="showAllReplies[message.id] = false"
            class="view-all-btn"
          >
            收起回复 ▲
          </button>
        </div>
      </div>
    </div>

    <div v-if="editDialogVisible" class="edit-dialog-overlay" @click.self="closeEditDialog">
      <div class="edit-dialog">
        <div class="edit-dialog-header">
          <h3>编辑留言</h3>
          <div class="edit-dialog-countdown" v-if="editingMessageId && countdowns[editingMessageId] !== undefined">
            剩余可编辑时间：{{ formatCountdown(countdowns[editingMessageId]) }}
          </div>
        </div>
        <div class="edit-dialog-body">
          <textarea
            v-model="editContent"
            placeholder="修改留言内容..."
            maxlength="500"
            rows="5"
            :disabled="editing"
          ></textarea>
          <div class="char-count-wrapper">
            <span class="char-count">{{ editContent.length }}/500</span>
          </div>
          <p v-if="editError" class="error-text">{{ editError }}</p>
        </div>
        <div class="edit-dialog-footer">
          <button @click="closeEditDialog" class="cancel-btn" :disabled="editing">
            取消
          </button>
          <button
            @click="saveEdit"
            class="submit-reply-btn"
            :disabled="editing || !editContent.trim()"
          >
            {{ editing ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, nextTick, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { getReplies, submitReply as submitReplyApi, toggleLike as toggleLikeApi, updateMessage as updateMessageApi } from '../utils/api.js'
import { useAuthStore } from '../store/auth.js'

const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  total: {
    type: Number,
    default: 0
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['retry', 'message-updated'])

const router = useRouter()
const authStore = useAuthStore()
const isLoggedIn = computed(() => authStore.isLoggedIn.value)
const currentUser = computed(() => authStore.currentUser.value)

const EDIT_WINDOW_MINUTES = 5

const showReplyForm = reactive({})
const replyContent = reactive({})
const replying = reactive({})
const replyErrors = reactive({})

const showChildReplyForm = reactive({})
const childReplyContent = reactive({})
const childReplying = reactive({})
const childReplyErrors = reactive({})

const replies = reactive({})
const showAllReplies = reactive({})

const localLikes = reactive({})
const localLikeStatus = reactive({})
const liking = reactive({})
const likeErrors = reactive({})

const editDialogVisible = ref(false)
const editingMessageId = ref(null)
const editContent = ref('')
const editing = ref(false)
const editError = ref('')

const countdowns = reactive({})
let countdownTimer = null

const fetchReplies = async (messageId) => {
  try {
    const response = await getReplies(messageId)
    replies[messageId] = {
      list: response.data.replies,
      total: response.data.total
    }
  } catch (err) {
    console.error('获取回复失败:', err)
  }
}

const getRemainingSeconds = (message) => {
  const createdAt = new Date(message.created_at)
  const now = new Date()
  const elapsedMs = now - createdAt
  const totalMs = EDIT_WINDOW_MINUTES * 60 * 1000
  const remainingMs = totalMs - elapsedMs
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0
}

const updateCountdowns = () => {
  props.messages.forEach((message) => {
    if (canEdit(message)) {
      countdowns[message.id] = getRemainingSeconds(message)
    }
  })
}

const startCountdownTimer = () => {
  if (countdownTimer) return
  updateCountdowns()
  countdownTimer = setInterval(() => {
    updateCountdowns()
  }, 1000)
}

const stopCountdownTimer = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

const formatCountdown = (seconds) => {
  if (seconds <= 0) return '已超时'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const getCountdownText = (messageId) => {
  const seconds = countdowns[messageId]
  if (seconds === undefined || seconds <= 0) return ''
  return formatCountdown(seconds)
}

const isWithinEditTime = (message) => {
  const seconds = getRemainingSeconds(message)
  return seconds > 0
}

const canEdit = (message) => {
  if (!isLoggedIn.value || !currentUser.value) return false
  if (message.is_deleted === 1) return false
  if (message.status !== 'approved') return false
  return message.username === currentUser.value.username
}

const getEditButtonTitle = (message) => {
  if (!canEdit(message)) return ''
  if (!isWithinEditTime(message)) return '编辑时间已过期（发布后5分钟内可编辑）'
  return '编辑留言'
}

const openEditDialog = (message) => {
  if (!isWithinEditTime(message)) return
  editingMessageId.value = message.id
  editContent.value = message.content
  editError.value = ''
  editDialogVisible.value = true
}

const closeEditDialog = () => {
  editDialogVisible.value = false
  editingMessageId.value = null
  editContent.value = ''
  editError.value = ''
}

const saveEdit = async () => {
  if (!editingMessageId.value || !editContent.value.trim()) return

  editing.value = true
  editError.value = ''

  try {
    await updateMessageApi(editingMessageId.value, editContent.value.trim())
    editing.value = false
    closeEditDialog()
    emit('message-updated')
  } catch (err) {
    editError.value = err.response?.data?.error || '保存失败，请稍后重试'
    console.error('更新留言失败:', err)
    editing.value = false
    if (err.response?.status === 403) {
      setTimeout(() => {
        closeEditDialog()
      }, 2000)
    }
  }
}

const clearLocalLikeCache = () => {
  Object.keys(localLikes).forEach(key => delete localLikes[key])
  Object.keys(localLikeStatus).forEach(key => delete localLikeStatus[key])
  Object.keys(liking).forEach(key => delete liking[key])
  Object.keys(likeErrors).forEach(key => delete likeErrors[key])
}

watch(
  () => props.messages,
  (newMessages) => {
    newMessages.forEach((message) => {
      if (!replies[message.id]) {
        fetchReplies(message.id)
      }
      localLikes[message.id] = message.likes ?? 0
      localLikeStatus[message.id] = message.is_liked ?? false
    })
    updateCountdowns()
  },
  { immediate: true, deep: true }
)

watch(
  () => authStore.isLoggedIn.value,
  (isLoggedIn) => {
    clearLocalLikeCache()
    if (isLoggedIn) {
      startCountdownTimer()
    } else {
      stopCountdownTimer()
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  stopCountdownTimer()
})

const getDisplayedReplies = (messageId) => {
  if (!replies[messageId]) return []
  if (showAllReplies[messageId]) return replies[messageId].list
  return replies[messageId].list.slice(0, 3)
}

const getLocalLikes = (messageId) => {
  return localLikes[messageId] ?? 0
}

const getLocalLikeStatus = (messageId) => {
  return localLikeStatus[messageId] ?? false
}

const handleLike = async (messageId) => {
  if (liking[messageId]) return

  likeErrors[messageId] = ''
  const previousStatus = localLikeStatus[messageId]
  const previousLikes = localLikes[messageId]

  localLikeStatus[messageId] = !previousStatus
  localLikes[messageId] = previousStatus ? previousLikes - 1 : previousLikes + 1
  liking[messageId] = true

  try {
    const response = await toggleLikeApi(messageId)
    localLikeStatus[messageId] = response.data.liked
    localLikes[messageId] = response.data.likes
  } catch (err) {
    localLikeStatus[messageId] = previousStatus
    localLikes[messageId] = previousLikes
    likeErrors[messageId] = err.response?.data?.error || '点赞失败，请稍后重试'
    console.error('点赞操作失败:', err)
  } finally {
    liking[messageId] = false
  }
}

const toggleReplyForm = (messageId) => {
  if (!isLoggedIn.value) {
    if (confirm('请先登录后再回复，是否立即登录？')) {
      router.push('/login')
    }
    return
  }
  showReplyForm[messageId] = !showReplyForm[messageId]
  if (showReplyForm[messageId]) {
    replyContent[messageId] = ''
    replyErrors[messageId] = ''
  }
}

const cancelReply = (messageId) => {
  showReplyForm[messageId] = false
  replyContent[messageId] = ''
  replyErrors[messageId] = ''
}

const scrollToLatestReply = async (messageId) => {
  await nextTick()
  const replySection = document.getElementById(`replies-${messageId}`)
  if (replySection) {
    replySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

const submitReply = async (messageId) => {
  if (!replyContent[messageId]?.trim()) return

  replying[messageId] = true
  replyErrors[messageId] = ''

  try {
    await submitReplyApi(messageId, replyContent[messageId].trim())
    replyContent[messageId] = ''
    showReplyForm[messageId] = false
    showAllReplies[messageId] = true
    await fetchReplies(messageId)
    scrollToLatestReply(messageId)
  } catch (err) {
    replyErrors[messageId] = err.response?.data?.error || '提交失败，请稍后重试'
    console.error(err)
  } finally {
    replying[messageId] = false
  }
}

const toggleChildReplyForm = (messageId, replyId) => {
  if (!isLoggedIn.value) {
    if (confirm('请先登录后再回复，是否立即登录？')) {
      router.push('/login')
    }
    return
  }
  const key = `${messageId}-${replyId}`
  showChildReplyForm[key] = !showChildReplyForm[key]
  if (showChildReplyForm[key]) {
    childReplyContent[key] = ''
    childReplyErrors[key] = ''
  }
}

const cancelChildReply = (messageId, replyId) => {
  const key = `${messageId}-${replyId}`
  showChildReplyForm[key] = false
  childReplyContent[key] = ''
  childReplyErrors[key] = ''
}

const submitChildReply = async (messageId, replyId) => {
  const key = `${messageId}-${replyId}`
  if (!childReplyContent[key]?.trim()) return

  childReplying[key] = true
  childReplyErrors[key] = ''

  try {
    await submitReplyApi(messageId, childReplyContent[key].trim(), replyId)
    childReplyContent[key] = ''
    showChildReplyForm[key] = false
    showAllReplies[messageId] = true
    await fetchReplies(messageId)
    scrollToLatestReply(messageId)
  } catch (err) {
    childReplyErrors[key] = err.response?.data?.error || '提交失败，请稍后重试'
    console.error(err)
  } finally {
    childReplying[key] = false
  }
}

const getAvatar = (username) => {
  return username.charAt(0).toUpperCase()
}

const formatTime = (dateStr) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.message-list {
  margin-bottom: 30px;
}

.message-list h2 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.3rem;
}

.count {
  color: #999;
  font-size: 0.9rem;
  font-weight: normal;
}

.loading,
.error,
.empty {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f0f0f0;
  border-top-color: #667eea;
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
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 25px;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 15px;
  font-size: 0.9rem;
}

.retry-btn:hover {
  background: #5568d3;
}

.messages {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.message-card {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  padding: 20px;
  transition: box-shadow 0.3s, transform 0.3s;
}

.message-card:hover {
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.message-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  position: relative;
}

.avatar {
  width: 45px;
  height: 45px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: bold;
  margin-right: 12px;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 50%;
}

.user-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.user-name-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.username {
  font-weight: 600;
  color: #333;
  font-size: 1rem;
}

.time {
  font-size: 0.85rem;
  color: #999;
  margin-top: 2px;
}

.edited-tag {
  font-size: 0.75rem;
  color: #999;
}

.edit-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: 1px solid #e0e0e0;
  color: #667eea;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 5px 10px;
  border-radius: 6px;
  transition: all 0.2s;
}

.edit-btn:hover {
  background: #f0f0ff;
  border-color: #667eea;
}

.edit-countdown {
  font-size: 0.75rem;
  font-weight: 500;
}

.edit-expired {
  font-size: 0.75rem;
  color: #bbb;
  padding: 5px 10px;
  border: 1px dashed #e0e0e0;
  border-radius: 6px;
}

.message-content {
  color: #555;
  line-height: 1.7;
  font-size: 0.95rem;
  word-wrap: break-word;
}

.message-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-btn {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background 0.2s;
}

.action-btn:hover {
  background: #f0f0ff;
}

.like-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background 0.2s, transform 0.2s;
  display: flex;
  align-items: center;
  gap: 5px;
  color: #999;
}

.like-btn:hover:not(:disabled) {
  background: #fff0f0;
  transform: scale(1.05);
}

.like-btn.liked {
  color: #e74c3c;
}

.like-btn.liked:hover:not(:disabled) {
  background: #ffeaea;
}

.like-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.heart-icon {
  display: flex;
  align-items: center;
  transition: transform 0.2s;
}

.like-btn:not(.liked):hover .heart-icon {
  animation: heartBeat 0.6s ease-in-out;
}

.like-btn.liked .heart-icon {
  animation: heartPop 0.3s ease-out;
}

@keyframes heartBeat {
  0%, 100% { transform: scale(1); }
  25% { transform: scale(1.1); }
  50% { transform: scale(1); }
  75% { transform: scale(1.1); }
}

@keyframes heartPop {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.like-count {
  font-weight: 500;
  min-width: 20px;
  text-align: left;
}

.like-error {
  font-size: 0.8rem;
  margin-top: 4px;
  text-align: right;
}

.reply-form {
  margin-top: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.reply-form textarea {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 0.9rem;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.3s;
}

.reply-form textarea:focus {
  outline: none;
  border-color: #667eea;
}

.reply-form textarea:disabled {
  background: #f0f0f0;
  cursor: not-allowed;
}

.reply-form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.char-count {
  font-size: 0.8rem;
  color: #999;
}

.char-count-wrapper {
  text-align: right;
  margin-top: 5px;
}

.cancel-btn {
  background: #e0e0e0;
  color: #666;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  margin-right: 8px;
  transition: background 0.2s;
}

.cancel-btn:hover:not(:disabled) {
  background: #d0d0d0;
}

.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-reply-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: opacity 0.2s;
}

.submit-reply-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.submit-reply-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-text {
  color: #e74c3c;
  font-size: 0.85rem;
  margin-top: 10px;
}

.replies-section {
  margin-top: 15px;
  padding-left: 10px;
  border-left: 3px solid #e8e8e8;
}

.replies-header {
  color: #999;
  font-size: 0.85rem;
  margin-bottom: 10px;
  padding-left: 10px;
}

.replies-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reply-item {
  background: #fafafa;
  border-radius: 8px;
  padding: 12px 15px;
}

.reply-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.reply-avatar {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
  color: #555;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: bold;
  flex-shrink: 0;
  overflow: hidden;
}

.reply-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 50%;
}

.reply-avatar.small {
  width: 24px;
  height: 24px;
  font-size: 0.75rem;
  background: linear-gradient(135deg, #d299c2 0%, #fef9d7 100%);
}

.reply-username {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.reply-to {
  color: #667eea;
  font-size: 0.85rem;
}

.reply-time {
  font-size: 0.8rem;
  color: #999;
  margin-left: auto;
}

.reply-link-btn {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.reply-link-btn:hover {
  background: #f0f0ff;
}

.reply-content {
  color: #555;
  line-height: 1.6;
  font-size: 0.9rem;
  word-wrap: break-word;
  padding-left: 36px;
}

.child-reply-form {
  margin-top: 10px;
  margin-left: 36px;
  padding: 10px;
  background: #f0f0f0;
  border-radius: 6px;
}

.child-reply-form textarea {
  width: 100%;
  padding: 8px 10px;
  border: 2px solid #e0e0e0;
  border-radius: 4px;
  font-size: 0.85rem;
  resize: vertical;
  font-family: inherit;
}

.child-reply-form textarea:focus {
  outline: none;
  border-color: #667eea;
}

.child-replies {
  margin-top: 10px;
  margin-left: 36px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.child-reply-item {
  background: #f0f0f0;
  border-radius: 6px;
  padding: 10px 12px;
}

.child-reply-header {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  flex-wrap: wrap;
  gap: 6px;
}

.view-all-btn {
  margin-top: 12px;
  margin-left: 10px;
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background 0.2s;
}

.view-all-btn:hover {
  background: #f0f0ff;
}

.edit-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.edit-dialog {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.edit-dialog-header {
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.edit-dialog-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.1rem;
}

.edit-dialog-countdown {
  font-size: 0.85rem;
  color: #e67e22;
  font-weight: 500;
}

.edit-dialog-body {
  padding: 20px;
}

.edit-dialog-body textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.95rem;
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
  transition: border-color 0.3s;
  box-sizing: border-box;
}

.edit-dialog-body textarea:focus {
  outline: none;
  border-color: #667eea;
}

.edit-dialog-body textarea:disabled {
  background: #f0f0f0;
  cursor: not-allowed;
}

.edit-dialog-footer {
  padding: 15px 20px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
}
</style>
