<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import EnvironmentSelector from './components/EnvironmentSelector.vue'
import { environments } from './data/environments.js'
import { isLinuxDOConfigured, startLinuxDOLogin } from './utils/linuxdoAuth.js'

const selectedPackages = ref([])
const showLoginGuide = ref(false)

const totalCategories = computed(() => Object.keys(environments).length)
const totalPackages = computed(() =>
  Object.values(environments).reduce((count, env) => count + env.packages.length, 0)
)
const selectedCount = computed(() => selectedPackages.value.length)
const loginConfigured = computed(() => isLinuxDOConfigured())

const handleLinuxDOLogin = () => {
  if (!loginConfigured.value) {
    showLoginGuide.value = true
    return
  }

  try {
    startLinuxDOLogin()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'LinuxDO 登录暂时不可用')
  }
}
</script>

<template>
  <div class="page-shell">
    <div class="page-noise" />

    <header class="topbar">
      <div class="brand-block">
        <span class="brand-mark">A</span>
        <div>
          <p class="brand-title">安的爽</p>
          <p class="brand-subtitle">Windows 开发环境智能装机台</p>
        </div>
      </div>

      <div class="topbar-actions">
        <span class="status-pill">{{ totalCategories }} 个环境方向</span>
        <span class="status-pill">{{ totalPackages }} 个可选软件包</span>
        <el-button class="login-button" type="primary" @click="handleLinuxDOLogin">
          {{ loginConfigured ? 'LinuxDO 登录' : '准备接入 LinuxDO 登录' }}
        </el-button>
      </div>
    </header>

    <section class="hero-grid">
      <div class="hero-copy">
        <p class="hero-kicker">更傻瓜式的 Windows 环境配置体验</p>
        <h1>先体检，再配置，再一键安装。</h1>
        <p class="hero-description">
          安的爽会把开发环境检测、安装方案配置、安装脚本生成整合到一个页面里，尽量让普通用户也能跟着一步步完成。
        </p>

        <div class="hero-metrics">
          <article class="metric-card">
            <span class="metric-value">{{ totalCategories }}</span>
            <span class="metric-label">环境分类</span>
          </article>
          <article class="metric-card">
            <span class="metric-value">{{ totalPackages }}</span>
            <span class="metric-label">软件库</span>
          </article>
          <article class="metric-card highlight">
            <span class="metric-value">{{ selectedCount }}</span>
            <span class="metric-label">当前选择</span>
          </article>
        </div>
      </div>

      <aside class="identity-card">
        <p class="section-chip">账户入口</p>
        <h2>预留 LinuxDO 登录</h2>
        <p>
          可以先把登录入口做出来，后面接上云端配置同步、体检历史、个人环境模板这些能力。
        </p>

        <div class="identity-points">
          <span>支持 OAuth 授权跳转</span>
          <span>后续可扩展用户中心</span>
          <span>适合做个人环境收藏夹</span>
        </div>

        <el-button type="primary" class="identity-button" @click="handleLinuxDOLogin">
          {{ loginConfigured ? '使用 LinuxDO 登录' : '查看接入说明' }}
        </el-button>
      </aside>
    </section>

    <main class="page-main">
      <EnvironmentSelector v-model="selectedPackages" />
    </main>

    <footer class="page-footer">
      <p>适配 Windows 设备 · 支持体检结果导入 · 安装脚本自动跳过已安装项</p>
    </footer>

    <el-dialog
      v-model="showLoginGuide"
      title="LinuxDO 登录接入说明"
      width="560px"
    >
      <div class="login-guide">
        <p>登录入口可以做，而且前端跳转入口我已经预留好了，但要真正可用，还需要你准备 LinuxDO OAuth 应用配置。</p>
        <ol>
          <li>在 LinuxDO 侧申请 OAuth 应用，拿到 `Client ID`。</li>
          <li>配置回调地址，并在项目里写入 `VITE_LINUXDO_CLIENT_ID` 与 `VITE_LINUXDO_REDIRECT_URI`。</li>
          <li>增加一个服务端回调接口，用来安全交换令牌并建立登录态。</li>
        </ol>
        <p>
          我已经加了示例环境变量文件：
          <strong>.env.example</strong>
        </p>
      </div>

      <template #footer>
        <el-button @click="showLoginGuide = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(255, 211, 160, 0.36), transparent 28%),
    radial-gradient(circle at 90% 10%, rgba(98, 180, 156, 0.22), transparent 24%),
    linear-gradient(180deg, #f7f5ef 0%, #eef2f1 46%, #edf4f2 100%);
  position: relative;
  overflow: hidden;
}

.page-noise {
  position: absolute;
  inset: 0;
  opacity: 0.22;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(22, 54, 48, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(22, 54, 48, 0.04) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.92), transparent 88%);
}

.topbar,
.hero-grid,
.page-main,
.page-footer {
  width: min(1280px, calc(100% - 32px));
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.topbar {
  padding: 24px 0 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #133d36 0%, #1f8a70 100%);
  color: #fff;
  font-size: 22px;
  font-weight: 800;
  box-shadow: 0 12px 24px rgba(19, 61, 54, 0.2);
}

.brand-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #173530;
}

.brand-subtitle {
  margin: 3px 0 0;
  font-size: 13px;
  color: #5b7672;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.status-pill {
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(19, 61, 54, 0.08);
  color: #4c6561;
  font-size: 12px;
}

.login-button {
  min-width: 174px;
}

.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.8fr);
  gap: 24px;
  align-items: stretch;
  padding: 14px 0 24px;
}

.hero-copy,
.identity-card {
  border-radius: 28px;
  backdrop-filter: blur(10px);
}

.hero-copy {
  padding: 34px;
  background:
    radial-gradient(circle at 20% 18%, rgba(255, 216, 173, 0.62), transparent 22%),
    linear-gradient(145deg, rgba(15, 54, 49, 0.96) 0%, rgba(19, 61, 54, 0.92) 52%, rgba(20, 70, 62, 0.88) 100%);
  color: #fff8ec;
  box-shadow: 0 28px 60px rgba(18, 53, 47, 0.18);
}

.hero-kicker {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 244, 220, 0.8);
}

.hero-copy h1 {
  margin: 16px 0 0;
  font-size: clamp(38px, 5.6vw, 72px);
  line-height: 1.02;
  letter-spacing: -0.03em;
}

.hero-description {
  margin: 18px 0 0;
  max-width: 720px;
  font-size: 17px;
  line-height: 1.8;
  color: rgba(255, 248, 236, 0.88);
}

.hero-metrics {
  margin-top: 24px;
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.metric-card {
  min-width: 120px;
  padding: 15px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.14);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-card.highlight {
  background: rgba(242, 140, 40, 0.22);
  border-color: rgba(255, 230, 196, 0.4);
}

.metric-value {
  font-size: 30px;
  font-weight: 800;
}

.metric-label {
  font-size: 13px;
  color: rgba(255, 248, 236, 0.84);
}

.identity-card {
  padding: 26px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(19, 61, 54, 0.08);
  box-shadow: 0 24px 54px rgba(31, 51, 47, 0.1);
  color: #173530;
}

.section-chip {
  margin: 0;
  display: inline-flex;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(31, 138, 112, 0.1);
  color: #0f5f4b;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.identity-card h2 {
  margin: 14px 0 10px;
  font-size: 28px;
  line-height: 1.1;
}

.identity-card p {
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
  color: #57716d;
}

.identity-points {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.identity-points span {
  display: inline-flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(244, 247, 248, 0.92);
  color: #284844;
  border: 1px solid rgba(19, 61, 54, 0.06);
}

.identity-button {
  width: 100%;
  margin-top: 22px;
  min-height: 48px;
}

.page-main {
  padding-bottom: 24px;
}

.page-footer {
  padding: 6px 0 30px;
}

.page-footer p {
  margin: 0;
  text-align: center;
  color: #5b7672;
  font-size: 13px;
}

.login-guide p,
.login-guide ol {
  margin: 0;
  color: #4d6763;
  line-height: 1.8;
}

.login-guide ol {
  padding-left: 20px;
  margin-top: 12px;
}

.login-guide strong {
  color: #173530;
}

@media (max-width: 980px) {
  .hero-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .topbar {
    padding-top: 18px;
  }

  .topbar,
  .topbar-actions {
    align-items: flex-start;
  }

  .topbar {
    flex-direction: column;
  }

  .hero-copy,
  .identity-card {
    padding: 24px;
  }

  .hero-description {
    font-size: 15px;
  }

  .metric-card {
    flex: 1 1 calc(50% - 10px);
  }
}
</style>
