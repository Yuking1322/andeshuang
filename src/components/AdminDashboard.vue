<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  deleteLocalAuthUser,
  fetchAdminOverview,
  generateLocalAuthInvite,
  updateLocalAuthInvite,
  updateLocalAuthSettings,
  updateLocalAuthUser
} from '../utils/adminApi.js'

const props = defineProps({
  sessionUser: {
    type: Object,
    default: null
  }
})

const emptyAuth = () => ({
  available: false,
  settings: {
    registrationMode: 'invite_only',
    registrationLimit: null,
    inviteCodeCount: 0,
    totalInviteCount: 0,
    source: 'environment',
    registrationStatus: 'local_auth_unavailable'
  },
  stats: {
    totalUsers: 0,
    enabledUsers: 0,
    disabledUsers: 0,
    recentRegistrations: 0,
    recentLogins: 0,
    registrationLimit: null,
    remainingSlots: null,
    registrationStatus: 'local_auth_unavailable',
    inviteCodeCount: 0,
    totalInviteCount: 0
  },
  invites: [],
  users: []
})

const activePage = ref('accounts')
const adminState = ref({
  status: 'loading',
  dashboards: {
    cloudflareHome: 'https://dash.cloudflare.com/',
    pagesProject: '',
    webAnalytics: '',
    downloads: ''
  },
  operations: {
    staticRequestsPlan: '',
    functionsBudget: ''
  },
  authManagement: emptyAuth()
})
const settingsForm = ref({
  registrationMode: 'invite_only',
  registrationLimit: null
})
const inviteForm = ref({
  label: '',
  maxUses: 1
})
const userSearch = ref('')
const userStatusFilter = ref('all')
const savingSettings = ref(false)
const generatingInvite = ref(false)
const busyUserIds = ref({})
const busyInviteIds = ref({})

const authManagement = computed(() => adminState.value.authManagement || emptyAuth())
const stats = computed(() => authManagement.value.stats || emptyAuth().stats)
const settings = computed(() => authManagement.value.settings || emptyAuth().settings)
const invites = computed(() => authManagement.value.invites || [])
const users = computed(() => authManagement.value.users || [])

const metricCards = computed(() => [
  { key: 'users', label: '总注册人数', value: stats.value.totalUsers, hint: '当前 D1 里的全部本地账号' },
  { key: 'recent', label: '近 7 天注册', value: stats.value.recentRegistrations, hint: '最近一周新增的账号' },
  { key: 'enabled', label: '启用中账号', value: stats.value.enabledUsers, hint: '仍然可以登录的账号' },
  { key: 'invites', label: '可用邀请码', value: stats.value.inviteCodeCount, hint: `已生成 ${stats.value.totalInviteCount} 个邀请码` }
])

const registrationModeLabel = computed(() => ({
  public: '公开注册',
  invite_only: '邀请码注册',
  disabled: '关闭注册'
}[settingsForm.value.registrationMode] || '邀请码注册'))

const registrationStatusLabel = computed(() => ({
  open: '可注册',
  closed: '已关闭注册',
  invite_codes_missing: '邀请码未配置',
  invite_codes_exhausted: '邀请码已用完',
  limit_reached: '注册名额已满',
  local_auth_unavailable: '本地账号未启用'
}[stats.value.registrationStatus] || '待确认'))

const registrationStatusType = computed(() => ({
  open: 'success',
  closed: 'danger',
  invite_codes_missing: 'warning',
  invite_codes_exhausted: 'warning',
  limit_reached: 'warning',
  local_auth_unavailable: 'info'
}[stats.value.registrationStatus] || 'info'))

const registrationLimitLabel = computed(() => {
  if (stats.value.registrationLimit === null || stats.value.registrationLimit === undefined) {
    return '不限'
  }
  return `${stats.value.totalUsers} / ${stats.value.registrationLimit}`
})

const filteredUsers = computed(() => {
  const keyword = userSearch.value.trim().toLowerCase()
  return users.value.filter((user) => {
    const matchesStatus =
      userStatusFilter.value === 'all' ||
      (userStatusFilter.value === 'enabled' && user.isEnabled) ||
      (userStatusFilter.value === 'disabled' && !user.isEnabled)
    const matchesKeyword =
      !keyword ||
      user.username.toLowerCase().includes(keyword) ||
      user.displayName.toLowerCase().includes(keyword)
    return matchesStatus && matchesKeyword
  })
})

const launchItems = computed(() => [
  {
    key: 'homepage',
    label: '线上主页',
    value: (import.meta.env.VITE_APP_HOMEPAGE || 'https://andeshuang.pages.dev').trim(),
    status: 'done'
  },
  {
    key: 'functions',
    label: '登录服务端',
    value: 'Pages Functions 已承接 /api/session 与 /api/auth/*',
    status: 'done'
  },
  {
    key: 'registration',
    label: '注册控制台',
    value: describeRegistrationState(),
    status: ['invite_codes_missing', 'invite_codes_exhausted'].includes(stats.value.registrationStatus) ? 'todo' : 'done'
  },
  {
    key: 'analytics',
    label: 'Web Analytics',
    value: adminState.value.dashboards.webAnalytics
      ? '已配置专用入口，可以继续验证统计是否累积'
      : '建议到 Pages 项目里确认 Metrics / Web Analytics',
    status: adminState.value.dashboards.webAnalytics ? 'done' : 'todo'
  },
  {
    key: 'protection',
    label: '认证接口保护',
    value: '已在 andeshuang.me 配置 WAF 与 Rate Limiting 规则',
    status: 'done'
  }
])

const adminLinks = computed(() => {
  const dashboards = adminState.value.dashboards
  return [
    {
      key: 'cloudflare',
      title: 'Cloudflare 总控台',
      description: '统一查看 Pages、Functions、日志和项目级安全配置。',
      href: dashboards.cloudflareHome || 'https://dash.cloudflare.com/',
      cta: '打开 Cloudflare'
    },
    {
      key: 'pages',
      title: 'Pages 项目入口',
      description: dashboards.pagesProject ? '直接进入 andeshuang 的 Pages 项目。' : '把项目直达链接配进环境变量后，这里就能一键跳转。',
      href: dashboards.pagesProject || dashboards.cloudflareHome || 'https://dash.cloudflare.com/',
      cta: dashboards.pagesProject ? '打开 Pages 项目' : '去 Pages 控制台'
    },
    {
      key: 'analytics',
      title: '流量与 Analytics',
      description: dashboards.webAnalytics ? '当前已经配置专用 Analytics 入口。' : '可从 Pages 项目里的 Metrics / Web Analytics 查看访问情况。',
      href: dashboards.webAnalytics || dashboards.pagesProject || dashboards.cloudflareHome || 'https://dash.cloudflare.com/',
      cta: dashboards.webAnalytics ? '查看 Analytics' : '去 Metrics'
    },
    {
      key: 'downloads',
      title: '下载分发入口',
      description: dashboards.downloads ? '当前已经配置专用下载观察入口。' : '如果后续迁移到 R2 或 Releases，可以把分发入口继续挂到这里。',
      href: dashboards.downloads || dashboards.pagesProject || dashboards.cloudflareHome || 'https://dash.cloudflare.com/',
      cta: dashboards.downloads ? '查看下载流量' : '查看分发配置'
    }
  ]
})
const nextStepItems = computed(() => {
  const items = []

  if (!adminState.value.dashboards.webAnalytics) {
    items.push('补上 Web Analytics 直达入口，并确认正式域名访问后已经开始累计统计。')
  }

  if (!adminState.value.dashboards.pagesProject) {
    items.push('把 Pages 项目直达链接补进后台，减少后续排障时来回找控制台的成本。')
  }

  if (settings.value.registrationMode === 'invite_only' && stats.value.inviteCodeCount === 0) {
    items.push('当前是邀请码模式，但没有可用邀请码，先生成一批再放用户进场。')
  }

  if (
    stats.value.registrationLimit !== null &&
    stats.value.remainingSlots !== null &&
    stats.value.remainingSlots <= 3
  ) {
    items.push(`注册名额只剩 ${stats.value.remainingSlots} 个，提前决定是扩容还是临时收紧入口。`)
  }

  if (users.value.length === 0) {
    items.push('先用一轮自测账号走完注册、登录、停用、恢复和删除流程，确认后台口径一致。')
  }

  items.push('按上线验收清单完整跑一遍 LinuxDO 登录、体检导入、脚本下载和后台权限隔离。')

  return items.slice(0, 4)
})

function syncSettingsForm() {
  settingsForm.value = {
    registrationMode: settings.value.registrationMode || 'invite_only',
    registrationLimit: settings.value.registrationLimit ?? null
  }
}

function applyOverview(payload) {
  adminState.value = {
    status: 'ready',
    dashboards: payload.dashboards,
    operations: payload.operations,
    authManagement: payload.authManagement || emptyAuth()
  }
  syncSettingsForm()
}

async function loadAdminState(options = {}) {
  if (!options.silent) {
    adminState.value.status = 'loading'
  }
  try {
    applyOverview(await fetchAdminOverview())
  } catch {
    adminState.value.status = 'error'
    ElMessage.warning('加载管理数据失败')
  }
}

async function handleSaveSettings() {
  savingSettings.value = true
  try {
    const payload = await updateLocalAuthSettings({
      registrationMode: settingsForm.value.registrationMode,
      registrationLimit: settingsForm.value.registrationLimit
    })
    adminState.value = { ...adminState.value, authManagement: payload.authManagement }
    syncSettingsForm()
    ElMessage.success('注册策略已保存')
  } catch (error) {
    ElMessage.error(formatAdminError(error))
  } finally {
    savingSettings.value = false
  }
}

async function handleGenerateInvite() {
  generatingInvite.value = true
  try {
    const payload = await generateLocalAuthInvite({
      label: inviteForm.value.label,
      maxUses: inviteForm.value.maxUses
    })
    adminState.value = { ...adminState.value, authManagement: payload.authManagement }
    const code = payload.invite?.code || ''
    inviteForm.value = { label: '', maxUses: 1 }

    if (code && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code)
      ElMessage.success(`邀请码已生成并复制：${code}`)
    } else {
      ElMessage.success('邀请码已生成')
    }
  } catch (error) {
    ElMessage.error(formatAdminError(error))
  } finally {
    generatingInvite.value = false
  }
}

async function handleToggleInvite(invite) {
  if (!invite.editable) return
  busyInviteIds.value = { ...busyInviteIds.value, [invite.id]: true }
  try {
    const payload = await updateLocalAuthInvite({
      inviteId: invite.id,
      isEnabled: !invite.isEnabled
    })
    adminState.value = { ...adminState.value, authManagement: payload.authManagement }
    ElMessage.success(invite.isEnabled ? '邀请码已停用' : '邀请码已恢复')
  } catch (error) {
    ElMessage.error(formatAdminError(error))
  } finally {
    const next = { ...busyInviteIds.value }
    delete next[invite.id]
    busyInviteIds.value = next
  }
}

async function handleToggleUser(user) {
  busyUserIds.value = { ...busyUserIds.value, [user.id]: true }
  try {
    const payload = await updateLocalAuthUser({
      userId: user.id,
      isEnabled: !user.isEnabled
    })
    adminState.value = { ...adminState.value, authManagement: payload.authManagement }
    ElMessage.success(user.isEnabled ? '账号已停用' : '账号已恢复')
  } catch (error) {
    ElMessage.error(formatAdminError(error))
  } finally {
    const next = { ...busyUserIds.value }
    delete next[user.id]
    busyUserIds.value = next
  }
}

async function handleDeleteUser(user) {
  if (typeof window !== 'undefined') {
    const confirmed = window.confirm(`确定要删除 ${user.displayName || user.username} 吗？此操作无法撤销。`)
    if (!confirmed) return
  }

  busyUserIds.value = { ...busyUserIds.value, [user.id]: true }
  try {
    const payload = await deleteLocalAuthUser({
      userId: user.id
    })
    adminState.value = { ...adminState.value, authManagement: payload.authManagement }
    ElMessage.success('账号已删除')
  } catch (error) {
    ElMessage.error(formatAdminError(error))
  } finally {
    const next = { ...busyUserIds.value }
    delete next[user.id]
    busyUserIds.value = next
  }
}

async function handleCopyInvite(code) {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      throw new Error('copy_unavailable')
    }
    await navigator.clipboard.writeText(code)
    ElMessage.success('邀请码已复制')
  } catch {
    ElMessage.warning(`请手动复制：${code}`)
  }
}

function describeRegistrationState() {
  if (settings.value.registrationMode === 'disabled') return '当前已关闭注册，只保留已有账号登录'
  if (settings.value.registrationMode === 'public') return '当前为公开注册模式'
  if (stats.value.registrationStatus === 'invite_codes_missing') return '当前为邀请码注册，但还没有生成任何邀请码'
  if (stats.value.registrationStatus === 'invite_codes_exhausted') return '当前为邀请码注册，但现有邀请码都已经用完'
  return `当前为邀请码注册，可用邀请码 ${stats.value.inviteCodeCount} 个`
}

function formatAdminError(error) {
  return ({
    cannot_disable_current_user: '不能停用当前正在使用的管理员账号。',
    cannot_delete_current_user: '不能删除当前正在使用的管理员账号。',
    invalid_user: '目标用户不存在，请刷新后重试。',
    user_not_found: '目标用户不存在，请刷新后重试。',
    user_delete_failed: '账号删除失败，请稍后重试。',
    invalid_invite_limit: '邀请码可用次数必须大于 0。',
    invite_generate_failed: '邀请码生成失败，请稍后重试。',
    invite_update_failed: '邀请码更新失败，请稍后重试。',
    invalid_invite: '目标邀请码不存在，请刷新后重试。',
    invite_not_found: '目标邀请码不存在，请刷新后重试。',
    invite_limit_too_small: '新的可用次数不能小于当前已使用次数。'
  }[error?.code || ''] || '操作失败，请稍后重试。')
}

function formatDateTime(value) {
  if (!value) return '暂无记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function formatInviteUsage(invite) {
  if (invite.maxUses === null || invite.maxUses === undefined) {
    return invite.usedCount === null || invite.usedCount === undefined ? '不限' : `已用 ${invite.usedCount} 次 / 不限`
  }
  return `${invite.usedCount} / ${invite.maxUses}`
}

function formatInviteState(invite) {
  if (!invite.isEnabled) return ['已停用', 'danger']
  if (invite.remainingUses === 0) return ['已用完', 'warning']
  return ['可使用', 'success']
}

onMounted(() => {
  syncSettingsForm()
  loadAdminState()
})
</script>

<template>
  <section class="admin-stage">
    <section class="hero-card">
      <div class="hero-copy">
        <p class="eyebrow">管理后台</p>
        <h2>{{ activePage === 'accounts' ? '账号管理' : activePage === 'overview' ? '运营入口' : '上线状态' }}</h2>
        <p>{{ activePage === 'accounts' ? '查看注册统计、管理账号和邀请码' : activePage === 'overview' ? '流量分析与项目控制台' : '发布前检查清单' }}</p>
      </div>

      <div class="hero-side">
        <div class="owner-card">
          <strong>{{ sessionUser?.name || sessionUser?.username }}</strong>
          <span>@{{ sessionUser?.username }}</span>
        </div>

        <div class="tabs">
          <button :class="{ active: activePage === 'accounts' }" @click="activePage = 'accounts'">账号管理</button>
          <button :class="{ active: activePage === 'overview' }" @click="activePage = 'overview'">运营入口</button>
          <button :class="{ active: activePage === 'launch' }" @click="activePage = 'launch'">上线状态</button>
        </div>
      </div>
    </section>

    <template v-if="activePage === 'accounts'">
      <section class="metrics-grid">
        <article v-for="item in metricCards" :key="item.key" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <p>{{ item.hint }}</p>
        </article>
      </section>

      <div class="two-col">
        <section class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">注册控制台</p>
              <h3>注册策略设置</h3>
            </div>
            <el-tag :type="registrationStatusType" round>{{ registrationStatusLabel }}</el-tag>
          </div>

          <div class="form-grid">
            <label>
              <span>注册模式</span>
              <el-select v-model="settingsForm.registrationMode" size="large">
                <el-option label="公开注册" value="public" />
                <el-option label="邀请码注册" value="invite_only" />
                <el-option label="关闭注册" value="disabled" />
              </el-select>
            </label>

            <label>
              <span>注册名额上限</span>
              <el-input-number v-model="settingsForm.registrationLimit" :min="1" controls-position="right" />
            </label>
          </div>

          <div class="action-row">
            <el-button type="primary" :loading="savingSettings" @click="handleSaveSettings">保存注册策略</el-button>
            <el-button plain @click="syncSettingsForm">撤回未保存修改</el-button>
          </div>

          <div class="divider" />

          <div class="panel-head">
            <div>
              <p class="eyebrow">邀请码生成器</p>
              <h3>生成新邀请码</h3>
            </div>
          </div>

          <div class="form-grid">
            <label>
              <span>备注名称</span>
              <el-input v-model="inviteForm.label" maxlength="48" show-word-limit placeholder="例如：首批内测 / KOL / 合作伙伴" />
            </label>

            <label>
              <span>可用次数</span>
              <el-input-number v-model="inviteForm.maxUses" :min="1" controls-position="right" />
            </label>
          </div>

          <div class="action-row">
            <el-button type="primary" :loading="generatingInvite" @click="handleGenerateInvite">自动生成邀请码</el-button>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">数据可视化</p>
              <h3>数据统计</h3>
            </div>
            <span class="muted-pill">{{ settings.source === 'runtime' ? '后台控制' : '环境变量' }}</span>
          </div>

          <div class="chart-block">
            <div class="chart-copy">
              <strong>注册名额使用</strong>
              <span>{{ registrationLimitLabel }}</span>
            </div>
            <el-progress :percentage="stats.registrationLimit ? Math.min(100, Math.round((stats.totalUsers / stats.registrationLimit) * 100)) : 0" :show-text="stats.registrationLimit !== null" color="#1f6d5f" />
          </div>

          <div class="chart-block">
            <div class="chart-copy">
              <strong>启用中账号占比</strong>
              <span>{{ stats.enabledUsers }} / {{ stats.totalUsers || 0 }}</span>
            </div>
            <el-progress :percentage="stats.totalUsers ? Math.round((stats.enabledUsers / stats.totalUsers) * 100) : 0" color="#3a8d7f" />
          </div>

          <div class="chart-block">
            <div class="chart-copy">
              <strong>邀请码可用率</strong>
              <span>{{ stats.inviteCodeCount }} / {{ stats.totalInviteCount || 0 }}</span>
            </div>
            <el-progress :percentage="stats.totalInviteCount ? Math.round((stats.inviteCodeCount / stats.totalInviteCount) * 100) : 0" color="#526d8d" />
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">邀请码列表</p>
          </div>
        </div>

        <el-empty v-if="!invites.length" description="还没有生成任何邀请码。" />
        <el-table v-else :data="invites" stripe border>
          <el-table-column label="邀请码" min-width="180">
            <template #default="{ row }">
              <div class="code-cell">
                <strong>{{ row.code }}</strong>
                <span>{{ row.label || '未填写备注' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="使用情况" min-width="130">
            <template #default="{ row }">{{ formatInviteUsage(row) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="formatInviteState(row)[1]" round>{{ formatInviteState(row)[0] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="160">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="最近使用" min-width="160">
            <template #default="{ row }">{{ formatDateTime(row.lastUsedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="220" align="center">
            <template #default="{ row }">
              <div class="action-inline">
                <el-button plain size="small" @click="handleCopyInvite(row.code)">复制</el-button>
                <el-button v-if="row.editable" :loading="!!busyInviteIds[row.id]" :type="row.isEnabled ? 'danger' : 'primary'" plain size="small" @click="handleToggleInvite(row)">
                  {{ row.isEnabled ? '停用' : '恢复' }}
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">账号列表</p>
          </div>
          <div class="toolbar">
            <el-input v-model="userSearch" placeholder="搜索用户名或显示名" clearable class="search" />
            <el-select v-model="userStatusFilter" class="filter">
              <el-option label="全部状态" value="all" />
              <el-option label="仅启用中" value="enabled" />
              <el-option label="仅已停用" value="disabled" />
            </el-select>
            <el-button plain @click="loadAdminState({ silent: true })">刷新列表</el-button>
          </div>
        </div>

        <el-empty v-if="!users.length" description="还没有本地注册用户。" />
        <template v-else>
          <div class="table-hint">当前显示 {{ filteredUsers.length }} / {{ users.length }} 个账号。统计总数会把表里的本地账号全部算进去。</div>
          <el-table :data="filteredUsers" stripe border>
            <el-table-column label="显示名" min-width="180">
              <template #default="{ row }">
                <div class="code-cell">
                  <strong>{{ row.displayName }}</strong>
                  <span>@{{ row.username }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="row.isEnabled ? 'success' : 'danger'" round>{{ row.isEnabled ? '启用中' : '已停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="注册时间" min-width="160">
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="最近登录" min-width="160">
              <template #default="{ row }">{{ formatDateTime(row.lastLoginAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="250" align="center">
              <template #default="{ row }">
                <div class="action-inline">
                  <el-button :loading="!!busyUserIds[row.id]" :type="row.isEnabled ? 'danger' : 'primary'" plain size="small" @click="handleToggleUser(row)">
                    {{ row.isEnabled ? '停用账号' : '恢复账号' }}
                  </el-button>
                  <el-button :loading="!!busyUserIds[row.id]" type="danger" plain size="small" @click="handleDeleteUser(row)">
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </section>
    </template>

    <template v-else-if="activePage === 'overview'">
      <section class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">运营入口</p>
          </div>
        </div>
        <div class="links-grid">
          <article v-for="item in adminLinks" :key="item.key" class="link-card">
            <strong>{{ item.title }}</strong>
            <p>{{ item.description }}</p>
            <a :href="item.href" target="_blank" rel="noreferrer">{{ item.cta }}</a>
          </article>
        </div>
      </section>
    </template>

    <template v-else>
      <div class="two-col">
        <section class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">上线状态</p>
            </div>
          </div>
          <div class="check-list">
            <article v-for="item in launchItems" :key="item.key" class="check-card">
              <div class="check-copy">
                <strong>{{ item.label }}</strong>
                <p>{{ item.value }}</p>
              </div>
              <span :class="['badge', item.status]">{{ item.status === 'done' ? '已具备' : '待确认' }}</span>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">下一步建议</p>
            </div>
          </div>
          <ul class="todo-list">
            <li v-for="item in nextStepItems" :key="item">{{ item }}</li>
          </ul>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.admin-stage { display: grid; gap: 18px; }
.hero-card, .panel, .metric-card { border-radius: 26px; border: 1px solid rgba(18, 40, 37, 0.08); background: rgba(255, 255, 255, 0.84); box-shadow: 0 20px 40px rgba(21, 37, 34, 0.08); }
.hero-card { padding: 24px; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
.hero-copy, .check-copy { min-width: 0; }
.hero-copy h2, .panel h3, .metric-card strong, .link-card strong { color: #162b28; }
.hero-copy h2 { margin: 10px 0 0; font-size: 34px; line-height: 1.12; }
.hero-copy p, .panel p, .metric-card p, .link-card p, .table-hint, .todo-list { color: #647673; }
.hero-side { display: grid; gap: 14px; justify-items: end; }
.owner-card { min-width: 220px; padding: 14px 16px; border-radius: 18px; background: rgba(18, 40, 37, 0.04); display: grid; gap: 4px; }
.owner-card span, .code-cell span { color: #6f817d; font-size: 13px; }
.tabs { display: inline-flex; gap: 6px; padding: 4px; border-radius: 999px; background: rgba(18, 40, 37, 0.05); }
.tabs button { border: none; border-radius: 999px; padding: 10px 16px; background: transparent; color: #5b6e6a; font-weight: 700; cursor: pointer; }
.tabs button.active { background: #14302c; color: #f5f7f6; }
.eyebrow { margin: 0; color: #8a7355; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; }
.metrics-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.metric-card { padding: 20px; display: grid; gap: 6px; }
.metric-card span { color: #6f817d; font-size: 13px; }
.metric-card strong { font-size: 36px; line-height: 1; }
.two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.panel { padding: 22px; }
.panel-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.muted-pill, .badge { padding: 8px 12px; border-radius: 999px; background: rgba(18, 40, 37, 0.06); color: #586d69; font-size: 12px; white-space: nowrap; }
.form-grid { margin-top: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.form-grid label { display: grid; gap: 8px; }
.form-grid label span { color: #405451; font-size: 14px; font-weight: 700; }
.action-row, .toolbar, .action-inline { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.divider { margin: 22px 0; height: 1px; background: rgba(18, 40, 37, 0.08); }
.chart-block { margin-top: 18px; padding: 16px; border-radius: 18px; background: rgba(18, 40, 37, 0.04); }
.chart-copy { margin-bottom: 10px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.mini-stats { display: flex; flex-wrap: wrap; gap: 8px; }
.mini-stats span { padding: 7px 10px; border-radius: 999px; background: rgba(18, 40, 37, 0.05); color: #647673; font-size: 12px; }
.links-grid { margin-top: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.link-card { padding: 18px; border-radius: 18px; border: 1px solid rgba(18, 40, 37, 0.06); background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 247, 245, 0.98) 100%); }
.link-card a { display: inline-flex; margin-top: 12px; color: #1f6d5f; font-weight: 700; text-decoration: none; }
.search { width: 240px; }
.filter { width: 140px; }
.table-hint { margin: 14px 0; }
.code-cell { display: grid; gap: 4px; }
.check-list { margin-top: 16px; display: grid; gap: 10px; }
.check-card { padding: 14px 16px; border-radius: 18px; border: 1px solid rgba(18, 40, 37, 0.06); background: rgba(255, 255, 255, 0.75); display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.check-card p { margin: 6px 0 0; font-size: 13px; line-height: 1.7; word-break: break-word; }
.badge.done { background: rgba(31, 109, 95, 0.12); color: #1f6d5f; }
.badge.todo { background: rgba(196, 123, 54, 0.16); color: #9f5e13; }
.todo-list { margin: 14px 0 0; padding-left: 18px; line-height: 1.8; }
@media (max-width: 1180px) { .metrics-grid, .two-col, .links-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 900px) { .metrics-grid, .two-col, .links-grid, .form-grid { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .hero-card { flex-direction: column; } .hero-side { width: 100%; justify-items: stretch; } .tabs { width: 100%; display: grid; grid-template-columns: 1fr; } .search, .filter { width: 100%; } }
</style>
