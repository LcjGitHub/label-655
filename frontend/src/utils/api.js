import axios from 'axios'
import { useAuthStore } from '../store/auth.js'

const api = axios.create({
  baseURL: '/api',
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
    const authStore = useAuthStore()
    const token = authStore.getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
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
      const authStore = useAuthStore()
      authStore.clearAuth()
      
      if (routerInstance) {
        const currentPath = routerInstance.currentRoute.value.path
        if (currentPath !== '/login' && currentPath !== '/register') {
          routerInstance.push('/login')
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

export const submitMessage = (content) => {
  return api.post('/messages', { content })
}

export const getReplies = (messageId) => {
  return api.get(`/messages/${messageId}/replies`)
}

export const submitReply = (messageId, content, parentReplyId = null) => {
  return api.post(`/messages/${messageId}/replies`, { content, parentReplyId })
}

export const toggleLike = (messageId) => {
  return api.post(`/messages/${messageId}/like`)
}

export default api
