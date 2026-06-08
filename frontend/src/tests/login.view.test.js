import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import * as api from '../utils/api.js'
import { useAuthStore } from '../store/auth.js'

vi.mock('../utils/api.js')

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  currentRoute: { value: { path: '/login' } }
}

vi.mock('vue-router', async () => {
  const actual = await vi.importActual('vue-router')
  return {
    ...actual,
    useRouter: () => mockRouter
  }
})

describe('Login.vue - 登录组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    const authStore = useAuthStore()
    authStore.clearAuth()
    mockRouter.push.mockClear()
  })

  const createWrapper = () => {
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/login', component: Login },
        { path: '/', component: { template: '<div>Home</div>' } }
      ]
    })
    return mount(Login, {
      global: {
        plugins: [router],
        stubs: {
          RouterLink: { template: '<a><slot /></a>' }
        }
      }
    })
  }

  describe('表单验证', () => {
    it('空用户名应该显示错误提示', async () => {
      const wrapper = createWrapper()
      const form = wrapper.find('form')

      await form.trigger('submit.prevent')

      expect(wrapper.find('.field-error').exists()).toBe(true)
      expect(wrapper.text()).toContain('用户名不能为空')
    })

    it('空密码应该显示错误提示', async () => {
      const wrapper = createWrapper()

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.text()).toContain('密码不能为空')
    })

    it('空用户名和密码应该同时显示错误提示', async () => {
      const wrapper = createWrapper()

      await wrapper.find('form').trigger('submit.prevent')

      const errors = wrapper.findAll('.field-error')
      expect(errors.length).toBeGreaterThanOrEqual(2)
      expect(wrapper.text()).toContain('用户名不能为空')
      expect(wrapper.text()).toContain('密码不能为空')
    })

    it('输入有效内容后提交时不显示验证错误', async () => {
      const wrapper = createWrapper()

      api.login.mockResolvedValue({
        data: {
          token: 'test-token',
          user: { id: 1, username: 'testuser' }
        }
      })

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#password').setValue('password123')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.find('.field-error').exists()).toBe(false)
    })
  })

  describe('登录成功场景', () => {
    it('登录成功应该调用 API 并使用正确参数', async () => {
      const wrapper = createWrapper()

      api.login.mockResolvedValue({
        data: {
          token: 'jwt-token-123',
          user: { id: 1, username: 'testuser', email: 'test@example.com' }
        }
      })

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#password').setValue('password123')
      await wrapper.find('form').trigger('submit.prevent')

      expect(api.login).toHaveBeenCalledWith('testuser', 'password123')
      expect(api.login).toHaveBeenCalledTimes(1)
    })

    it('登录成功应该保存 token 和用户信息到 store 和 localStorage', async () => {
      const wrapper = createWrapper()
      const mockToken = 'jwt-token-123'
      const mockUser = { id: 1, username: 'testuser', email: 'test@example.com' }

      api.login.mockResolvedValue({
        data: { token: mockToken, user: mockUser }
      })

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#password').setValue('password123')
      await wrapper.find('form').trigger('submit.prevent')

      const authStore = useAuthStore()
      expect(authStore.isLoggedIn.value).toBe(true)
      expect(authStore.getToken()).toBe(mockToken)
      expect(authStore.currentUser.value).toEqual(mockUser)
      expect(localStorage.getItem('message_board_token')).toBe(mockToken)
    })

    it('登录成功应该跳转到首页', async () => {
      const wrapper = createWrapper()

      api.login.mockResolvedValue({
        data: {
          token: 'jwt-token-123',
          user: { id: 1, username: 'testuser' }
        }
      })

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#password').setValue('password123')
      await wrapper.find('form').trigger('submit.prevent')

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockRouter.push).toHaveBeenCalledWith('/')
    })
  })

  describe('登录失败场景', () => {
    it('错误密码应该显示后端返回的错误信息', async () => {
      const wrapper = createWrapper()

      api.login.mockRejectedValue({
        response: {
          data: { error: '密码错误' }
        }
      })

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#password').setValue('wrongpassword')
      await wrapper.find('form').trigger('submit.prevent')

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.text()).toContain('密码错误')
    })

    it('用户不存在应该显示后端返回的错误信息', async () => {
      const wrapper = createWrapper()

      api.login.mockRejectedValue({
        response: {
          data: { error: '用户不存在' }
        }
      })

      await wrapper.find('#username').setValue('nonexistent')
      await wrapper.find('#password').setValue('password123')
      await wrapper.find('form').trigger('submit.prevent')

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('用户不存在')
    })

    it('网络错误应该显示默认错误提示', async () => {
      const wrapper = createWrapper()

      api.login.mockRejectedValue(new Error('Network Error'))

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#password').setValue('password123')
      await wrapper.find('form').trigger('submit.prevent')

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('登录失败，请稍后重试')
    })

    it('登录失败不应该跳转到首页', async () => {
      const wrapper = createWrapper()

      api.login.mockRejectedValue({
        response: { data: { error: '登录失败' } }
      })

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#password').setValue('wrongpass')
      await wrapper.find('form').trigger('submit.prevent')

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockRouter.push).not.toHaveBeenCalledWith('/')
    })
  })

  describe('用户体验', () => {
    it('提交时按钮应该显示加载状态并被禁用', async () => {
      const wrapper = createWrapper()

      api.login.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: { token: '1', user: {} } }), 100))
      )

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#password').setValue('password123')
      await wrapper.find('form').trigger('submit.prevent')

      const submitBtn = wrapper.find('.submit-btn')
      expect(submitBtn.text()).toContain('登录中...')
      expect(submitBtn.element.disabled).toBe(true)
    })

    it('已登录用户访问登录页应该自动跳转首页', async () => {
      const authStore = useAuthStore()
      authStore.setAuth('existing-token', { id: 1, username: 'existinguser' })

      createWrapper()

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockRouter.push).toHaveBeenCalledWith('/')
    })
  })
})
