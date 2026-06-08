<template>
  <div v-if="visible" class="history-dialog-overlay" @click.self="handleClose">
    <div class="history-dialog">
      <div class="history-dialog-header">
        <h3>📜 编辑历史记录</h3>
        <button class="close-btn" @click="handleClose" title="关闭">✕</button>
      </div>

      <div class="history-dialog-body">
        <div v-if="loading" class="loading">
          <div class="spinner"></div>
          <p>加载中...</p>
        </div>

        <div v-else-if="error" class="error-box">
          <p>😢 {{ error }}</p>
        </div>

        <div v-else-if="history.length === 0" class="empty">
          <p>📭 暂无编辑历史记录</p>
        </div>

        <div v-else class="history-list">
          <div
            v-for="(item, index) in history"
            :key="item.id"
            class="history-item"
          >
            <div class="history-item-header">
              <span class="history-version">
                版本 {{ history.length - index }}
              </span>
              <span class="history-time">
                {{ formatTime(item.created_at) }}
              </span>
              <span class="history-user" v-if="showUser">
                编辑者：{{ item.username }}
              </span>
            </div>

            <div class="history-compare">
              <div class="compare-column">
                <div class="compare-label old-label">
                  <span class="label-dot"></span>
                  编辑前
                </div>
                <div class="compare-content rich-text-content old-content" v-html="item.old_content"></div>
              </div>

              <div class="compare-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>

              <div class="compare-column">
                <div class="compare-label new-label">
                  <span class="label-dot"></span>
                  编辑后
                </div>
                <div class="compare-content rich-text-content new-content" v-html="item.new_content"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="history-dialog-footer">
        <button @click="handleClose" class="close-dialog-btn">
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  messageId: {
    type: Number,
    default: null
  },
  fetchHistory: {
    type: Function,
    required: true
  },
  showUser: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'close'])

const history = ref([])
const loading = ref(false)
const error = ref('')

const loadHistory = async () => {
  if (!props.messageId) return

  loading.value = true
  error.value = ''
  history.value = []

  try {
    const response = await props.fetchHistory(props.messageId)
    history.value = response.data.history || []
  } catch (err) {
    error.value = err.response?.data?.error || '加载编辑历史失败，请稍后重试'
    console.error('加载编辑历史失败:', err)
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.visible, props.messageId],
  ([visible, messageId]) => {
    if (visible && messageId) {
      loadHistory()
    }
  },
  { immediate: true }
)

const handleClose = () => {
  emit('update:visible', false)
  emit('close')
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
</script>

<style scoped>
.history-dialog-overlay {
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

.history-dialog {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.history-dialog-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-dialog-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: #999;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f5f5f5;
  color: #666;
}

.history-dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.loading,
.error-box,
.empty {
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

.history-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.history-item {
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  overflow: hidden;
}

.history-item-header {
  padding: 12px 16px;
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.history-version {
  display: inline-block;
  padding: 4px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 12px;
}

.history-time {
  color: #666;
  font-size: 0.85rem;
}

.history-user {
  margin-left: auto;
  color: #888;
  font-size: 0.85rem;
}

.history-compare {
  display: flex;
  align-items: stretch;
  gap: 0;
}

.compare-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.compare-label {
  padding: 8px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.old-label {
  background: #fff5f5;
  color: #c0392b;
  border-right: 1px solid #f0f0f0;
}

.new-label {
  background: #f0fff4;
  color: #27ae60;
}

.label-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.old-label .label-dot {
  background: #e74c3c;
}

.new-label .label-dot {
  background: #27ae60;
}

.compare-content {
  flex: 1;
  padding: 16px;
  font-size: 0.9rem;
  line-height: 1.7;
  max-height: 300px;
  overflow-y: auto;
  word-wrap: break-word;
}

.old-content {
  background: #fffafa;
  border-right: 1px solid #f0f0f0;
}

.new-content {
  background: #fafffb;
}

.compare-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  background: #fafafa;
  color: #999;
  flex-shrink: 0;
}

.history-dialog-footer {
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
}

.close-dialog-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: opacity 0.2s;
}

.close-dialog-btn:hover {
  opacity: 0.9;
}

.rich-text-content :deep(p) {
  margin: 0 0 8px 0;
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
  margin: 8px 0;
  padding-left: 22px;
}

.rich-text-content :deep(ul) {
  list-style-type: disc;
}

.rich-text-content :deep(ol) {
  list-style-type: decimal;
}

.rich-text-content :deep(li) {
  margin: 3px 0;
  line-height: 1.6;
}

.rich-text-content :deep(a) {
  color: #667eea;
  text-decoration: none;
  border-bottom: 1px solid transparent;
}

.rich-text-content :deep(a:hover) {
  border-bottom-color: #667eea;
}

.rich-text-content :deep(img) {
  max-width: 100%;
  max-height: 200px;
  border-radius: 6px;
  margin: 6px 0;
  display: block;
  object-fit: contain;
}

.rich-text-content :deep(h1),
.rich-text-content :deep(h2),
.rich-text-content :deep(h3),
.rich-text-content :deep(h4),
.rich-text-content :deep(h5),
.rich-text-content :deep(h6) {
  font-weight: 600;
  margin: 10px 0 6px;
  color: #333;
}

.rich-text-content :deep(h1) { font-size: 1.3rem; }
.rich-text-content :deep(h2) { font-size: 1.2rem; }
.rich-text-content :deep(h3) { font-size: 1.1rem; }
.rich-text-content :deep(h4) { font-size: 1rem; }

.rich-text-content :deep(blockquote) {
  border-left: 3px solid #667eea;
  padding-left: 12px;
  margin: 8px 0;
  color: #666;
  background: #f8f9ff;
  padding: 8px 12px;
  border-radius: 0 6px 6px 0;
}

.rich-text-content :deep(code) {
  background: #f0f0f0;
  padding: 2px 5px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.85em;
  color: #e74c3c;
}

.rich-text-content :deep(pre) {
  background: #2d2d2d;
  color: #f8f8f2;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}

.rich-text-content :deep(pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
}

.rich-text-content :deep(hr) {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 10px 0;
}

.rich-text-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
}

.rich-text-content :deep(th),
.rich-text-content :deep(td) {
  border: 1px solid #e0e0e0;
  padding: 6px 10px;
  text-align: left;
}

.rich-text-content :deep(th) {
  background: #f8f9fa;
  font-weight: 600;
}

@media (max-width: 768px) {
  .history-compare {
    flex-direction: column;
  }

  .compare-arrow {
    transform: rotate(90deg);
    padding: 8px 0;
  }

  .old-content {
    border-right: none;
    border-bottom: 1px solid #f0f0f0;
  }

  .old-label {
    border-right: none;
    border-bottom: 1px solid #f0f0f0;
  }
}
</style>
