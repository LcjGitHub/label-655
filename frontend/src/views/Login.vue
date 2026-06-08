<template>
  <div class="login-container">
    <div class="login-card">
      <h2>🔐 用户登录</h2>
      <p class="subtitle">欢迎回来，请登录您的账户</p>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            placeholder="请输入用户名"
            maxlength="20"
            :disabled="submitting"
          />
          <p v-if="errors.username" class="field-error">{{ errors.username }}</p>
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            :disabled="submitting"
          />
          <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
        </div>

        <button type="submit" class="submit-btn" :disabled="submitting">
          {{ submitting ? '登录中...' : '登 录' }}
        </button>

        <p v-if="error" class="error-message">{{ error }}</p>
      </form>

      <p class="register-link">
        还没有账户？
        <router-link to="/register">立即注册</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../utils/api.js'
import { useAuthStore } from '../store/auth.js'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  username: '',
  password: ''
})

const errors = reactive({
  username: '',
  password: ''
})

const submitting = ref(false)
const error = ref('')

const validateForm = () => {
  let isValid = true
  errors.username = ''
  errors.password = ''

  if (form.username.trim() === '') {
    errors.username = '用户名不能为空'
    isValid = false
  }

  if (form.password === '') {
    errors.password = '密码不能为空'
    isValid = false
  }

  return isValid
}

const handleSubmit = async () => {
  const isValid = validateForm()
  if (!isValid) return

  submitting.value = true
  error.value = ''

  try {
    const response = await login(form.username, form.password)
    authStore.setAuth(response.data.token, response.data.user)

    if (response.data.checkIn) {
      const checkIn = response.data.checkIn
      if (checkIn.checkedIn) {
        alert(`🎉 签到成功！获得 ${checkIn.earnedPoints} 积分，当前积分：${checkIn.points}`)
      }
    }

    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.error || '登录失败，请稍后重试'
    console.error(err)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (authStore.isLoggedIn.value) {
    router.push('/')
  }
})
</script>

<style scoped>
.login-container {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
}

.login-card {
  background: white;
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.login-card h2 {
  color: #333;
  margin-bottom: 8px;
  font-size: 1.8rem;
  text-align: center;
}

.subtitle {
  text-align: center;
  color: #888;
  margin-bottom: 30px;
  font-size: 0.95rem;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 600;
  font-size: 0.95rem;
}

.form-group input {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s, box-shadow 0.3s;
  font-family: inherit;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group input:disabled {
  background: #f0f0f0;
  cursor: not-allowed;
}

.field-error {
  color: #e74c3c;
  font-size: 0.85rem;
  margin-top: 5px;
}

.submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 14px;
  border-radius: 8px;
  font-size: 1.05rem;
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
  text-align: center;
  margin-top: 15px;
  font-size: 0.9rem;
}

.register-link {
  text-align: center;
  margin-top: 25px;
  color: #666;
  font-size: 0.95rem;
}

.register-link a {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s;
}

.register-link a:hover {
  color: #764ba2;
}
</style>
