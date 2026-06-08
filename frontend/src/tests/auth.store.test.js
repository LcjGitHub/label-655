import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '../store/auth.js'

const TOKEN_KEY = 'message_board_token'
const USER_KEY = 'message_board_user'

describe('Auth Store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('初始状态为未登录', () => {
    const authStore = useAuthStore()
    expect(authStore.isLoggedIn.value).toBe(false)
    expect(authStore.currentUser.value).toBeNull()
    expect(authStore.getToken()).toBeNull()
  })

  it('setAuth 应该正确设置 token 和用户信息并持久化到 localStorage', () => {
    const authStore = useAuthStore()
    const mockToken = 'test-jwt-token-12345'
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com'
    }

    authStore.setAuth(mockToken, mockUser)

    expect(authStore.isLoggedIn.value).toBe(true)
    expect(authStore.getToken()).toBe(mockToken)
    expect(authStore.currentUser.value).toEqual(mockUser)
    expect(localStorage.getItem(TOKEN_KEY)).toBe(mockToken)
    expect(localStorage.getItem(USER_KEY)).toBe(JSON.stringify(mockUser))
  })

  it('clearAuth 应该清除 token 和用户信息', () => {
    const authStore = useAuthStore()
    authStore.setAuth('test-token', { id: 1, username: 'test' })

    authStore.clearAuth()

    expect(authStore.isLoggedIn.value).toBe(false)
    expect(authStore.getToken()).toBeNull()
    expect(authStore.currentUser.value).toBeNull()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(USER_KEY)).toBeNull()
  })

  it('应该从 localStorage 恢复已保存的 token（刷新页面后保持登录状态）', async () => {
    const mockToken = 'persisted-token'
    localStorage.setItem(TOKEN_KEY, mockToken)

    vi.resetModules()
    const { useAuthStore: useAuthStoreReloaded } = await import('../store/auth.js')
    const authStore = useAuthStoreReloaded()

    expect(authStore.isLoggedIn.value).toBe(true)
    expect(authStore.getToken()).toBe(mockToken)
  })

  it('应该从 localStorage 恢复用户信息', async () => {
    const mockUser = { id: 2, username: 'persistedUser', email: 'persist@test.com' }
    localStorage.setItem(USER_KEY, JSON.stringify(mockUser))

    vi.resetModules()
    const { useAuthStore: useAuthStoreReloaded } = await import('../store/auth.js')
    const authStore = useAuthStoreReloaded()

    expect(authStore.currentUser.value).toEqual(mockUser)
  })

  it('当 localStorage 中的用户信息为无效 JSON 时应该返回 null', async () => {
    localStorage.setItem(USER_KEY, 'invalid-json-data')

    vi.resetModules()
    const { useAuthStore: useAuthStoreReloaded } = await import('../store/auth.js')
    const authStore = useAuthStoreReloaded()

    expect(authStore.currentUser.value).toBeNull()
  })

  it('多次调用 setAuth 应该覆盖之前的状态', () => {
    const authStore = useAuthStore()

    authStore.setAuth('token1', { id: 1, username: 'user1' })
    expect(authStore.currentUser.value.username).toBe('user1')

    authStore.setAuth('token2', { id: 2, username: 'user2' })
    expect(authStore.getToken()).toBe('token2')
    expect(authStore.currentUser.value.username).toBe('user2')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('token2')
  })
})
