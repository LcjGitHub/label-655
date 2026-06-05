import axios from 'axios'

const TOKEN_KEY = 'message_board_token'
const USER_KEY = 'message_board_user'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY)
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
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const setAuth = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY)
}

export const getCurrentUser = () => {
  const userStr = localStorage.getItem(USER_KEY)
  return userStr ? JSON.parse(userStr) : null
}

export const isAuthenticated = () => {
  return !!getToken()
}

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

export default api
