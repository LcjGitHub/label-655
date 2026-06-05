<template>
  <div class="app-container">
    <header class="app-header">
      <h1>📝 留言板系统</h1>
      <p class="subtitle">分享你的想法，与大家交流</p>
    </header>
    <router-view />
  </div>
</template>

<script setup>
</script>

<style scoped>
.app-container {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 40px 30px;
  text-align: center;
}

.app-header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
  font-weight: 700;
}

.subtitle {
  font-size: 1.1rem;
  opacity: 0.9;
  font-weight: 300;
}
</style>
