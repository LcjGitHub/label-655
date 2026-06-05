import { reactive, computed } from 'vue'

const ADMIN_TOKEN_KEY = 'admin_token'
const ADMIN_KEY = 'admin_info'

const state = reactive({
  token: localStorage.getItem(ADMIN_TOKEN_KEY) || null,
  admin: null
})

const initAdmin = () => {
  const adminStr = localStorage.getItem(ADMIN_KEY)
  if (adminStr) {
    try {
      state.admin = JSON.parse(adminStr)
    } catch (e) {
      state.admin = null
    }
  }
}

initAdmin()

export const useAdminStore = () => {
  const isLoggedIn = computed(() => !!state.token)
  const currentAdmin = computed(() => state.admin)

  const setAuth = (token, admin) => {
    state.token = token
    state.admin = admin
    localStorage.setItem(ADMIN_TOKEN_KEY, token)
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin))
  }

  const clearAuth = () => {
    state.token = null
    state.admin = null
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    localStorage.removeItem(ADMIN_KEY)
  }

  const getToken = () => state.token

  return {
    isLoggedIn,
    currentAdmin,
    setAuth,
    clearAuth,
    getToken
  }
}
