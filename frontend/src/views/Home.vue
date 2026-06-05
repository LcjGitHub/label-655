<template>
  <div class="home">
    <MessageForm @submitted="handleMessageSubmitted" />
    <MessageList
      :messages="messages"
      :loading="loading"
      :error="error"
    />
    <Pagination
      :pagination="pagination"
      :loading="loading"
      @page-change="handlePageChange"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import MessageForm from '../components/MessageForm.vue'
import MessageList from '../components/MessageList.vue'
import Pagination from '../components/Pagination.vue'
import { getMessages } from '../utils/api.js'

const messages = ref([])
const loading = ref(false)
const error = ref('')

const pagination = reactive({
  currentPage: 1,
  pageSize: 5,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false
})

const fetchMessages = async (page = 1) => {
  loading.value = true
  error.value = ''
  try {
    const response = await getMessages(page, pagination.pageSize)
    messages.value = response.data.messages
    Object.assign(pagination, response.data.pagination)
  } catch (err) {
    error.value = '获取留言列表失败，请稍后重试'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const handlePageChange = (page) => {
  fetchMessages(page)
}

const handleMessageSubmitted = () => {
  fetchMessages(1)
}

onMounted(() => {
  fetchMessages(1)
})
</script>

<style scoped>
.home {
  padding: 30px;
}
</style>
