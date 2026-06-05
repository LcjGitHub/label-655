<template>
  <div class="message-form">
    <h2>✍️ 发表留言</h2>

    <div v-if="!isLoggedIn" class="login-prompt">
      <p class="prompt-text">🔒 请登录后发表留言</p>
      <div class="prompt-buttons">
        <router-link to="/login" class="prompt-btn login-btn">立即登录</router-link>
        <router-link to="/register" class="prompt-btn register-btn">注册账户</router-link>
      </div>
    </div>

    <form v-else @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="username">用户名</label>
        <input
          id="username"
          :value="currentUser?.username"
          type="text"
          disabled
          class="disabled-input"
        />
        <span class="user-badge">已登录</span>
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { submitMessage, isAuthenticated, getCurrentUser } from '../utils/api.js'

const emit = defineEmits(['submitted'])
const router = useRouter()

const form = ref({
  content: ''
})

const submitting = ref(false)
const error = ref('')
const success = ref(false)
const isLoggedIn = ref(false)
const currentUser = ref(null)

const isValid = computed(() => {
  return form.value.content.trim() !== ''
})

const updateAuthStatus = () => {
  isLoggedIn.value = isAuthenticated()
  currentUser.value = getCurrentUser()
}

const handleSubmit = async () => {
  if (!isValid.value) return

  submitting.value = true
  error.value = ''
  success.value = false

  try {
    await submitMessage(form.value.content)
    success.value = true
    form.value.content = ''
    emit('submitted')

    setTimeout(() => {
      success.value = false
    }, 3000)
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      router.push('/login')
    } else {
      error.value = err.response?.data?.error || '提交失败，请稍后重试'
    }
    console.error(err)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  updateAuthStatus()
})

router.afterEach(() => {
  updateAuthStatus()
})
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

.login-prompt {
  text-align: center;
  padding: 30px 20px;
  background: white;
  border-radius: 8px;
  border: 2px dashed #ddd;
}

.prompt-text {
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 20px;
}

.prompt-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.prompt-btn {
  padding: 12px 28px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  font-size: 1rem;
  transition: all 0.2s;
  cursor: pointer;
}

.prompt-btn.login-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.prompt-btn.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.prompt-btn.register-btn {
  background: white;
  color: #667eea;
  border: 2px solid #667eea;
}

.prompt-btn.register-btn:hover {
  background: #f0f0f0;
  transform: translateY(-2px);
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

.disabled-input {
  color: #667eea;
  font-weight: 600;
}

.user-badge {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: #27ae60;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
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
