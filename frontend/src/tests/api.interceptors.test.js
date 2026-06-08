import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')

describe('API Interceptors - API 拦截器', () => {
  let requestInterceptor
  let responseSuccessInterceptor
  let responseErrorInterceptor
  let mockAxiosInstance
  let mockRouterInstance
  let apiModule
  let useAuthStoreFn
  let useAdminStoreFn

  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()

    mockAxiosInstance = {
      interceptors: {
        request: {
          use: vi.fn((successFn) => {
            requestInterceptor = successFn
          })
        },
        response: {
          use: vi.fn((successFn, errorFn) => {
            responseSuccessInterceptor = successFn
            responseErrorInterceptor = errorFn
          })
        }
      },
      post: vi.fn(),
      get: vi.fn()
    }

    axios.create.mockReturnValue(mockAxiosInstance)

    mockRouterInstance = {
      push: vi.fn(),
      currentRoute: { value: { path: '/' } }
    }

    vi.resetModules()
    apiModule = await import('../utils/api.js')
    const authStoreModule = await import('../store/auth.js')
    const adminStoreModule = await import('../store/admin.js')
    useAuthStoreFn = authStoreModule.useAuthStore
    useAdminStoreFn = adminStoreModule.useAdminStore
    apiModule.setupApiInterceptors(mockRouterInstance)
  })

  describe('Request Interceptor - 请求拦截器', () => {
    it('普通用户 API 请求应该附加用户 token 到 Authorization header', () => {
      const authStore = useAuthStoreFn()
      authStore.setAuth('user-token-abc', { id: 1, username: 'testuser' })

      const config = {
        url: '/auth/user',
        headers: {}
      }

      const result = requestInterceptor(config)

      expect(result.headers.Authorization).toBe('Bearer user-token-abc')
    })

    it('管理员 API 请求应该附加管理员 token 到 Authorization header', () => {
      const adminStore = useAdminStoreFn()
      adminStore.setAuth('admin-token-xyz', { id: 1, username: 'admin' })

      const config = {
        url: '/admin/stats',
        headers: {}
      }

      const result = requestInterceptor(config)

      expect(result.headers.Authorization).toBe('Bearer admin-token-xyz')
    })

    it('没有 token 时不应该附加 Authorization header', () => {
      const config = {
        url: '/messages',
        headers: {}
      }

      const result = requestInterceptor(config)

      expect(result.headers.Authorization).toBeUndefined()
    })
  })

  describe('Response Interceptor - 响应拦截器', () => {
    it('成功响应应该正常返回', () => {
      const mockResponse = {
        status: 200,
        data: { success: true }
      }

      const result = responseSuccessInterceptor(mockResponse)

      expect(result).toEqual(mockResponse)
    })

    it('普通用户 API 返回 401 应该清除认证信息并跳转登录页', async () => {
      const authStore = useAuthStoreFn()
      authStore.setAuth('expired-token', { id: 1, username: 'testuser' })

      mockRouterInstance.currentRoute.value.path = '/some-protected-page'

      const error = {
        response: { status: 401 },
        config: { url: '/auth/user' }
      }

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error)

      expect(authStore.isLoggedIn.value).toBe(false)
      expect(authStore.getToken()).toBeNull()
      expect(mockRouterInstance.push).toHaveBeenCalledWith('/login')
    })

    it('普通用户 API 返回 403 应该清除认证信息并跳转登录页', async () => {
      const authStore = useAuthStoreFn()
      authStore.setAuth('invalid-token', { id: 1, username: 'testuser' })

      mockRouterInstance.currentRoute.value.path = '/some-page'

      const error = {
        response: { status: 403 },
        config: { url: '/messages' }
      }

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error)

      expect(authStore.isLoggedIn.value).toBe(false)
      expect(mockRouterInstance.push).toHaveBeenCalledWith('/login')
    })

    it('管理员 API 返回 401 应该清除管理员认证信息并跳转管理员登录页', async () => {
      const adminStore = useAdminStoreFn()
      adminStore.setAuth('expired-admin-token', { id: 1, username: 'admin' })

      mockRouterInstance.currentRoute.value.path = '/admin/dashboard'

      const error = {
        response: { status: 401 },
        config: { url: '/admin/messages' }
      }

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error)

      expect(adminStore.isLoggedIn.value).toBe(false)
      expect(adminStore.getToken()).toBeNull()
      expect(mockRouterInstance.push).toHaveBeenCalledWith('/admin/login')
    })

    it('当前已在登录页时不应该重复跳转登录页', async () => {
      const authStore = useAuthStoreFn()
      authStore.setAuth('expired-token', { id: 1, username: 'testuser' })

      mockRouterInstance.currentRoute.value.path = '/login'

      const error = {
        response: { status: 401 },
        config: { url: '/auth/user' }
      }

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error)

      expect(mockRouterInstance.push).not.toHaveBeenCalled()
    })

    it('当前已在注册页时不应该跳转到登录页', async () => {
      mockRouterInstance.currentRoute.value.path = '/register'

      const error = {
        response: { status: 401 },
        config: { url: '/auth/user' }
      }

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error)

      expect(mockRouterInstance.push).not.toHaveBeenCalled()
    })

    it('非 401/403 错误应该正常抛出不做处理', async () => {
      const authStore = useAuthStoreFn()
      authStore.setAuth('valid-token', { id: 1, username: 'testuser' })

      const error = {
        response: { status: 500, data: { error: '服务器错误' } },
        config: { url: '/messages' }
      }

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error)

      expect(authStore.isLoggedIn.value).toBe(true)
      expect(mockRouterInstance.push).not.toHaveBeenCalled()
    })
  })
})
