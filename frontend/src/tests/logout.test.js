import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'
import { useAuthStore } from '../store/auth.js'
import { useAdminStore } from '../store/admin.js'

vi.mock('../components/NotificationBell.vue', () => ({
  default: { template: '<div class="notification-bell"></div>' }
}))

const mockRouter = {
  push: vi.fn(),
  currentRoute: { value: { path: '/' } }
}

describe('Logout - 登出功能', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  const createWrapper = (routePath = '/') => {
    const testRouter = {
      push: vi.fn(),
      currentRoute: { value: { path: routePath } }
    }

    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/login', component: { template: '<div>Login</div>' } }
      ]
    })

    return {
      wrapper: mount(App, {
        global: {
          plugins: [router],
          mocks: {
            $route: { path: routePath, meta: {} },
            $router: testRouter
          },
          stubs: {
            RouterView: { template: '<div class="router-view"></div>' },
            RouterLink: { template: '<a><slot /></a>' },
            NotificationBell: { template: '<div></div>' }
          }
        }
      }),
      testRouter
    }
  }

  it('登出按钮应该清除 token 和用户信息', async () => {
    const authStore = useAuthStore()
    authStore.setAuth(
      'user-token-123',
      { id: 1, username: 'testuser', email: 'test@example.com' }
    )

    const { wrapper } = createWrapper('/')

    expect(wrapper.find('.logout-btn').exists()).toBe(true)

    await wrapper.find('.logout-btn').trigger('click')

    expect(authStore.isLoggedIn.value).toBe(false)
    expect(authStore.getToken()).toBeNull()
    expect(authStore.currentUser.value).toBeNull()
    expect(localStorage.getItem('message_board_token')).toBeNull()
    expect(localStorage.getItem('message_board_user')).toBeNull()
  })

  it('登出后不应该显示欢迎文字和退出按钮', async () => {
    const authStore = useAuthStore()
    authStore.setAuth('user-token-123', { id: 1, username: 'testuser' })

    const { wrapper } = createWrapper('/')

    expect(wrapper.text()).toContain('testuser')
    expect(wrapper.find('.logout-btn').exists()).toBe(true)

    await wrapper.find('.logout-btn').trigger('click')

    expect(wrapper.text()).not.toContain('testuser')
    expect(wrapper.find('.logout-btn').exists()).toBe(false)
    expect(wrapper.find('.login-btn').exists()).toBe(true)
    expect(wrapper.find('.register-btn').exists()).toBe(true)
  })

  it('未登录状态应该显示登录和注册按钮', () => {
    const { wrapper } = createWrapper('/')

    expect(wrapper.find('.login-btn').exists()).toBe(true)
    expect(wrapper.find('.register-btn').exists()).toBe(true)
    expect(wrapper.find('.logout-btn').exists()).toBe(false)
  })

  it('已登录状态应该显示用户名和退出按钮', () => {
    const authStore = useAuthStore()
    authStore.setAuth('test-token', { id: 1, username: 'loggedInUser' })

    const { wrapper } = createWrapper('/')

    expect(wrapper.text()).toContain('loggedInUser')
    expect(wrapper.find('.logout-btn').exists()).toBe(true)
    expect(wrapper.find('.login-btn').exists()).toBe(false)
    expect(wrapper.find('.register-btn').exists()).toBe(false)
  })
})
