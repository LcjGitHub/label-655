<template>
  <div class="pagination" v-if="pagination.totalPages > 1">
    <div class="pagination-info">
      共 {{ pagination.total }} 条，第 {{ pagination.currentPage }} / {{ pagination.totalPages }} 页
    </div>

    <div class="pagination-controls">
      <button
        @click="changePage(1)"
        :disabled="loading || !pagination.hasPrev"
        class="page-btn"
      >
        首页
      </button>

      <button
        @click="changePage(pagination.currentPage - 1)"
        :disabled="loading || !pagination.hasPrev"
        class="page-btn"
      >
        上一页
      </button>

      <div class="page-numbers">
        <button
          v-for="page in visiblePages"
          :key="page"
          @click="changePage(page)"
          :disabled="loading"
          :class="['page-num', { active: page === pagination.currentPage }]"
        >
          {{ page }}
        </button>
      </div>

      <button
        @click="changePage(pagination.currentPage + 1)"
        :disabled="loading || !pagination.hasNext"
        class="page-btn"
      >
        下一页
      </button>

      <button
        @click="changePage(pagination.totalPages)"
        :disabled="loading || !pagination.hasNext"
        class="page-btn"
      >
        末页
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  pagination: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['page-change'])

const visiblePages = computed(() => {
  const { currentPage, totalPages } = props.pagination
  const pages = []
  let start = Math.max(1, currentPage - 2)
  let end = Math.min(totalPages, currentPage + 2)

  if (end - start < 4) {
    if (start === 1) {
      end = Math.min(5, totalPages)
    } else if (end === totalPages) {
      start = Math.max(1, totalPages - 4)
    }
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return pages
})

const changePage = (page) => {
  if (page >= 1 && page <= props.pagination.totalPages && page !== props.pagination.currentPage) {
    emit('page-change', page)
  }
}
</script>

<style scoped>
.pagination {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  padding-top: 20px;
  border-top: 1px solid #e8e8e8;
}

.pagination-info {
  color: #666;
  font-size: 0.9rem;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.page-btn,
.page-num {
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  background: white;
  color: #555;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled),
.page-num:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
}

.page-btn:disabled,
.page-num:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-num.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
}

.page-numbers {
  display: flex;
  gap: 5px;
}
</style>
