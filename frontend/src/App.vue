<template>
  <div class="app-container" :class="{ 'admin-container': isAdminDashboard }">
    <header v-if="!isAdminDashboard" class="app-header">
      <div class="header-content">
        <div class="header-title" @click="goHome">
          <h1>📝 留言板系统</h1>
          <p class="subtitle">分享你的想法，与大家交流</p>
        </div>
        <nav class="nav-menu">
          <NotificationBell />
          <router-link to="/admin/login" class="nav-btn admin-link">
            🛡️ 管理后台
          </router-link>
          <template v-if="isLoggedIn">
            <div class="user-info-nav">
              <span class="welcome-text">
                👤 {{ currentUser?.username }}
              </span>
              <LevelBadge
                v-if="currentUser?.level"
                :level="currentUser.level"
                :icon="currentUser.level_info?.icon"
                :points="currentUser.points"
              />
              <span class="user-points" title="当前积分">
                🏆 {{ currentUser?.points ?? 0 }}
              </span>
            </div>
            <button class="nav-btn logout-btn" @click="handleUserLogout">退出登录</button>
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
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from './store/auth.js'
import { useAdminStore } from './store/admin.js'
import NotificationBell from './components/NotificationBell.vue'
import LevelBadge from './components/LevelBadge.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const adminStore = useAdminStore()

const isLoggedIn = authStore.isLoggedIn
const currentUser = authStore.currentUser
const currentAdmin = adminStore.currentAdmin

const isAdminDashboard = computed(() => route.path === '/admin/dashboard')

const goHome = () => {
  router.push('/')
}

const handleUserLogout = () => {
  authStore.clearAuth()
  if (route.path !== '/') {
    router.push('/')
  }
}

const handleAdminLogout = () => {
  adminStore.clearAuth()
  router.push('/admin/login')
}

onMounted(async () => {
  if (isLoggedIn.value && !currentUser.value?.points) {
    await authStore.refreshUserInfo()
  }
})
</script>

<style scoped>
.app-container {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.app-container.admin-container {
  background: none;
  border-radius: 0;
  box-shadow: none;
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

.user-info-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.15);
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.welcome-text {
  font-size: 0.95rem;
}

.user-points {
  font-size: 0.85rem;
  font-weight: 600;
  background: rgba(255, 215, 0, 0.2);
  padding: 2px 8px;
  border-radius: 10px;
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

.admin-link {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.4);
}

.admin-link:hover {
  background: rgba(255, 255, 255, 0.25);
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
    flex-wrap: wrap;
  }

  .app-header h1 {
    font-size: 1.5rem;
  }
}
</style>
