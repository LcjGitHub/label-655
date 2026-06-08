import axios from 'axios'
import { useAuthStore } from '../store/auth.js'
import { useAdminStore } from '../store/admin.js'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

let routerInstance = null

export const setupApiInterceptors = (router) => {
  routerInstance = router
}

api.interceptors.request.use(
  (config) => {
    if (config.url.startsWith('/admin/')) {
      const adminStore = useAdminStore()
      const token = adminStore.getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } else {
      const authStore = useAuthStore()
      const token = authStore.getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      const config = error.config || {}
      const isAdminApi = config.url && config.url.includes('/admin/')

      if (isAdminApi) {
        const adminStore = useAdminStore()
        adminStore.clearAuth()
        if (routerInstance) {
          const currentPath = routerInstance.currentRoute.value.path
          if (currentPath !== '/admin/login') {
            routerInstance.push('/admin/login')
          }
        }
      } else {
        const authStore = useAuthStore()
        authStore.clearAuth()
        if (routerInstance) {
          const currentPath = routerInstance.currentRoute.value.path
          if (currentPath !== '/login' && currentPath !== '/register') {
            routerInstance.push('/login')
          }
        }
      }
    }
    return Promise.reject(error)
  }
)

export const register = (username, email, password) => {
  return api.post('/auth/register', { username, email, password })
}

export const login = (username, password) => {
  return api.post('/auth/login', { username, password })
}

export const getCurrentUserInfo = () => {
  return api.get('/auth/user')
}

export const getMessages = (page = 1, pageSize = 5) => {
  return api.get('/messages', {
    params: { page, pageSize }
  })
}

export const submitMessage = (content, avatar = null) => {
  return api.post('/messages', { content, avatar })
}

export const uploadAvatar = (formData) => {
  return api.post('/upload/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

export const uploadImage = (formData) => {
  return api.post('/upload/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

export const getReplies = (messageId) => {
  return api.get(`/messages/${messageId}/replies`)
}

export const submitReply = (messageId, content, parentReplyId = null, avatar = null) => {
  return api.post(`/messages/${messageId}/replies`, { content, parentReplyId, avatar })
}

export const toggleLike = (messageId) => {
  return api.post(`/messages/${messageId}/like`)
}

export const updateMessage = (messageId, content) => {
  return api.put(`/messages/${messageId}`, { content })
}

export const getStats = (forceRefresh = false) => {
  const params = {}
  if (forceRefresh) params.refresh = 'true'
  return api.get('/stats', { params })
}

export const adminLogin = (username, password) => {
  return api.post('/admin/login', { username, password })
}

export const getAdminInfo = () => {
  return api.get('/admin/me')
}

export const getAdminStats = () => {
  return api.get('/admin/stats')
}

export const getAdminMessages = (page = 1, pageSize = 10, status = null) => {
  const params = { page, pageSize }
  if (status) params.status = status
  return api.get('/admin/messages', { params })
}

export const reviewMessage = (messageId, status) => {
  return api.put(`/admin/messages/${messageId}/review`, { status })
}

export const deleteMessage = (messageId) => {
  return api.delete(`/admin/messages/${messageId}`)
}

export const batchReviewMessages = (ids, status) => {
  return api.post('/admin/messages/batch-review', { ids, status })
}

export const batchDeleteMessages = (ids) => {
  return api.post('/admin/messages/batch-delete', { ids })
}

export const pinMessage = (messageId) => {
  return api.put(`/admin/messages/${messageId}/pin`)
}

export const unpinMessage = (messageId) => {
  return api.put(`/admin/messages/${messageId}/unpin`)
}

export const getNotifications = (page = 1, pageSize = 10, isRead = null) => {
  const params = { page, pageSize }
  if (isRead !== null) params.isRead = isRead
  return api.get('/admin/notifications', { params })
}

export const getRecentNotifications = () => {
  return api.get('/admin/notifications/recent')
}

export const getUnreadNotificationCount = () => {
  return api.get('/admin/notifications/unread-count')
}

export const markNotificationAsRead = (notificationId) => {
  return api.put(`/admin/notifications/${notificationId}/read`)
}

export const markAllNotificationsAsRead = () => {
  return api.put('/admin/notifications/read-all')
}

export default api
