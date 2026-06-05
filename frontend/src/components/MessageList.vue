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
          <div class="avatar">{{ getAvatar(message.username) }}</div>
          <div class="user-info">
            <span class="username">{{ message.username }}</span>
            <span class="time">{{ formatTime(message.created_at) }}</span>
          </div>
        </div>
        <div class="message-content">{{ message.content }}</div>

        <div class="message-actions">
          <button @click="toggleReplyForm(message.id)" class="action-btn">
            💬 回复
          </button>
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

        <div v-if="replies[message.id]" class="replies-section">
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
                <span class="reply-avatar">{{ getAvatar(reply.username) }}</span>
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
                    <span class="reply-avatar small">{{ getAvatar(childReply.username) }}</span>
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
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { getReplies, submitReply as submitReplyApi } from '../utils/api.js'
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

defineEmits(['retry'])

const authStore = useAuthStore()
const isLoggedIn = authStore.isLoggedIn

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

watch(
  () => props.messages,
  (newMessages) => {
    newMessages.forEach((message) => {
      if (!replies[message.id]) {
        fetchReplies(message.id)
      }
    })
  },
  { immediate: true, deep: true }
)

const getDisplayedReplies = (messageId) => {
  if (!replies[messageId]) return []
  if (showAllReplies[messageId]) return replies[messageId].list
  return replies[messageId].list.slice(0, 3)
}

const toggleReplyForm = (messageId) => {
  if (!isLoggedIn) {
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

const submitReply = async (messageId) => {
  if (!replyContent[messageId]?.trim()) return

  replying[messageId] = true
  replyErrors[messageId] = ''

  try {
    await submitReplyApi(messageId, replyContent[messageId].trim())
    replyContent[messageId] = ''
    showReplyForm[messageId] = false
    fetchReplies(messageId)
  } catch (err) {
    replyErrors[messageId] = err.response?.data?.error || '提交失败，请稍后重试'
    console.error(err)
  } finally {
    replying[messageId] = false
  }
}

const toggleChildReplyForm = (messageId, replyId) => {
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
    fetchReplies(messageId)
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
}

.user-info {
  display: flex;
  flex-direction: column;
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
</style>
