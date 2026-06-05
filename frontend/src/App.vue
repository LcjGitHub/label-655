<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-content">
        <div class="header-title" @click="goHome">
          <h1>📝 留言板系统</h1>
          <p class="subtitle">分享你的想法，与大家交流</p>
        </div>
        <nav class="nav-menu">
          <template v-if="isLoggedIn">
            <span class="welcome-text">👤 {{ currentUser?.username }}</span>
            <button class="nav-btn logout-btn" @click="handleLogout">退出登录</button>
          </template>
          <template v-else>
            <router-link to="/login" class="nav-btn login-btn">登录</router-link>
            <router-link to="/register" class="nav-btn register-btn">注册</router-link>
          </template>
        </nav>
      </div>
    </header>
    <router-view />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { isAuthenticated, getCurrentUser, clearAuth } from './utils/api.js'

const router = useRouter()
const route = useRoute()

const isLoggedIn = ref(false)
const currentUser = ref(null)

const updateAuthStatus = () => {
  isLoggedIn.value = isAuthenticated()
  currentUser.value = getCurrentUser()
}

const goHome = () => {
  router.push('/')
}

const handleLogout = () => {
  clearAuth()
  updateAuthStatus()
  if (route.path !== '/') {
    router.push('/')
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
.app-container {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.header-title {
  cursor: pointer;
  text-align: left;
}

.app-header h1 {
  font-size: 2rem;
  margin-bottom: 5px;
  font-weight: 700;
}

.subtitle {
  font-size: 1rem;
  opacity: 0.9;
  font-weight: 300;
  margin: 0;
}

.nav-menu {
  display: flex;
  align-items: center;
  gap: 12px;
}

.welcome-text {
  font-size: 0.95rem;
  margin-right: 8px;
}

.nav-btn {
  display: inline-block;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  font-size: 0.9rem;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
}

.login-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.5);
}

.login-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: white;
}

.register-btn {
  background: white;
  color: #667eea;
  border: 2px solid white;
}

.register-btn:hover {
  background: #f0f0f0;
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.logout-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.5);
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: white;
}

@media (max-width: 600px) {
  .header-content {
    flex-direction: column;
    text-align: center;
  }

  .header-title {
    text-align: center;
  }

  .nav-menu {
    justify-content: center;
  }

  .app-header h1 {
    font-size: 1.5rem;
  }
}
</style>
