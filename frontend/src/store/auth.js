import { reactive, computed } from 'vue'

const TOKEN_KEY = 'message_board_token'
const USER_KEY = 'message_board_user'

const state = reactive({
  token: localStorage.getItem(TOKEN_KEY) || null,
  user: null
})

const initUser = () => {
  const userStr = localStorage.getItem(USER_KEY)
  if (userStr) {
    try {
      state.user = JSON.parse(userStr)
    } catch (e) {
      state.user = null
    }
  }
}

initUser()

export const useAuthStore = () => {
  const isLoggedIn = computed(() => !!state.token)
  const currentUser = computed(() => state.user)

  const setAuth = (token, user) => {
    state.token = token
    state.user = user
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }

  const clearAuth = () => {
    state.token = null
    state.user = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  const getToken = () => state.token

  return {
    isLoggedIn,
    currentUser,
    setAuth,
    clearAuth,
    getToken
  }
}
