import { vi, beforeEach } from 'vitest'
import { config } from '@vue/test-utils'

let store = {}
const localStorageMock = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => {
    store[key] = value.toString()
  },
  removeItem: (key) => {
    delete store[key]
  },
  clear: () => {
    store = {}
  }
}

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
})

config.global.mocks = {
  $t: (key) => key
}

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    currentRoute: { value: { path: '/' } }
  }),
  useRoute: () => ({
    path: '/',
    meta: {}
  }),
  createRouter: () => ({
    beforeEach: vi.fn(),
    push: vi.fn(),
    currentRoute: { value: { path: '/' } }
  }),
  createWebHistory: vi.fn(),
  RouterLink: {
    template: '<a><slot /></a>'
  }
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})
