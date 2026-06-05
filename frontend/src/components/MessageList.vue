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
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
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
</style>
