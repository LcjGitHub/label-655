<template>
  <div class="register-container">
    <div class="register-card">
      <h2>📝 用户注册</h2>
      <p class="subtitle">创建账户，开始分享你的想法</p>

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
          <label for="email">邮箱</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            placeholder="请输入邮箱地址"
            :disabled="submitting"
          />
          <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="至少8位，包含字母和数字"
            :disabled="submitting"
          />
          <div class="password-tips">
            <span :class="{ valid: hasMinLength }">• 至少8位</span>
            <span :class="{ valid: hasLetter }">• 包含字母</span>
            <span :class="{ valid: hasNumber }">• 包含数字</span>
          </div>
          <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
        </div>

        <div class="form-group">
          <label for="confirmPassword">确认密码</label>
          <input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            :disabled="submitting"
          />
          <p v-if="errors.confirmPassword" class="field-error">{{ errors.confirmPassword }}</p>
        </div>

        <button type="submit" class="submit-btn" :disabled="submitting || !isFormValid">
          {{ submitting ? '注册中...' : '注 册' }}
        </button>

        <p v-if="error" class="error-message">{{ error }}</p>
      </form>

      <p class="login-link">
        已有账户？
        <router-link to="/login">立即登录</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { register, setAuth, isAuthenticated } from '../utils/api.js'

const router = useRouter()

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const errors = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const submitting = ref(false)
const error = ref('')

const hasMinLength = computed(() => form.password.length >= 8)
const hasLetter = computed(() => /[a-zA-Z]/.test(form.password))
const hasNumber = computed(() => /[0-9]/.test(form.password))

const isPasswordValid = computed(() => hasMinLength.value && hasLetter.value && hasNumber.value)

const isFormValid = computed(() => {
  return form.username.trim() !== '' &&
         form.email.trim() !== '' &&
         form.password !== '' &&
         form.confirmPassword !== '' &&
         isPasswordValid.value &&
         form.password === form.confirmPassword
})

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const validateForm = () => {
  let isValid = true
  errors.username = ''
  errors.email = ''
  errors.password = ''
  errors.confirmPassword = ''

  if (form.username.trim() === '') {
    errors.username = '用户名不能为空'
    isValid = false
  } else if (form.username.length > 20) {
    errors.username = '用户名不能超过20个字符'
    isValid = false
  }

  if (form.email.trim() === '') {
    errors.email = '邮箱不能为空'
    isValid = false
  } else if (!validateEmail(form.email.trim())) {
    errors.email = '邮箱格式不正确'
    isValid = false
  }

  if (form.password === '') {
    errors.password = '密码不能为空'
    isValid = false
  } else if (!isPasswordValid.value) {
    errors.password = '密码不符合要求'
    isValid = false
  }

  if (form.confirmPassword === '') {
    errors.confirmPassword = '请确认密码'
    isValid = false
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = '两次密码不一致'
    isValid = false
  }

  return isValid
}

const handleSubmit = async () => {
  if (!validateForm()) return

  submitting.value = true
  error.value = ''

  try {
    const response = await register(form.username, form.email, form.password)
    setAuth(response.data.token, response.data.user)
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.error || '注册失败，请稍后重试'
    console.error(err)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (isAuthenticated()) {
    router.push('/')
  }
})
</script>

<style scoped>
.register-container {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
}

.register-card {
  background: white;
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.register-card h2 {
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
  margin-bottom: 18px;
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

.password-tips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  font-size: 0.8rem;
  color: #999;
}

.password-tips span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.password-tips span.valid {
  color: #27ae60;
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

.login-link {
  text-align: center;
  margin-top: 25px;
  color: #666;
  font-size: 0.95rem;
}

.login-link a {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s;
}

.login-link a:hover {
  color: #764ba2;
}
</style>
