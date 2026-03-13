<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import AdminDashboard from './components/AdminDashboard.vue'
import EnvironmentSelector from './components/EnvironmentSelector.vue'
import { environments } from './data/environments.js'
import { beginLinuxDOLogin, fetchSession, logoutSession } from './utils/sessionApi.js'

const selectedPackages = ref([])
const activeView = ref('console')
const showLoginGuide = ref(false)
const sessionUser = ref(null)
const authStatus = ref('loading')
const authErrorCode = ref('')
const dashboardState = ref({
  selectedCount: 0,
  selectedPendingCount: 0,
  detectedInstalledCount: 0,
  autoDependencyCount: 0,
  skippedInstalledCount: 0,
  hasDetectionData: false,
  useChocolatey: true
})

const totalCategories = computed(() => Object.keys(environments).length)
const totalPackages = computed(() =>
  Object.values(environments).reduce((count, env) => count + env.packages.length, 0)
)
const runtimeStatus = computed(() =>
  dashboardState.value.hasDetectionData ? '已导入体检结果' : '尚未导入体检结果'
)
const installerLabel = computed(() =>
  dashboardState.value.useChocolatey ? 'Chocolatey' : 'Scoop'
)
const authErrorMessage = computed(() => {
  if (!authErrorCode.value) return ''

  const messages = {
    state_mismatch: '登录状态校验失败，请重新点击登录。',
    token_missing: 'LinuxDO 没有返回可用令牌，请重新登录。',
    login_failed: '登录过程中发生错误，请稍后重试。',
    config_missing: '服务端缺少 LinuxDO 配置，请先完成 Cloudflare Secrets 配置。',
    session_unavailable: '当前环境没有正确提供会话接口，请使用 Cloudflare Pages Functions 方式运行。'
  }

  return messages[authErrorCode.value] || '登录失败，请重新尝试。'
})

onMounted(() => {
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href)
    const errorCode = url.searchParams.get('authError')

    if (errorCode) {
      authErrorCode.value = errorCode
      url.searchParams.delete('authError')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }

  loadSession()
})

const handleDashboardUpdate = (payload) => {
  dashboardState.value = {
    ...dashboardState.value,
    ...payload
  }
}

const handleLinuxDOLogin = () => {
  beginLinuxDOLogin()
}

const handleLogout = async () => {
  try {
    await logoutSession()
    sessionUser.value = null
    authStatus.value = 'unauthenticated'
    selectedPackages.value = []
    ElMessage.success('已退出登录')
  } catch {
    ElMessage.error('退出登录失败，请稍后重试')
  }
}

async function loadSession() {
  authStatus.value = 'loading'

  try {
    const payload = await fetchSession()

    if (payload.authenticated) {
      sessionUser.value = payload.user
      authStatus.value = 'authenticated'
      return
    }

    sessionUser.value = null
    authStatus.value = 'unauthenticated'
  } catch {
    sessionUser.value = null
    authStatus.value = 'unauthenticated'
    if (!authErrorCode.value) {
      authErrorCode.value = 'session_unavailable'
    }
  }
}
</script>

<template>
  <div class="desktop-shell">
    <div class="ambient ambient-one" />
    <div class="ambient ambient-two" />

    <section v-if="authStatus === 'loading'" class="loading-screen">
      <div class="loading-card">
        <p class="loading-label">安的爽 · Session Boot</p>
        <h1>正在连接你的控制台</h1>
        <p>正在检查登录状态并准备控制台工作区。</p>
      </div>
    </section>

    <section v-else-if="authStatus !== 'authenticated'" class="entry-screen">
      <div class="entry-panel">
        <div class="entry-copy">
          <p class="entry-label">安的爽 · Welcome</p>
          <h1>先登录，再进入你的环境控制台。</h1>
          <p class="entry-description">
            安的爽现在采用强制登录流程。登录后你可以使用体检、安装、后悔药、预置傻瓜包下载，以及后续的配置同步能力。
          </p>

          <div class="entry-metrics">
            <article>
              <strong>{{ totalCategories }}</strong>
              <span>环境方向</span>
            </article>
            <article>
              <strong>{{ totalPackages }}</strong>
              <span>组件数量</span>
            </article>
            <article>
              <strong>Windows</strong>
              <span>当前完整支持</span>
            </article>
          </div>
        </div>

        <div class="entry-actions-card">
          <p class="entry-side-label">进入方式</p>
          <h2>使用 LinuxDO 登录</h2>
          <p>登录后才能进入控制台。v1 保持轻量，不保存用户数据库，只使用安全 Cookie 维持会话。</p>

          <el-alert
            v-if="authErrorMessage"
            :title="authErrorMessage"
            type="warning"
            :closable="false"
            class="entry-alert"
          />

          <div class="entry-action-list">
            <el-button type="primary" class="entry-main-button" @click="handleLinuxDOLogin">
              使用 LinuxDO 登录
            </el-button>
            <el-button plain class="entry-main-button" @click="showLoginGuide = true">
              查看接入说明
            </el-button>
          </div>

          <div class="entry-notes">
            <span>Cloudflare Pages + Functions</span>
            <span>支持一键体检与后悔药</span>
            <span>支持静态傻瓜包分发</span>
          </div>
        </div>
      </div>
    </section>

    <div v-else class="app-window">
      <header class="window-chrome">
        <div class="chrome-left">
          <div class="traffic-lights">
            <span class="light light-red" />
            <span class="light light-amber" />
            <span class="light light-green" />
          </div>
          <div class="chrome-brand">
            <strong>安的爽</strong>
            <span>Environment Control Console</span>
          </div>
        </div>

        <div class="chrome-right">
          <span class="chrome-pill">{{ totalCategories }} 个方向</span>
          <span class="chrome-pill">{{ totalPackages }} 个组件</span>
          <div class="chrome-nav">
            <el-button :type="activeView === 'console' ? 'primary' : 'default'" class="chrome-nav-button" @click="activeView = 'console'">
              控制台
            </el-button>
            <el-button :type="activeView === 'admin' ? 'primary' : 'default'" class="chrome-nav-button" @click="activeView = 'admin'">
              管理后台
            </el-button>
          </div>
          <span class="chrome-user">
            <img v-if="sessionUser?.avatar" :src="sessionUser.avatar" alt="avatar">
            <strong>{{ sessionUser?.name || sessionUser?.username }}</strong>
          </span>
          <el-button plain class="chrome-back" @click="handleLogout">
            退出登录
          </el-button>
        </div>
      </header>

      <div class="window-body">
        <aside class="command-rail">
          <section class="rail-card rail-brand">
            <p class="rail-label">System Console</p>
            <h1>一套更像桌面应用的开发环境控制台</h1>
            <p class="rail-copy">
              把检测、决策、安装串成同一条工作流，让用户随时知道自己还差什么。
            </p>
          </section>

          <section class="rail-card rail-status">
            <p class="rail-section-title">当前状态</p>
            <div class="status-grid">
              <article class="status-tile highlight">
                <strong>{{ dashboardState.selectedCount }}</strong>
                <span>已勾选</span>
              </article>
              <article class="status-tile">
                <strong>{{ dashboardState.selectedPendingCount }}</strong>
                <span>待安装</span>
              </article>
              <article class="status-tile">
                <strong>{{ dashboardState.detectedInstalledCount }}</strong>
                <span>已识别</span>
              </article>
              <article class="status-tile">
                <strong>{{ dashboardState.autoDependencyCount }}</strong>
                <span>自动依赖</span>
              </article>
            </div>
            <div class="status-notes">
              <p><span>体检</span><strong>{{ runtimeStatus }}</strong></p>
              <p><span>跳过重复</span><strong>{{ dashboardState.skippedInstalledCount }} 项</strong></p>
              <p><span>安装方式</span><strong>{{ installerLabel }}</strong></p>
            </div>
          </section>

          <section class="rail-card rail-flow">
            <p class="rail-section-title">工作流</p>
            <article class="flow-row">
              <span class="flow-code">01</span>
              <div>
                <strong>先体检</strong>
                <p>双击运行一键体检器。</p>
              </div>
            </article>
            <article class="flow-row">
              <span class="flow-code">02</span>
              <div>
                <strong>再选择</strong>
                <p>勾选要补齐的环境。</p>
              </div>
            </article>
            <article class="flow-row">
              <span class="flow-code">03</span>
              <div>
                <strong>最后安装</strong>
                <p>下载脚本后直接执行。</p>
              </div>
            </article>
          </section>

          <section class="rail-card rail-account">
            <p class="rail-section-title">当前账户</p>
            <h2>{{ sessionUser?.name || sessionUser?.username }}</h2>
            <p>LinuxDO 已连接。后续可扩展体检历史、云端环境模板和个人同步配置。</p>
            <div class="account-meta">
              <span>@{{ sessionUser?.username }}</span>
              <span v-if="sessionUser?.trustLevel !== null">信任等级 {{ sessionUser?.trustLevel }}</span>
            </div>
          </section>
        </aside>

        <main class="workspace">
          <section v-if="activeView === 'console'" class="workspace-hero">
            <div class="workspace-heading">
              <p class="workspace-label">Workspace</p>
              <h2>先体检，再配置，再一键执行。</h2>
            </div>

            <p class="workspace-description">
              左侧常驻显示当前状态，右侧只保留真正需要操作的模块，尽量让信息更聚焦。
            </p>

            <div class="workspace-pills">
              <span>{{ totalCategories }} 个环境方向</span>
              <span>{{ totalPackages }} 个可选组件</span>
              <span>{{ dashboardState.selectedPendingCount }} 项待安装</span>
              <span>{{ runtimeStatus }}</span>
            </div>
          </section>

          <EnvironmentSelector
            v-if="activeView === 'console'"
            v-model="selectedPackages"
            @dashboard-update="handleDashboardUpdate"
          />

          <AdminDashboard
            v-else
            :session-user="sessionUser"
          />
        </main>
      </div>
    </div>

    <p class="desktop-footer">当前界面实验版本已保留备份，可随时回退到上一版。</p>

    <el-dialog
      v-model="showLoginGuide"
      title="LinuxDO 登录接入说明"
      width="560px"
    >
      <div class="login-guide">
        <p>前端登录入口已经切到 Cloudflare Functions，真正登录要依赖服务端 Secrets 和回调接口。</p>
        <ol>
          <li>在 LinuxDO Connect 中填写应用主页和回调地址。</li>
          <li>把 `LINUXDO_CLIENT_ID`、`LINUXDO_CLIENT_SECRET`、`SESSION_SECRET` 配进 Cloudflare。</li>
          <li>用 `wrangler pages dev dist` 或 Pages 正式环境测试登录链路。</li>
        </ol>
        <p>本地开发请参考 <code>.dev.vars.example</code>。</p>
      </div>

      <template #footer>
        <el-button @click="showLoginGuide = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.desktop-shell {
  min-height: 100vh;
  padding: 26px 18px 22px;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(213, 164, 114, 0.24), transparent 24%),
    radial-gradient(circle at 84% 12%, rgba(88, 130, 121, 0.2), transparent 20%),
    linear-gradient(180deg, #eff1ec 0%, #e8ece9 48%, #eef1ef 100%);
}

.ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(70px);
  opacity: 0.45;
  pointer-events: none;
}

.ambient-one {
  width: 280px;
  height: 280px;
  top: -90px;
  left: -80px;
  background: rgba(196, 123, 54, 0.2);
}

.ambient-two {
  width: 360px;
  height: 360px;
  right: -140px;
  top: 16%;
  background: rgba(47, 117, 105, 0.14);
}

.loading-screen,
.entry-screen {
  width: min(1320px, 100%);
  margin: 0 auto;
  min-height: calc(100vh - 70px);
  display: grid;
  align-items: center;
  position: relative;
  z-index: 1;
}

.loading-card,
.entry-copy,
.entry-actions-card {
  border-radius: 32px;
  box-shadow: 0 30px 70px rgba(24, 41, 39, 0.12);
}

.loading-card {
  width: min(720px, 100%);
  margin: 0 auto;
  padding: 34px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(18, 40, 37, 0.08);
  text-align: center;
}

.loading-label {
  margin: 0;
  color: #8b7355;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 12px;
}

.loading-card h1 {
  margin: 16px 0 0;
  color: #162b28;
  font-size: 38px;
}

.loading-card p:last-child {
  margin: 12px 0 0;
  color: #647673;
}

.entry-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(360px, 0.8fr);
  gap: 22px;
  align-items: stretch;
}

.entry-copy {
  padding: 36px;
  background:
    radial-gradient(circle at top left, rgba(196, 123, 54, 0.28), transparent 26%),
    linear-gradient(145deg, rgba(18, 47, 43, 0.96) 0%, rgba(25, 62, 56, 0.92) 55%, rgba(17, 42, 39, 0.9) 100%);
  color: #f5f7f6;
}

.entry-label {
  margin: 0;
  color: rgba(245, 247, 246, 0.7);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 12px;
}

.entry-copy h1 {
  margin: 18px 0 0;
  font-size: clamp(42px, 5vw, 74px);
  line-height: 1.02;
  letter-spacing: -0.04em;
}

.entry-description {
  margin: 18px 0 0;
  max-width: 700px;
  color: rgba(245, 247, 246, 0.82);
  font-size: 17px;
  line-height: 1.9;
}

.entry-metrics {
  margin-top: 26px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.entry-metrics article {
  padding: 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.entry-metrics strong {
  font-size: 30px;
  font-weight: 800;
}

.entry-metrics span {
  font-size: 13px;
  color: rgba(245, 247, 246, 0.76);
}

.entry-actions-card {
  padding: 28px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(18, 40, 37, 0.08);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.entry-side-label {
  margin: 0;
  color: #8b7355;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
}

.entry-actions-card h2 {
  margin: 14px 0 0;
  color: #162b28;
  font-size: 34px;
  line-height: 1.12;
}

.entry-actions-card p {
  margin: 12px 0 0;
  color: #647673;
  line-height: 1.8;
}

.entry-alert {
  margin-top: 18px;
}

.entry-action-list {
  margin-top: 26px;
  display: grid;
  gap: 12px;
}

.entry-main-button {
  width: 100%;
  min-height: 48px;
}

.entry-notes {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.entry-notes span {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(18, 40, 37, 0.05);
  border: 1px solid rgba(18, 40, 37, 0.06);
  color: #5f726f;
  font-size: 12px;
}

.app-window {
  width: min(1420px, 100%);
  margin: 0 auto;
  border-radius: 36px;
  background: rgba(248, 248, 245, 0.76);
  border: 1px solid rgba(14, 35, 33, 0.08);
  box-shadow: 0 36px 80px rgba(27, 45, 41, 0.12);
  backdrop-filter: blur(18px);
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.window-chrome {
  padding: 16px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid rgba(14, 35, 33, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, rgba(243, 244, 239, 0.8) 100%);
}

.chrome-left,
.chrome-right {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.traffic-lights {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.light {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.light-red {
  background: #d85c53;
}

.light-amber {
  background: #d8a34e;
}

.light-green {
  background: #5ca778;
}

.chrome-brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chrome-brand strong {
  color: #122825;
  font-size: 14px;
}

.chrome-brand span {
  color: #6a7a77;
  font-size: 12px;
}

.chrome-pill,
.chrome-user {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(14, 35, 33, 0.06);
  color: #5e716d;
  font-size: 12px;
}

.chrome-user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.chrome-nav {
  display: inline-flex;
  gap: 8px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(14, 35, 33, 0.05);
}

.chrome-nav-button {
  min-width: 92px;
}

.chrome-user img {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
}

.chrome-back {
  min-width: 108px;
}

.window-body {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  min-height: calc(100vh - 130px);
}

.command-rail {
  padding: 22px;
  display: grid;
  gap: 16px;
  border-right: 1px solid rgba(14, 35, 33, 0.08);
  background:
    linear-gradient(180deg, rgba(23, 36, 33, 0.98) 0%, rgba(24, 39, 36, 0.96) 100%);
}

.rail-card {
  border-radius: 24px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #edf4f1;
}

.rail-label,
.rail-section-title {
  margin: 0;
  color: rgba(230, 242, 238, 0.7);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.rail-brand h1 {
  margin: 14px 0 0;
  font-size: 28px;
  line-height: 1.12;
  color: #f4f7f6;
}

.rail-copy,
.rail-account p {
  margin: 12px 0 0;
  color: rgba(230, 242, 238, 0.74);
  font-size: 14px;
  line-height: 1.75;
}

.rail-status {
  display: grid;
  gap: 14px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.status-tile {
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-tile.highlight {
  background: linear-gradient(135deg, rgba(196, 123, 54, 0.2) 0%, rgba(196, 123, 54, 0.08) 100%);
}

.status-tile strong {
  font-size: 28px;
  color: #f3f6f5;
}

.status-tile span {
  font-size: 12px;
  color: rgba(230, 242, 238, 0.76);
}

.status-notes {
  display: grid;
  gap: 10px;
}

.status-notes p {
  margin: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  color: rgba(230, 242, 238, 0.72);
  font-size: 13px;
}

.status-notes span {
  color: rgba(230, 242, 238, 0.6);
}

.status-notes strong {
  color: #f3f6f5;
  font-size: 13px;
}

.rail-flow {
  display: grid;
  gap: 12px;
}

.flow-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 12px;
  align-items: flex-start;
}

.flow-code {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: #f4f7f6;
  font-size: 12px;
  font-weight: 800;
}

.flow-row strong {
  display: block;
  color: #f3f6f5;
  font-size: 14px;
}

.flow-row p {
  margin: 4px 0 0;
  color: rgba(230, 242, 238, 0.72);
  font-size: 13px;
  line-height: 1.6;
}

.rail-account h2 {
  margin: 10px 0 0;
  color: #f4f7f6;
  font-size: 24px;
}

.account-meta {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.account-meta span {
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #edf4f1;
  font-size: 12px;
}

.workspace {
  padding: 22px;
  display: grid;
  align-content: start;
  gap: 18px;
  background:
    linear-gradient(180deg, rgba(251, 251, 248, 0.92) 0%, rgba(246, 247, 244, 0.86) 100%);
}

.workspace-hero {
  border-radius: 28px;
  padding: 28px;
  background:
    radial-gradient(circle at 88% 12%, rgba(196, 123, 54, 0.14), transparent 22%),
    linear-gradient(145deg, #ffffff 0%, #f4f6f2 100%);
  border: 1px solid rgba(14, 35, 33, 0.06);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.workspace-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.workspace-label {
  margin: 0;
  color: #7b705f;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.workspace-heading h2 {
  margin: 10px 0 0;
  color: #142c28;
  font-size: clamp(32px, 4vw, 52px);
  line-height: 1.04;
  letter-spacing: -0.03em;
}

.workspace-description {
  margin: 16px 0 0;
  max-width: 840px;
  color: #607370;
  font-size: 16px;
  line-height: 1.85;
}

.workspace-pills {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.workspace-pills span {
  padding: 9px 13px;
  border-radius: 999px;
  background: rgba(20, 44, 40, 0.05);
  border: 1px solid rgba(20, 44, 40, 0.06);
  color: #526663;
  font-size: 13px;
}

.desktop-footer {
  margin: 16px 0 0;
  text-align: center;
  color: #6b7c78;
  font-size: 12px;
  position: relative;
  z-index: 1;
}

.login-guide p,
.login-guide ol {
  margin: 0;
  color: #4f6461;
  line-height: 1.8;
}

.login-guide ol {
  margin-top: 12px;
  padding-left: 20px;
}

@media (max-width: 1120px) {
  .entry-panel,
  .window-body {
    grid-template-columns: 1fr;
  }

  .command-rail {
    border-right: none;
    border-bottom: 1px solid rgba(14, 35, 33, 0.08);
  }
}

@media (max-width: 760px) {
  .desktop-shell {
    padding: 14px 10px 18px;
  }

  .window-chrome {
    padding: 14px;
  }

  .entry-copy,
  .entry-actions-card,
  .loading-card,
  .workspace,
  .command-rail,
  .workspace-hero,
  .rail-card {
    padding: 18px;
  }

  .entry-metrics {
    grid-template-columns: 1fr;
  }

  .status-grid {
    grid-template-columns: 1fr 1fr;
  }

  .chrome-right {
    width: 100%;
  }
}
</style>
