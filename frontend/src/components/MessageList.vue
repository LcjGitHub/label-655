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
        <div class="message-content rich-text-content" v-html="message.content"></div>

        <div class="message-actions">
          <button @click="handleToggleReplyForm(message.id)" class="action-btn">
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

        <div v-if="replyEditor.isFormVisible(message.id)" class="reply-form">
          <div class="editor-wrapper small-editor" :class="{ 'editor-disabled': replyEditor.isSubmitting(message.id) }">
            <Toolbar
              class="editor-toolbar"
              :editor="replyEditor.getEditorRef(message.id)"
              :default-config="replyEditor.toolbarConfig"
              mode="default"
            />
            <Editor
              class="editor-content"
              v-model="replyEditor.states[message.id].htmlContent"
              :default-config="replyEditor.getEditorConfig(message.id)"
              mode="default"
              @onCreated="(editor) => replyEditor.handleEditorCreated(message.id, editor)"
              @onChange="(editor) => replyEditor.handleEditorChange(message.id, editor)"
            />
          </div>
          <div class="reply-form-actions">
            <span
              class="char-count"
              :class="replyEditor.getCharCountClass(message.id)"
            >
              {{ replyEditor.getDisplayText(message.id) }}
            </span>
            <div>
              <button @click="replyEditor.closeForm(message.id)" class="cancel-btn" :disabled="replyEditor.isSubmitting(message.id)">
                取消
              </button>
              <button
                @click="handleSubmitReply(message.id)"
                class="submit-reply-btn"
                :disabled="replyEditor.isSubmitting(message.id) || !replyEditor.isValid(message.id)"
              >
                {{ replyEditor.isSubmitting(message.id) ? '提交中...' : '发布回复' }}
              </button>
            </div>
          </div>
          <p v-if="replyEditor.getError(message.id)" class="error-text">{{ replyEditor.getError(message.id) }}</p>
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
                  @click="handleToggleChildReplyForm(message.id, reply.id)"
                  class="reply-link-btn"
                >
                  回复
                </button>
              </div>
              <div class="reply-content rich-text-content" v-html="reply.content"></div>

              <div v-if="childReplyEditor.isFormVisible(childReplyKey(message.id, reply.id))" class="child-reply-form">
                <div class="editor-wrapper small-editor" :class="{ 'editor-disabled': childReplyEditor.isSubmitting(childReplyKey(message.id, reply.id)) }">
                  <Toolbar
                    class="editor-toolbar"
                    :editor="childReplyEditor.getEditorRef(childReplyKey(message.id, reply.id))"
                    :default-config="childReplyEditor.toolbarConfig"
                    mode="default"
                  />
                  <Editor
                    class="editor-content"
                    v-model="childReplyEditor.states[childReplyKey(message.id, reply.id)].htmlContent"
                    :default-config="childReplyEditor.getEditorConfig(childReplyKey(message.id, reply.id))"
                    mode="default"
                    @onCreated="(editor) => childReplyEditor.handleEditorCreated(childReplyKey(message.id, reply.id), editor)"
                    @onChange="(editor) => childReplyEditor.handleEditorChange(childReplyKey(message.id, reply.id), editor)"
                  />
                </div>
                <div class="reply-form-actions">
                  <span
                    class="char-count"
                    :class="childReplyEditor.getCharCountClass(childReplyKey(message.id, reply.id))"
                  >
                    {{ childReplyEditor.getDisplayText(childReplyKey(message.id, reply.id)) }}
                  </span>
                  <div>
                    <button @click="childReplyEditor.closeForm(childReplyKey(message.id, reply.id))" class="cancel-btn" :disabled="childReplyEditor.isSubmitting(childReplyKey(message.id, reply.id))">
                      取消
                    </button>
                    <button
                      @click="handleSubmitChildReply(message.id, reply.id)"
                      class="submit-reply-btn"
                      :disabled="childReplyEditor.isSubmitting(childReplyKey(message.id, reply.id)) || !childReplyEditor.isValid(childReplyKey(message.id, reply.id))"
                    >
                      {{ childReplyEditor.isSubmitting(childReplyKey(message.id, reply.id)) ? '提交中...' : '发布回复' }}
                    </button>
                  </div>
                </div>
                <p v-if="childReplyEditor.getError(childReplyKey(message.id, reply.id))" class="error-text">{{ childReplyEditor.getError(childReplyKey(message.id, reply.id)) }}</p>
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
                  <div class="reply-content rich-text-content" v-html="childReply.content"></div>
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
          <div class="editor-wrapper" :class="{ 'editor-disabled': editing }">
            <Toolbar
              class="editor-toolbar"
              :editor="editEditor.editorRef"
              :default-config="editEditor.toolbarConfig"
              mode="default"
            />
            <Editor
              class="editor-content"
              v-model="editEditor.htmlContent"
              :default-config="editEditor.editorConfig"
              mode="default"
              @onCreated="editEditor.handleEditorCreated"
              @onChange="editEditor.handleEditorChange"
            />
          </div>
          <div class="char-count-wrapper">
            <span
              class="char-count"
              :class="editCharCount.charCountClass"
            >
              {{ editCharCount.displayText }}
            </span>
          </div>
          <p v-if="editEditor.error.value" class="error-text">{{ editEditor.error.value }}</p>
        </div>
        <div class="edit-dialog-footer">
          <button @click="closeEditDialog" class="cancel-btn" :disabled="editing">
            取消
          </button>
          <button
            @click="saveEdit"
            class="submit-reply-btn"
            :disabled="editing || !editCharCount.isValid.value"
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
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'
import { getReplies, submitReply as submitReplyApi, toggleLike as toggleLikeApi, updateMessage as updateMessageApi } from '../utils/api.js'
import { useAuthStore } from '../store/auth.js'
import { sanitizeHtml, stripHtml } from '../utils/sanitize.js'
import { useEditor } from '../composables/useEditor.js'
import { useReplyEditor } from '../composables/useReplyEditor.js'
import { useCharacterCount } from '../composables/useCharacterCount.js'

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
const MAX_REPLY_LENGTH = 300
const MAX_MESSAGE_LENGTH = 500

const childReplyKey = (messageId, replyId) => `${messageId}-${replyId}`

const editEditor = useEditor({
  initialHtml: '<p><br></p>',
  placeholder: '修改留言内容...',
  maxLength: MAX_MESSAGE_LENGTH,
  autoDestroy: false
})

const editCharCount = useCharacterCount(
  () => editEditor.plainTextLength.value,
  MAX_MESSAGE_LENGTH
)

const editDialogVisible = ref(false)
const editingMessageId = ref(null)
const editing = ref(false)

const handleReplySubmit = async (key, htmlContent) => {
  const sanitizedHtml = sanitizeHtml(htmlContent)
  await submitReplyApi(key, sanitizedHtml)
}

const handleReplySuccess = async (key) => {
  const messageId = key
  showAllReplies[messageId] = true
  await fetchReplies(messageId)
  scrollToLatestReply(messageId)
}

const replyEditor = useReplyEditor({
  placeholder: '写下你的回复...',
  maxLength: MAX_REPLY_LENGTH,
  onSubmit: handleReplySubmit,
  onSuccess: handleReplySuccess
})

const handleToggleReplyForm = (messageId) => {
  if (!isLoggedIn.value) {
    if (confirm('请先登录后再回复，是否立即登录？')) {
      router.push('/login')
    }
    return
  }
  replyEditor.toggleForm(messageId)
}

const handleSubmitReply = (messageId) => {
  replyEditor.submit(messageId)
}

const handleChildReplySubmit = async (key, htmlContent) => {
  const [messageId, replyId] = key.split('-')
  const sanitizedHtml = sanitizeHtml(htmlContent)
  await submitReplyApi(messageId, sanitizedHtml, replyId)
}

const handleChildReplySuccess = async (key) => {
  const [messageId] = key.split('-')
  showAllReplies[messageId] = true
  await fetchReplies(messageId)
  scrollToLatestReply(messageId)
}

const childReplyEditor = useReplyEditor({
  placeholder: '写下你的回复...',
  maxLength: MAX_REPLY_LENGTH,
  onSubmit: handleChildReplySubmit,
  onSuccess: handleChildReplySuccess
})

const handleToggleChildReplyForm = (messageId, replyId) => {
  if (!isLoggedIn.value) {
    if (confirm('请先登录后再回复，是否立即登录？')) {
      router.push('/login')
    }
    return
  }
  childReplyEditor.toggleForm(childReplyKey(messageId, replyId))
}

const handleSubmitChildReply = (messageId, replyId) => {
  childReplyEditor.submit(childReplyKey(messageId, replyId))
}

const replies = reactive({})
const showAllReplies = reactive({})

const localLikes = reactive({})
const localLikeStatus = reactive({})
const liking = reactive({})
const likeErrors = reactive({})

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
  editEditor.setContent(message.content || '<p><br></p>')
  editEditor.error.value = ''
  editDialogVisible.value = true
}

const closeEditDialog = () => {
  editDialogVisible.value = false
  editingMessageId.value = null
  editEditor.reset()
  editEditor.destroyEditor()
}

const saveEdit = async () => {
  if (!editingMessageId.value || !editCharCount.isValid.value) return

  editing.value = true
  editEditor.error.value = ''

  try {
    const sanitizedHtml = sanitizeHtml(editEditor.htmlContent.value)
    await updateMessageApi(editingMessageId.value, sanitizedHtml)
    editing.value = false
    closeEditDialog()
    emit('message-updated')
  } catch (err) {
    editEditor.error.value = err.response?.data?.error || '保存失败，请稍后重试'
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
  replyEditor.destroyAllEditors()
  childReplyEditor.destroyAllEditors()
  editEditor.destroyEditor()
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

const scrollToLatestReply = async (messageId) => {
  await nextTick()
  const replySection = document.getElementById(`replies-${messageId}`)
  if (replySection) {
    replySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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

.editor-wrapper {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.3s, box-shadow 0.3s;
  background: white;
}

.editor-wrapper:focus-within {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.editor-wrapper.editor-disabled {
  opacity: 0.6;
  pointer-events: none;
}

.small-editor .editor-content {
  min-height: 100px;
  max-height: 250px;
}

.editor-toolbar {
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}

.editor-content {
  min-height: 120px;
  max-height: 300px;
  overflow-y: auto;
}

.editor-content :deep(.w-e-text-container) {
  background: white;
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

.char-count-warning {
  color: #e67e22;
}

.char-count-error {
  color: #e74c3c;
}

.char-count-wrapper {
  text-align: right;
  margin-top: 8px;
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

.rich-text-content :deep(p) {
  margin: 0 0 10px 0;
}

.rich-text-content :deep(p:last-child) {
  margin-bottom: 0;
}

.rich-text-content :deep(strong),
.rich-text-content :deep(b) {
  font-weight: 600;
}

.rich-text-content :deep(em),
.rich-text-content :deep(i) {
  font-style: italic;
}

.rich-text-content :deep(u) {
  text-decoration: underline;
}

.rich-text-content :deep(ul),
.rich-text-content :deep(ol) {
  margin: 10px 0;
  padding-left: 25px;
}

.rich-text-content :deep(ul) {
  list-style-type: disc;
}

.rich-text-content :deep(ol) {
  list-style-type: decimal;
}

.rich-text-content :deep(li) {
  margin: 4px 0;
  line-height: 1.6;
}

.rich-text-content :deep(a) {
  color: #667eea;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

.rich-text-content :deep(a:hover) {
  border-bottom-color: #667eea;
}

.rich-text-content :deep(img) {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  margin: 10px 0;
  display: block;
  object-fit: contain;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.rich-text-content :deep(h1),
.rich-text-content :deep(h2),
.rich-text-content :deep(h3),
.rich-text-content :deep(h4),
.rich-text-content :deep(h5),
.rich-text-content :deep(h6) {
  font-weight: 600;
  margin: 15px 0 10px;
  color: #333;
}

.rich-text-content :deep(h1) { font-size: 1.5rem; }
.rich-text-content :deep(h2) { font-size: 1.3rem; }
.rich-text-content :deep(h3) { font-size: 1.15rem; }
.rich-text-content :deep(h4) { font-size: 1.05rem; }

.rich-text-content :deep(blockquote) {
  border-left: 4px solid #667eea;
  padding-left: 15px;
  margin: 10px 0;
  color: #666;
  background: #f8f9ff;
  padding: 10px 15px;
  border-radius: 0 8px 8px 0;
}

.rich-text-content :deep(code) {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  color: #e74c3c;
}

.rich-text-content :deep(pre) {
  background: #2d2d2d;
  color: #f8f8f2;
  padding: 15px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 10px 0;
}

.rich-text-content :deep(pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
}

.rich-text-content :deep(hr) {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 15px 0;
}

.rich-text-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
}

.rich-text-content :deep(th),
.rich-text-content :deep(td) {
  border: 1px solid #e0e0e0;
  padding: 8px 12px;
  text-align: left;
}

.rich-text-content :deep(th) {
  background: #f8f9fa;
  font-weight: 600;
}

.child-reply-form {
  margin-top: 10px;
  margin-left: 36px;
  padding: 10px;
  background: #f0f0f0;
  border-radius: 6px;
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
  max-width: 600px;
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

.edit-dialog-footer {
  padding: 15px 20px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
}
</style>
