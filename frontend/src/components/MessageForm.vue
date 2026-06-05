<template>
  <div class="message-form">
    <h2>✍️ 发表留言</h2>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="username">用户名</label>
        <input
          id="username"
          v-model="form.username"
          type="text"
          placeholder="请输入您的昵称"
          maxlength="50"
          :disabled="submitting"
        />
        <span class="char-count">{{ form.username.length }}/50</span>
      </div>

      <div class="form-group">
        <label for="content">留言内容</label>
        <textarea
          id="content"
          v-model="form.content"
          placeholder="分享您的想法..."
          rows="4"
          maxlength="500"
          :disabled="submitting"
        ></textarea>
        <span class="char-count">{{ form.content.length }}/500</span>
      </div>

      <button type="submit" class="submit-btn" :disabled="submitting || !isValid">
        {{ submitting ? '提交中...' : '发布留言' }}
      </button>

      <p v-if="error" class="error-message">{{ error }}</p>
      <p v-if="success" class="success-message">留言发布成功！</p>
    </form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { submitMessage } from '../utils/api.js'

const emit = defineEmits(['submitted'])

const form = ref({
  username: '',
  content: ''
})

const submitting = ref(false)
const error = ref('')
const success = ref(false)

const isValid = computed(() => {
  return form.value.username.trim() !== '' && form.value.content.trim() !== ''
})

const handleSubmit = async () => {
  if (!isValid.value) return

  submitting.value = true
  error.value = ''
  success.value = false

  try {
    await submitMessage(form.value.username, form.value.content)
    success.value = true
    form.value.username = ''
    form.value.content = ''
    emit('submitted')

    setTimeout(() => {
      success.value = false
    }, 3000)
  } catch (err) {
    error.value = err.response?.data?.error || '提交失败，请稍后重试'
    console.error(err)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.message-form {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 30px;
}

.message-form h2 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.3rem;
}

.form-group {
  margin-bottom: 20px;
  position: relative;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 600;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s, box-shadow 0.3s;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group input:disabled,
.form-group textarea:disabled {
  background: #f0f0f0;
  cursor: not-allowed;
}

.char-count {
  position: absolute;
  right: 10px;
  bottom: -22px;
  font-size: 0.8rem;
  color: #999;
}

.submit-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 14px 40px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
  margin-top: 10px;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: #e74c3c;
  margin-top: 15px;
  font-size: 0.9rem;
}

.success-message {
  color: #27ae60;
  margin-top: 15px;
  font-size: 0.9rem;
}
</style>
