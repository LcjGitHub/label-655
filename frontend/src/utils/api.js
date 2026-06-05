import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const getMessages = (page = 1, pageSize = 5) => {
  return api.get('/messages', {
    params: { page, pageSize }
  })
}

export const submitMessage = (username, content) => {
  return api.post('/messages', { username, content })
}

export default api
