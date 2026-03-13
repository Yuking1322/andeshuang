import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import './styles/colors.css'
import './style.css'
import App from './App.vue'
import { setupCloudflareAnalytics } from './utils/analytics.js'

const app = createApp(App)
app.use(ElementPlus, { locale: zhCn })
setupCloudflareAnalytics()
app.mount('#app')
