import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { setupApiInterceptors } from './utils/api.js'
import './style.css'

setupApiInterceptors(router)

const app = createApp(App)
app.use(router)
app.mount('#app')
