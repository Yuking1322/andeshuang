<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import AdminDashboard from './components/AdminDashboard.vue'
import EnvironmentSelector from './components/EnvironmentSelector.vue'
import { environments } from './data/environments.js'
import {
  beginLinuxDOLogin,
  fetchSession,
  loginLocalAccount,
  logoutSession,
  registerLocalAccount
} from './utils/sessionApi.js'

const defaultLocalAuthConfig = Object.freeze({
  enabled: false,
  registrationMode: 'disabled',
  registrationEnabled: false,
  registrationStatus: 'local_auth_unavailable',
  inviteCodeRequired: false,
  registrationLimit: null,
  totalUsers: 0,
  remainingSlots: null
})

const selectedPackages = ref([])
const activeView = ref('console')
const entryMode = ref('linuxdo')
const showLoginGuide = ref(false)
const sessionUser = ref(null)
const sessionIsAdmin = ref(false)
const authStatus = ref('loading')
const authErrorCode = ref('')
const authActionPending = ref(false)
const localAuthConfig = ref({ ...defaultLocalAuthConfig })
const localAuthError = ref('')
const localLoginForm = ref({
  username: '',
  password: ''
})
const localRegisterForm = ref({
  username: '',
  displayName: '',
  inviteCode: '',
  password: '',
  confirmPassword: ''
})
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
const canUseLocalLogin = computed(() => localAuthConfig.value.enabled)
const canUseLocalRegister = computed(() => localAuthConfig.value.registrationEnabled)
const currentUserLabel = computed(() => sessionUser.value?.name || sessionUser.value?.username || '')
const entryModeTitleText = computed(() => {
  if (entryMode.value === 'localRegister' && localAuthConfig.value.inviteCodeRequired) {
    return '使用邀请码创建内测账号'
  }

  return (
    {
      linuxdo: '使用 LinuxDO 登录',
      localLogin: '使用内测账号登录',
      localRegister: '创建内测账号'
    }[entryMode.value] || '使用 LinuxDO 登录'
  )
})
const entryModeDescriptionText = computed(() => {
  if (entryMode.value === 'linuxdo') {
    return '登录后才能进入控制台。D1 保持轻量，不保存 LinuxDO 用户数据库，只使用安全 Cookie 维持会话。'
  }

  if (entryMode.value === 'localLogin') {
    if (localAuthConfig.value.registrationMode === 'disabled') {
      return '当前已经关闭公开注册，只保留已发放账号登录。没有账号时，请由管理员手动分发。'
    }

    if (localAuthConfig.value.registrationStatus === 'limit_reached') {
      return '当前内测注册名额已满，只保留已有账号登录。需要继续放人时，请联系管理员调整名额。'
    }

    if (localAuthConfig.value.inviteCodeRequired) {
      return '已有邀请码创建的内测账号可以直接登录。没有邀请码时，请先向管理员申请。'
    }

    return '如果你的同学没有 LinuxDO，也可以直接使用内测账号登录后体验控制台。'
  }

  if (localAuthConfig.value.inviteCodeRequired) {
    return '当前注册改为邀请码模式，只有持有码的用户才能创建内测账号。注册成功后会自动进入控制台。'
  }

  return '内测阶段支持你自己创建一个测试账号。注册成功后会自动进入控制台。'
})
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
const entryModeTitle = computed(() => ({
  linuxdo: '使用 LinuxDO 登录',
  localLogin: '使用内测账号登录',
  localRegister: '创建内测账号'
}[entryMode.value] || '使用 LinuxDO 登录'))
const entryModeDescription = computed(() => ({
  linuxdo: '登录后才能进入控制台。v1 保持轻量，不保存用户数据库，只使用安全 Cookie 维持会话。',
  localLogin: '如果你的同学没有 LinuxDO，可以直接用内测账号登录后体验控制台。',
  localRegister: '内测阶段支持你自己注册一个测试账号。注册成功后会自动进入控制台。'
}[entryMode.value] || '登录后才能进入控制台。'))

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
  localAuthError.value = ''
  beginLinuxDOLogin()
}

const switchEntryMode = (mode) => {
  if (!isEntryModeAvailable(mode)) return

  entryMode.value = mode
  localAuthError.value = ''
}

const handleLogout = async () => {
  try {
    await logoutSession()
    sessionUser.value = null
    sessionIsAdmin.value = false
    authStatus.value = 'unauthenticated'
    selectedPackages.value = []
    activeView.value = 'console'
    localAuthError.value = ''
    syncEntryModeWithPolicy()
    ElMessage.success('已退出登录')
  } catch {
    ElMessage.error('退出登录失败，请稍后重试')
  }
}

const handleLocalLogin = async () => {
  localAuthError.value = ''

  if (!localLoginForm.value.username.trim() || !localLoginForm.value.password) {
    localAuthError.value = '请先填写用户名和密码。'
    return
  }

  authActionPending.value = true

  try {
    await loginLocalAccount({
      username: localLoginForm.value.username.trim(),
      password: localLoginForm.value.password
    })

    clearAuthForms()
    await loadSession()
    ElMessage.success('登录成功，正在进入控制台')
  } catch (error) {
    localAuthError.value = formatLocalAuthErrorForUi(error)
  } finally {
    authActionPending.value = false
  }
}

const handleLocalRegister = async () => {
  localAuthError.value = ''

  const username = localRegisterForm.value.username.trim()
  const displayName = localRegisterForm.value.displayName.trim()
  const inviteCode = localRegisterForm.value.inviteCode.trim()
  const password = localRegisterForm.value.password
  const confirmPassword = localRegisterForm.value.confirmPassword

  if (!username || !displayName || !password || !confirmPassword) {
    localAuthError.value = '请先把用户名、显示名、密码和确认密码填完整。'
    return
  }

  if (localAuthConfig.value.inviteCodeRequired && !inviteCode) {
    localAuthError.value = '当前注册需要邀请码，请先填写邀请码。'
    return
  }

  if (password !== confirmPassword) {
    localAuthError.value = '两次输入的密码不一致，请重新确认。'
    return
  }

  authActionPending.value = true

  try {
    await registerLocalAccount({
      username,
      displayName,
      inviteCode,
      password
    })

    clearAuthForms()
    await loadSession()
    ElMessage.success('注册成功，已经自动进入控制台')
  } catch (error) {
    localAuthError.value = formatLocalAuthErrorForUi(error)
  } finally {
    authActionPending.value = false
  }
}

async function loadSession() {
  authStatus.value = 'loading'

  try {
    const payload = await fetchSession()

    applyLocalAuthConfig(payload)

    if (payload.authenticated) {
      sessionUser.value = payload.user
      sessionIsAdmin.value = Boolean(payload.isAdmin)
      if (!payload.isAdmin && activeView.value === 'admin') {
        activeView.value = 'console'
      }
      localAuthError.value = ''
      authStatus.value = 'authenticated'
      return
    }

    sessionUser.value = null
    sessionIsAdmin.value = false
    authStatus.value = 'unauthenticated'
  } catch {
    sessionUser.value = null
    sessionIsAdmin.value = false
    localAuthConfig.value = { ...defaultLocalAuthConfig }
    syncEntryModeWithPolicy()
    authStatus.value = 'unauthenticated'
    if (!authErrorCode.value) {
      authErrorCode.value = 'session_unavailable'
    }
  }
}

function applyLocalAuthConfig(payload) {
  localAuthConfig.value = {
    ...defaultLocalAuthConfig,
    ...(payload?.localAuth || {})
  }
  syncEntryModeWithPolicy()
}

function syncEntryModeWithPolicy() {
  if (isEntryModeAvailable(entryMode.value)) return

  entryMode.value = canUseLocalLogin.value ? 'localLogin' : 'linuxdo'
}

function isEntryModeAvailable(mode) {
  if (mode === 'linuxdo') return true
  if (mode === 'localLogin') return canUseLocalLogin.value
  if (mode === 'localRegister') return canUseLocalRegister.value
  return false
}

function clearAuthForms() {
  localLoginForm.value = {
    username: '',
    password: ''
  }
  localRegisterForm.value = {
    username: '',
    displayName: '',
    inviteCode: '',
    password: '',
    confirmPassword: ''
  }
}

function formatLocalAuthErrorForUi(error) {
  const code = error?.code || error?.message || ''
  const messages = {
    registration_disabled: '当前环境已关闭公开注册，只保留已有账号登录。',
    registration_unavailable: '邀请码注册尚未配置完成，请稍后再试。',
    registration_limit_reached: '当前注册名额已满，请等待管理员放开名额。',
    invite_code_required: '当前注册需要邀请码，请先填写邀请码。',
    invalid_invite_code: '邀请码无效，请检查后重试。'
  }

  return messages[code] || formatLocalAuthError(error)
}

function formatLocalAuthError(error) {
  const code = error?.code || error?.message || ''
  const messages = {
    local_auth_unavailable: '当前环境还没有启用内测账号能力，请稍后再试。',
    invalid_payload: '提交内容格式不正确，请重新填写。',
    invalid_username: '用户名格式不合法，建议使用 3 到 24 位字母、数字或下划线。',
    invalid_display_name: '显示名长度不合适，请换一个更短一点的名字。',
    invalid_password: '密码长度需要在 8 到 128 位之间。',
    missing_credentials: '请先输入用户名和密码。',
    username_taken: '这个用户名已经被注册了，换一个试试。',
    invalid_credentials: '用户名或密码不正确，请重新确认。',
    account_disabled: '当前账号已被管理员停用，请联系管理员。',
    register_failed: '注册失败，账号没有创建成功，请稍后再试。',
    session_unavailable: '当前环境缺少会话密钥，暂时无法使用内测账号功能。',
    database_error: '账号服务暂时不可用，请稍后再试。'
  }

  return messages[code] || '内测账号操作失败，请稍后再试。'
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
          <div class="entry-brand-mark">
            <img src="/lightning-mark.svg" alt="安的爽闪电标识">
          </div>
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
          <div class="entry-mode-tabs">
            <button
              type="button"
              :class="['entry-mode-tab', { active: entryMode === 'linuxdo' }]"
              @click="switchEntryMode('linuxdo')"
            >
              LinuxDO 登录
            </button>
            <button
              type="button"
              v-if="canUseLocalLogin"
              :class="['entry-mode-tab', { active: entryMode === 'localLogin' }]"
              @click="switchEntryMode('localLogin')"
            >
              内测账号登录
            </button>
            <button
              type="button"
              v-if="canUseLocalRegister"
              :class="['entry-mode-tab', { active: entryMode === 'localRegister' }]"
              @click="switchEntryMode('localRegister')"
            >
              内测账号注册
            </button>
          </div>

          <h2>{{ entryModeTitleText }}</h2>
          <p>{{ entryModeDescriptionText }}</p>

          <el-alert
            v-if="authErrorMessage"
            :title="authErrorMessage"
            type="warning"
            :closable="false"
            class="entry-alert"
          />

          <el-alert
            v-if="localAuthError"
            :title="localAuthError"
            type="error"
            :closable="false"
            class="entry-alert"
          />

          <div v-if="entryMode === 'linuxdo'" class="entry-action-list">
            <el-button type="primary" class="entry-main-button" @click="handleLinuxDOLogin">
              使用 LinuxDO 登录
            </el-button>
            <el-button plain class="entry-main-button" @click="showLoginGuide = true">
              查看接入说明
            </el-button>
          </div>

          <div v-else-if="entryMode === 'localLogin'" class="entry-form">
            <el-input
              v-model.trim="localLoginForm.username"
              placeholder="用户名"
              autocomplete="username"
              size="large"
            />
            <el-input
              v-model="localLoginForm.password"
              type="password"
              show-password
              placeholder="密码"
              autocomplete="current-password"
              size="large"
              @keyup.enter="handleLocalLogin"
            />

            <div class="entry-action-list">
              <el-button
                type="primary"
                class="entry-main-button"
                :loading="authActionPending"
                @click="handleLocalLogin"
              >
                使用内测账号登录
              </el-button>
              <el-button
                v-if="canUseLocalRegister"
                plain
                class="entry-main-button"
                @click="switchEntryMode('localRegister')"
              >
                没有账号？去注册
              </el-button>
            </div>
          </div>

          <div v-else-if="entryMode === 'localRegister'" class="entry-form">
            <el-alert
              v-if="localAuthConfig.inviteCodeRequired"
              title="当前环境只开放邀请码注册，请先填写邀请码。"
              type="info"
              :closable="false"
              class="entry-alert"
            />
            <el-input
              v-model.trim="localRegisterForm.username"
              placeholder="用户名（建议字母、数字、下划线）"
              autocomplete="username"
              size="large"
            />
            <el-input
              v-model.trim="localRegisterForm.displayName"
              placeholder="显示名"
              autocomplete="nickname"
              size="large"
            />
            <el-input
              v-if="localAuthConfig.inviteCodeRequired"
              v-model.trim="localRegisterForm.inviteCode"
              placeholder="邀请码"
              autocomplete="one-time-code"
              size="large"
            />
            <el-input
              v-model="localRegisterForm.password"
              type="password"
              show-password
              placeholder="密码"
              autocomplete="new-password"
              size="large"
            />
            <el-input
              v-model="localRegisterForm.confirmPassword"
              type="password"
              show-password
              placeholder="确认密码"
              autocomplete="new-password"
              size="large"
              @keyup.enter="handleLocalRegister"
            />

            <div class="entry-action-list">
              <el-button
                type="primary"
                class="entry-main-button"
                :loading="authActionPending"
                @click="handleLocalRegister"
              >
                创建内测账号
              </el-button>
              <el-button plain class="entry-main-button" @click="switchEntryMode('localLogin')">
                已有账号？去登录
              </el-button>
            </div>
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
            <div class="chrome-brand-mark">
              <img src="/lightning-mark.svg" alt="安的爽闪电标识">
            </div>
            <div class="chrome-brand-copy">
              <strong>安的爽</strong>
              <span>Environment Control Console</span>
            </div>
          </div>
        </div>

        <div class="chrome-right">
          <span class="chrome-pill">{{ totalCategories }} 个方向</span>
          <span class="chrome-pill">{{ totalPackages }} 个组件</span>
          <div class="chrome-nav">
            <el-button :type="activeView === 'console' ? 'primary' : 'default'" class="chrome-nav-button" @click="activeView = 'console'">
              控制台
            </el-button>
            <el-button
              v-if="sessionIsAdmin"
              :type="activeView === 'admin' ? 'primary' : 'default'"
              class="chrome-nav-button"
              @click="activeView = 'admin'"
            >
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

.entry-brand-mark {
  margin-top: 18px;
}

.entry-brand-mark img {
  width: 88px;
  height: 88px;
  border-radius: 24px;
  box-shadow: 0 20px 40px rgba(40, 12, 78, 0.28);
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

.entry-mode-tabs {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(18, 40, 37, 0.05);
  border: 1px solid rgba(18, 40, 37, 0.06);
}

.entry-mode-tab {
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #5c706d;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  padding: 10px 14px;
}

.entry-mode-tab.active {
  background: #173f38;
  color: #f5f7f6;
}

.entry-alert {
  margin-top: 18px;
}

.entry-form {
  margin-top: 22px;
  display: grid;
  gap: 12px;
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
  align-items: center;
  gap: 10px;
}

.chrome-brand-mark {
  display: inline-flex;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 18px rgba(87, 48, 164, 0.22);
}

.chrome-brand-mark img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chrome-brand-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chrome-brand-copy strong {
  color: #122825;
  font-size: 14px;
}

.chrome-brand-copy span {
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

  .entry-mode-tabs {
    width: 100%;
    display: grid;
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
