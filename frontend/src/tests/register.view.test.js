import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import Register from '../views/Register.vue'
import * as api from '../utils/api.js'
import { useAuthStore } from '../store/auth.js'

vi.mock('../utils/api.js')

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  currentRoute: { value: { path: '/register' } }
}

vi.mock('vue-router', async () => {
  const actual = await vi.importActual('vue-router')
  return {
    ...actual,
    useRouter: () => mockRouter
  }
})

describe('Register.vue - 注册组件', () => {
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
        { path: '/register', component: Register },
        { path: '/', component: { template: '<div>Home</div>' } }
      ]
    })
    return mount(Register, {
      global: {
        plugins: [router],
        stubs: {
          RouterLink: { template: '<a><slot /></a>' }
        }
      }
    })
  }

  const fillValidForm = async (wrapper) => {
    await wrapper.find('#username').setValue('testuser')
    await wrapper.find('#email').setValue('test@example.com')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('#confirmPassword').setValue('password123')
  }

  describe('表单验证', () => {
    it('空用户名应该显示错误提示', async () => {
      const wrapper = createWrapper()

      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.text()).toContain('用户名不能为空')
    })

    it('超过20个字符的用户名应该显示错误', async () => {
      const wrapper = createWrapper()

      await wrapper.find('#username').setValue('a'.repeat(21))
      await wrapper.find('#email').setValue('test@example.com')
      await wrapper.find('#password').setValue('password123')
      await wrapper.find('#confirmPassword').setValue('password123')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.text()).toContain('用户名不能超过20个字符')
    })

    it('空邮箱应该显示错误提示', async () => {
      const wrapper = createWrapper()

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.text()).toContain('邮箱不能为空')
    })

    it('无效邮箱格式应该显示错误提示', async () => {
      const wrapper = createWrapper()

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#email').setValue('invalid-email')
      await wrapper.find('#password').setValue('password123')
      await wrapper.find('#confirmPassword').setValue('password123')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.text()).toContain('邮箱格式不正确')
    })

    it('空密码应该显示错误提示', async () => {
      const wrapper = createWrapper()

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#email').setValue('test@example.com')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.text()).toContain('密码不能为空')
    })

    it('密码长度不足8位应该显示错误', async () => {
      const wrapper = createWrapper()

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#email').setValue('test@example.com')
      await wrapper.find('#password').setValue('pass1')
      await wrapper.find('#confirmPassword').setValue('pass1')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.text()).toContain('密码不符合要求')
    })

    it('密码不包含字母应该显示错误', async () => {
      const wrapper = createWrapper()

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#email').setValue('test@example.com')
      await wrapper.find('#password').setValue('12345678')
      await wrapper.find('#confirmPassword').setValue('12345678')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.text()).toContain('密码不符合要求')
    })

    it('密码不包含数字应该显示错误', async () => {
      const wrapper = createWrapper()

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#email').setValue('test@example.com')
      await wrapper.find('#password').setValue('password')
      await wrapper.find('#confirmPassword').setValue('password')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.text()).toContain('密码不符合要求')
    })

    it('空确认密码应该显示错误提示', async () => {
      const wrapper = createWrapper()

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#email').setValue('test@example.com')
      await wrapper.find('#password').setValue('password123')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.text()).toContain('请确认密码')
    })

    it('两次密码不一致应该显示错误提示', async () => {
      const wrapper = createWrapper()

      await wrapper.find('#username').setValue('testuser')
      await wrapper.find('#email').setValue('test@example.com')
      await wrapper.find('#password').setValue('password123')
      await wrapper.find('#confirmPassword').setValue('different456')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.text()).toContain('两次密码不一致')
    })

    it('完全符合要求的表单应该没有验证错误', async () => {
      const wrapper = createWrapper()

      api.register.mockResolvedValue({
        data: {
          token: 'test-token',
          user: { id: 1, username: 'testuser' }
        }
      })

      await fillValidForm(wrapper)
      await wrapper.find('form').trigger('submit.prevent')

      const fieldErrors = wrapper.findAll('.field-error')
      expect(fieldErrors.length).toBe(0)
    })
  })

  describe('注册成功场景', () => {
    it('注册成功应该调用 API 并使用正确参数', async () => {
      const wrapper = createWrapper()

      api.register.mockResolvedValue({
        data: {
          token: 'new-jwt-token',
          user: { id: 1, username: 'newuser', email: 'new@example.com' }
        }
      })

      await fillValidForm(wrapper)
      await wrapper.find('form').trigger('submit.prevent')

      expect(api.register).toHaveBeenCalledWith('testuser', 'test@example.com', 'password123')
      expect(api.register).toHaveBeenCalledTimes(1)
    })

    it('注册成功应该保存 token 和用户信息到 store 和 localStorage', async () => {
      const wrapper = createWrapper()
      const mockToken = 'new-jwt-token-789'
      const mockUser = { id: 1, username: 'newuser', email: 'new@example.com' }

      api.register.mockResolvedValue({
        data: { token: mockToken, user: mockUser }
      })

      await fillValidForm(wrapper)
      await wrapper.find('form').trigger('submit.prevent')

      const authStore = useAuthStore()
      expect(authStore.isLoggedIn.value).toBe(true)
      expect(authStore.getToken()).toBe(mockToken)
      expect(authStore.currentUser.value).toEqual(mockUser)
      expect(localStorage.getItem('message_board_token')).toBe(mockToken)
    })

    it('注册成功应该跳转到首页', async () => {
      const wrapper = createWrapper()

      api.register.mockResolvedValue({
        data: {
          token: 'new-jwt-token',
          user: { id: 1, username: 'newuser' }
        }
      })

      await fillValidForm(wrapper)
      await wrapper.find('form').trigger('submit.prevent')

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockRouter.push).toHaveBeenCalledWith('/')
    })
  })

  describe('注册失败场景', () => {
    it('用户名已存在应该显示后端返回的错误信息', async () => {
      const wrapper = createWrapper()

      api.register.mockRejectedValue({
        response: {
          data: { error: '用户名已存在' }
        }
      })

      await fillValidForm(wrapper)
      await wrapper.find('form').trigger('submit.prevent')

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.text()).toContain('用户名已存在')
    })

    it('邮箱已注册应该显示后端返回的错误信息', async () => {
      const wrapper = createWrapper()

      api.register.mockRejectedValue({
        response: {
          data: { error: '该邮箱已被注册' }
        }
      })

      await fillValidForm(wrapper)
      await wrapper.find('form').trigger('submit.prevent')

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('该邮箱已被注册')
    })

    it('网络错误应该显示默认错误提示', async () => {
      const wrapper = createWrapper()

      api.register.mockRejectedValue(new Error('Network Error'))

      await fillValidForm(wrapper)
      await wrapper.find('form').trigger('submit.prevent')

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('注册失败，请稍后重试')
    })

    it('注册失败不应该设置登录状态', async () => {
      const wrapper = createWrapper()

      api.register.mockRejectedValue({
        response: { data: { error: '注册失败' } }
      })

      await fillValidForm(wrapper)
      await wrapper.find('form').trigger('submit.prevent')

      const authStore = useAuthStore()
      expect(authStore.isLoggedIn.value).toBe(false)
    })
  })

  describe('用户体验', () => {
    it('提交时按钮应该显示加载状态并被禁用', async () => {
      const wrapper = createWrapper()

      api.register.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: { token: '1', user: {} } }), 100))
      )

      await fillValidForm(wrapper)
      await wrapper.find('form').trigger('submit.prevent')

      const submitBtn = wrapper.find('.submit-btn')
      expect(submitBtn.text()).toContain('注册中...')
      expect(submitBtn.element.disabled).toBe(true)
    })

    it('已登录用户访问注册页应该自动跳转首页', async () => {
      const authStore = useAuthStore()
      authStore.setAuth('existing-token', { id: 1, username: 'existinguser' })

      createWrapper()

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockRouter.push).toHaveBeenCalledWith('/')
    })
  })
})
