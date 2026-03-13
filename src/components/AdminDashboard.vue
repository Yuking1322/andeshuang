<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchAdminOverview } from '../utils/adminApi.js'

const props = defineProps({
  sessionUser: {
    type: Object,
    default: null
  }
})

const activePage = ref('overview')
const analyticsRuntimeDetected = ref(false)
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
  }
})

const appHomepage = computed(() =>
  (import.meta.env.VITE_APP_HOMEPAGE || 'https://andeshuang.pages.dev').trim()
)

const adminLinks = computed(() => {
  const dashboards = adminState.value.dashboards

  return [
    {
      key: 'cloudflare',
      title: 'Cloudflare 总控台',
      description: '统一进入 Pages、Functions、日志和账号级控制台。',
      href: dashboards.cloudflareHome || 'https://dash.cloudflare.com/',
      cta: '打开总控台'
    },
    {
      key: 'traffic',
      title: '访问量入口',
      description: dashboards.webAnalytics
        ? '已配置专用的访问量入口，直接跳转查看 Web Analytics。'
        : dashboards.pagesProject
          ? '如果你已经在 Pages 项目里点了 Web Analytics 的 Enable，可以直接从项目页进入 Metrics 查看访问量。'
          : '先进入 Cloudflare 总控台，在 Pages 项目的 Metrics / Web Analytics 中查看访问量。',
      href: dashboards.webAnalytics || dashboards.pagesProject || dashboards.cloudflareHome || 'https://dash.cloudflare.com/',
      cta: dashboards.webAnalytics
        ? '查看访问量'
        : dashboards.pagesProject
          ? '去项目页看 Metrics'
          : '去 Cloudflare 查访问量'
    },
    {
      key: 'downloads',
      title: '下载量入口',
      description: dashboards.downloads
        ? '已配置专用的下载量入口，适合查看静态资源或对象存储分发情况。'
        : '下载量目前建议在 Cloudflare / GitHub Releases / R2 控制台里查看。',
      href: dashboards.downloads || dashboards.pagesProject || dashboards.cloudflareHome || 'https://dash.cloudflare.com/',
      cta: dashboards.downloads ? '查看下载量' : '查看下载分发'
    },
    {
      key: 'pages',
      title: 'Pages 项目入口',
      description: dashboards.pagesProject
        ? '直接进入 andeshuang.pages.dev 对应项目。'
        : '进入 Pages 项目后可查看部署记录、域名、日志和 Functions。',
      href: dashboards.pagesProject || dashboards.cloudflareHome || 'https://dash.cloudflare.com/',
      cta: dashboards.pagesProject ? '打开 Pages 项目' : '去 Pages 项目页'
    }
  ]
})

const analyticsStatus = computed(() => {
  if (analyticsRuntimeDetected.value) {
    return '当前页面已检测到统计脚本'
  }

  if (adminState.value.dashboards.webAnalytics) {
    return '已配置专用入口'
  }

  if (adminState.value.dashboards.pagesProject) {
    return '可从 Pages 项目进入 Metrics'
  }

  return '待补充项目入口'
})

const analyticsHint = computed(() => {
  if (analyticsRuntimeDetected.value) {
    return '这说明当前页面至少已经挂上了 Cloudflare Web Analytics 脚本，后面重点看控制台数据是否开始累计。'
  }

  if (adminState.value.dashboards.webAnalytics) {
    return '后台已经拿到专用 Analytics 入口，但我暂时还没在当前页面里观测到脚本，建议再看一次线上部署状态。'
  }

  if (adminState.value.dashboards.pagesProject) {
    return '你可以直接从 Pages 项目页进 Metrics，再确认 Enable 之后的新部署是否已经完成。'
  }

  return '当前只保留了默认 Cloudflare 入口，建议把项目直达链接也补进环境变量。'
})

const launchChecklist = computed(() => [
  {
    key: 'homepage',
    label: '线上主页',
    value: appHomepage.value,
    status: 'done'
  },
  {
    key: 'functions',
    label: '登录服务端',
    value: 'Cloudflare Pages Functions 承接 /api/session 与 /api/auth/*',
    status: 'done'
  },
  {
    key: 'downloads',
    label: '预置下载分发',
    value: '当前预置 Windows 包走 Pages 静态目录 public/downloads/windows',
    status: 'done'
  },
  {
    key: 'pages',
    label: 'Pages 项目入口',
    value: adminState.value.dashboards.pagesProject || '还没补充项目直达链接',
    status: adminState.value.dashboards.pagesProject ? 'done' : 'todo'
  },
  {
    key: 'analytics',
    label: 'Web Analytics',
    value: analyticsRuntimeDetected.value
      ? '当前页面已检测到 Cloudflare beacon 脚本'
      : adminState.value.dashboards.webAnalytics
        ? '已经配置专用 Analytics 入口，建议确认最新部署是否已生效'
        : '建议回到 Pages 项目 Metrics 再确认 Enable 和最新部署',
    status: analyticsRuntimeDetected.value || adminState.value.dashboards.webAnalytics ? 'done' : 'todo'
  }
])

const strategyCards = computed(() => [
  {
    key: 'traffic',
    title: '流量说明',
    description: '静态页面和下载优先走 Pages，真正消耗 Functions 配额的是登录、会话和以后新增的后台接口。',
    detail: adminState.value.operations.functionsBudget || 'Workers Free 通常按每日 100000 次请求量级来估算。'
  },
  {
    key: 'release',
    title: '发布方式',
    description: '当前最稳的方式仍然是 GitHub 推送触发 Cloudflare Pages 自动部署。',
    detail: '这次我已经把代码推到 origin/main，后续可继续沿用这条发布链路。'
  },
  {
    key: 'downloads',
    title: '下载分发',
    description: '小脚本和预置傻瓜包继续放 Pages；大体积安装器以后再迁到 GitHub Releases 或 R2。',
    detail: '这样前期够轻，后期也方便扩容。'
  },
  {
    key: 'auth',
    title: '登录策略',
    description: '用户必须先通过 LinuxDO 登录，再进入控制台；管理员后台再基于白名单额外放行。',
    detail: '当前白名单逻辑已经在服务端接口里生效。'
  }
])

const nextStepItems = computed(() => {
  const items = [
    '重新打开线上站点并用 LinuxDO 登录一次，确认后台入口仍然只对你可见。',
    '到 Cloudflare Pages 的最新部署页确认这次 GitHub 推送已经构建完成。'
  ]

  if (analyticsRuntimeDetected.value) {
    items.push('现在重点观察 Cloudflare Metrics 里是否开始出现真实访问数据。')
  } else {
    items.push('如果 Metrics 里已经点过 Enable，但页面还没探测到脚本，优先确认最新部署是否已经完成。')
  }

  if (!adminState.value.dashboards.pagesProject) {
    items.push('后面把 CLOUDFLARE_PAGES_PROJECT_URL 配进去，这样后台就能一键跳到你的项目页。')
  }

  return items
})

function refreshRuntimeSignals() {
  if (typeof document === 'undefined') return
  analyticsRuntimeDetected.value = Boolean(
    document.querySelector('script[src*="static.cloudflareinsights.com/beacon.min.js"]')
  )
}

onMounted(async () => {
  refreshRuntimeSignals()

  try {
    const payload = await fetchAdminOverview()
    adminState.value = {
      status: 'ready',
      dashboards: payload.dashboards,
      operations: payload.operations
    }
  } catch {
    adminState.value.status = 'error'
    ElMessage.warning('管理员后台入口信息加载失败，已使用默认 Cloudflare 入口')
  } finally {
    refreshRuntimeSignals()
    window.setTimeout(refreshRuntimeSignals, 400)
  }
})
</script>

<template>
  <section class="admin-stage">
    <section class="admin-hero">
      <div>
        <p class="admin-label">Admin Console</p>
        <h2>{{ activePage === 'overview' ? '这是你的管理员后台第一页' : '这是你的管理员后台第二页' }}</h2>
        <p class="admin-copy">
          {{
            activePage === 'overview'
              ? '第一页继续集中放运营入口：当前登录管理员、访问量入口、下载量入口和 Cloudflare Analytics 状态。'
              : '第二页专门放上线状态、流量说明、下载分发策略和部署检查项，方便你发出之前自己快速过一遍。'
          }}
        </p>
      </div>

      <div class="admin-hero-side">
        <div class="admin-owner">
          <img v-if="sessionUser?.avatar" :src="sessionUser.avatar" alt="avatar">
          <div>
            <strong>{{ sessionUser?.name || sessionUser?.username }}</strong>
            <span>@{{ sessionUser?.username }}</span>
          </div>
        </div>

        <div class="view-switch">
          <button
            type="button"
            :class="['view-switch-button', { active: activePage === 'overview' }]"
            @click="activePage = 'overview'"
          >
            第一页
          </button>
          <button
            type="button"
            :class="['view-switch-button', { active: activePage === 'launch' }]"
            @click="activePage = 'launch'"
          >
            第二页
          </button>
        </div>
      </div>
    </section>

    <template v-if="activePage === 'overview'">
      <div class="admin-grid">
        <section class="admin-card owner-card">
          <p class="card-label">当前登录用户</p>
          <h3>{{ sessionUser?.name || sessionUser?.username }}</h3>
          <p>当前后台默认按已登录 LinuxDO 账号展示，不单独维护用户数据库。</p>
          <div class="meta-pills">
            <span>@{{ sessionUser?.username }}</span>
            <span v-if="sessionUser?.trustLevel !== null">信任等级 {{ sessionUser?.trustLevel }}</span>
          </div>
        </section>

        <section class="admin-card status-card">
          <p class="card-label">Cloudflare Analytics</p>
          <h3>{{ analyticsStatus }}</h3>
          <p>{{ analyticsHint }}</p>
          <div class="status-list">
            <p><span>静态资源</span><strong>优先走 Pages</strong></p>
            <p><span>登录接口</span><strong>走 Functions</strong></p>
            <p><span>函数额度</span><strong>{{ adminState.operations.functionsBudget || 'Workers Free 100000 次/日量级' }}</strong></p>
          </div>
        </section>
      </div>

      <section class="admin-card links-card">
        <div class="links-head">
          <div>
            <p class="card-label">运营入口</p>
            <h3>流量、下载、部署都从这里进</h3>
          </div>
          <span class="head-badge">{{ adminState.status === 'ready' ? '已连接后台接口' : '使用默认入口' }}</span>
        </div>

        <div class="links-grid">
          <article
            v-for="item in adminLinks"
            :key="item.key"
            class="link-tile"
          >
            <strong>{{ item.title }}</strong>
            <p>{{ item.description }}</p>
            <a :href="item.href" target="_blank" rel="noreferrer">{{ item.cta }}</a>
          </article>
        </div>
      </section>

      <section class="admin-card tips-card">
        <p class="card-label">运营建议</p>
        <ul>
          <li>静态页面和小脚本尽量继续放在 Pages，省额度也省心。</li>
          <li>真正吃 Functions 配额的是登录、会话和以后新增的后台接口。</li>
          <li>如果后面要看更细的下载统计，优先把大文件分发迁到 GitHub Releases 或 R2。</li>
        </ul>
      </section>
    </template>

    <template v-else>
      <div class="admin-grid">
        <section class="admin-card status-card">
          <p class="card-label">上线状态</p>
          <h3>把“能不能发出去”拆成几个可检查项</h3>
          <div class="checklist">
            <article
              v-for="item in launchChecklist"
              :key="item.key"
              class="check-item"
            >
              <div>
                <strong>{{ item.label }}</strong>
                <p>{{ item.value }}</p>
              </div>
              <span :class="['status-badge', item.status]">
                {{ item.status === 'done' ? '已具备' : '待确认' }}
              </span>
            </article>
          </div>
        </section>

        <section class="admin-card status-card">
          <p class="card-label">流量与统计</p>
          <h3>{{ analyticsStatus }}</h3>
          <p>{{ analyticsHint }}</p>
          <div class="status-list">
            <p><span>线上主页</span><strong>{{ appHomepage }}</strong></p>
            <p><span>页面统计脚本</span><strong>{{ analyticsRuntimeDetected ? '当前页面已探测到' : '当前页面未探测到' }}</strong></p>
            <p><span>Pages 入口</span><strong>{{ adminState.dashboards.pagesProject ? '已配置' : '建议补充' }}</strong></p>
          </div>
        </section>
      </div>

      <section class="admin-card links-card">
        <div class="links-head">
          <div>
            <p class="card-label">分发策略</p>
            <h3>把当前架构和后续扩展路线讲明白</h3>
          </div>
          <span class="head-badge">管理员后台第二页</span>
        </div>

        <div class="strategy-grid">
          <article
            v-for="item in strategyCards"
            :key="item.key"
            class="strategy-tile"
          >
            <strong>{{ item.title }}</strong>
            <p>{{ item.description }}</p>
            <span>{{ item.detail }}</span>
          </article>
        </div>
      </section>

      <section class="admin-card tips-card">
        <p class="card-label">下一步建议</p>
        <ul>
          <li
            v-for="item in nextStepItems"
            :key="item"
          >
            {{ item }}
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>

<style scoped>
.admin-stage {
  display: grid;
  gap: 18px;
}

.admin-hero,
.admin-card {
  border-radius: 28px;
  border: 1px solid rgba(18, 40, 37, 0.08);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 20px 40px rgba(21, 37, 34, 0.08);
}

.admin-hero {
  padding: 26px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  background:
    radial-gradient(circle at top right, rgba(47, 117, 105, 0.14), transparent 22%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.94) 0%, rgba(244, 247, 245, 0.98) 100%);
}

.admin-hero-side {
  display: grid;
  gap: 14px;
  justify-items: end;
}

.admin-label,
.card-label {
  margin: 0;
  color: #8a7355;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.admin-hero h2,
.admin-card h3 {
  margin: 10px 0 0;
  color: #162b28;
}

.admin-hero h2 {
  font-size: 34px;
  line-height: 1.12;
}

.admin-copy,
.admin-card p,
.link-tile p,
.strategy-tile p {
  margin: 12px 0 0;
  color: #647673;
  line-height: 1.8;
}

.admin-owner {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(18, 40, 37, 0.04);
  min-width: 220px;
}

.admin-owner img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.admin-owner strong {
  display: block;
  color: #162b28;
}

.admin-owner span {
  color: #6f817d;
  font-size: 13px;
}

.view-switch {
  display: inline-flex;
  padding: 4px;
  gap: 6px;
  border-radius: 999px;
  background: rgba(18, 40, 37, 0.05);
  border: 1px solid rgba(18, 40, 37, 0.06);
}

.view-switch-button {
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #5b6e6a;
  font-weight: 700;
  font-size: 13px;
  padding: 10px 16px;
  cursor: pointer;
}

.view-switch-button.active {
  background: #14302c;
  color: #f5f7f6;
}

.admin-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.admin-card {
  padding: 22px;
}

.meta-pills {
  margin-top: 16px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.meta-pills span,
.head-badge,
.status-badge {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(18, 40, 37, 0.06);
  color: #586d69;
  font-size: 12px;
}

.status-badge.done {
  background: rgba(31, 109, 95, 0.12);
  color: #1f6d5f;
}

.status-badge.todo {
  background: rgba(196, 123, 54, 0.16);
  color: #9f5e13;
}

.status-list,
.checklist {
  margin-top: 16px;
  display: grid;
  gap: 10px;
}

.status-list p,
.check-item {
  margin: 0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.status-list span {
  color: #6f817d;
}

.status-list strong,
.check-item strong,
.strategy-tile strong,
.link-tile strong {
  color: #162b28;
}

.status-list strong {
  font-size: 13px;
}

.check-item {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(18, 40, 37, 0.06);
  background: rgba(255, 255, 255, 0.75);
}

.check-item p {
  margin: 6px 0 0;
  font-size: 13px;
}

.links-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.links-grid,
.strategy-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.link-tile,
.strategy-tile {
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(18, 40, 37, 0.06);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 247, 245, 0.98) 100%);
}

.link-tile strong,
.strategy-tile strong {
  font-size: 18px;
}

.link-tile a {
  display: inline-flex;
  margin-top: 14px;
  color: #1f6d5f;
  font-weight: 700;
  text-decoration: none;
}

.strategy-tile span {
  display: inline-flex;
  margin-top: 14px;
  color: #586d69;
  font-size: 13px;
  line-height: 1.7;
}

.tips-card ul {
  margin: 14px 0 0;
  padding-left: 18px;
  color: #647673;
  line-height: 1.8;
}

@media (max-width: 960px) {
  .admin-grid,
  .links-grid,
  .strategy-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .admin-hero {
    flex-direction: column;
    padding: 18px;
  }

  .admin-hero-side {
    width: 100%;
    justify-items: stretch;
  }

  .admin-card {
    padding: 18px;
  }

  .admin-owner {
    width: 100%;
  }

  .view-switch {
    width: 100%;
    justify-content: space-between;
  }

  .view-switch-button {
    flex: 1;
  }
}
</style>
