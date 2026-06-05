<template>
  <div class="admin-login-container">
    <div class="admin-login-card">
      <h2>🛡️ 管理员登录</h2>
      <p class="subtitle">管理后台系统，仅限管理员访问</p>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="username">管理员账号</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            placeholder="请输入管理员账号"
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

      <p class="back-link">
        <router-link to="/">← 返回留言板首页</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminLogin } from '../utils/api.js'
import { useAdminStore } from '../store/admin.js'

const router = useRouter()
const adminStore = useAdminStore()

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
    errors.username = '管理员账号不能为空'
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
    const response = await adminLogin(form.username, form.password)
    adminStore.setAuth(response.data.token, response.data.admin)
    router.push('/admin/dashboard')
  } catch (err) {
    error.value = err.response?.data?.error || '登录失败，请稍后重试'
    console.error(err)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (adminStore.isLoggedIn.value) {
    router.push('/admin/dashboard')
  }
})
</script>

<style scoped>
.admin-login-container {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
}

.admin-login-card {
  background: white;
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  border-top: 4px solid #e74c3c;
}

.admin-login-card h2 {
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
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #e74c3c;
  box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.1);
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
  background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
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
  box-shadow: 0 5px 20px rgba(231, 76, 60, 0.4);
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

.back-link {
  text-align: center;
  margin-top: 25px;
  color: #666;
  font-size: 0.95rem;
}

.back-link a {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.back-link a:hover {
  color: #764ba2;
}
</style>
