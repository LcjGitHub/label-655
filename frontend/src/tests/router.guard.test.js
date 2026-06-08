import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAdminStore } from '../store/admin.js'

vi.mock('../store/admin.js')

describe('Router Guard - 路由守卫', () => {
  let router
  let beforeEachHandler

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    vi.doMock('vue-router', () => ({
      createRouter: vi.fn((config) => {
        router = {
          beforeEach: vi.fn((handler) => {
            beforeEachHandler = handler
          }),
          push: vi.fn(),
          currentRoute: { value: { path: '/' } },
          options: config
        }
        return router
      }),
      createWebHistory: vi.fn()
    }))

    vi.resetModules()
  })

  const loadRouter = async () => {
    const { default: routerInstance } = await import('../router/index.js')
    return routerInstance
  }

  it('访问无需认证的页面（如首页）应该直接通过', async () => {
    await loadRouter()
    const next = vi.fn()

    beforeEachHandler(
      { path: '/', meta: {} },
      { path: '/login' },
      next
    )

    expect(next).toHaveBeenCalledWith()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('访问登录页面应该直接通过', async () => {
    await loadRouter()
    const next = vi.fn()

    beforeEachHandler(
      { path: '/login', meta: {} },
      { path: '/' },
      next
    )

    expect(next).toHaveBeenCalledWith()
  })

  it('访问注册页面应该直接通过', async () => {
    await loadRouter()
    const next = vi.fn()

    beforeEachHandler(
      { path: '/register', meta: {} },
      { path: '/' },
      next
    )

    expect(next).toHaveBeenCalledWith()
  })

  it('未登录管理员访问管理后台应该跳转到管理员登录页', async () => {
    useAdminStore.mockReturnValue({
      isLoggedIn: { value: false },
      getToken: vi.fn(() => null)
    })

    await loadRouter()
    const next = vi.fn()

    beforeEachHandler(
      { path: '/admin/dashboard', meta: { requiresAdmin: true } },
      { path: '/' },
      next
    )

    expect(next).toHaveBeenCalledWith('/admin/login')
  })

  it('已登录管理员访问管理后台应该直接通过', async () => {
    useAdminStore.mockReturnValue({
      isLoggedIn: { value: true },
      getToken: vi.fn(() => 'admin-token')
    })

    await loadRouter()
    const next = vi.fn()

    beforeEachHandler(
      { path: '/admin/dashboard', meta: { requiresAdmin: true } },
      { path: '/admin/login' },
      next
    )

    expect(next).toHaveBeenCalledWith()
    expect(next).not.toHaveBeenCalledWith('/admin/login')
  })

  it('未登录管理员访问通知中心应该跳转到管理员登录页', async () => {
    useAdminStore.mockReturnValue({
      isLoggedIn: { value: false },
      getToken: vi.fn(() => null)
    })

    await loadRouter()
    const next = vi.fn()

    beforeEachHandler(
      { path: '/admin/notifications', meta: { requiresAdmin: true } },
      { path: '/' },
      next
    )

    expect(next).toHaveBeenCalledWith('/admin/login')
  })
})
