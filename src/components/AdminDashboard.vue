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
      href: dashboards.webAnalytics || dashboards.cloudflareHome || 'https://dash.cloudflare.com/',
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

const analyticsStatus = computed(() =>
  adminState.value.dashboards.webAnalytics
    ? '已配置专用入口'
    : adminState.value.dashboards.pagesProject
      ? '可从 Pages 项目进入 Metrics'
      : '待补充项目入口'
)

onMounted(async () => {
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
  }
})
</script>

<template>
  <section class="admin-stage">
    <section class="admin-hero">
      <div>
        <p class="admin-label">Admin Console</p>
        <h2>这是你的管理员后台第一页</h2>
        <p class="admin-copy">
          这里先把最关键的运营入口集中起来：当前登录管理员、访问量入口、下载量入口和 Cloudflare Analytics 状态。
        </p>
      </div>

      <div class="admin-owner">
        <img v-if="sessionUser?.avatar" :src="sessionUser.avatar" alt="avatar">
        <div>
          <strong>{{ sessionUser?.name || sessionUser?.username }}</strong>
          <span>@{{ sessionUser?.username }}</span>
        </div>
      </div>
    </section>

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
        <p>如果你已经在 Pages 面板点了 Web Analytics 的 Enable，这里至少会把你带回项目入口，不会误导成“还没开”。</p>
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
.link-tile p {
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
.head-badge {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(18, 40, 37, 0.06);
  color: #586d69;
  font-size: 12px;
}

.status-list {
  margin-top: 16px;
  display: grid;
  gap: 10px;
}

.status-list p {
  margin: 0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.status-list span {
  color: #6f817d;
}

.status-list strong {
  color: #162b28;
  font-size: 13px;
}

.links-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.links-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.link-tile {
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(18, 40, 37, 0.06);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 247, 245, 0.98) 100%);
}

.link-tile strong {
  color: #162b28;
  font-size: 18px;
}

.link-tile a {
  display: inline-flex;
  margin-top: 14px;
  color: #1f6d5f;
  font-weight: 700;
  text-decoration: none;
}

.tips-card ul {
  margin: 14px 0 0;
  padding-left: 18px;
  color: #647673;
  line-height: 1.8;
}

@media (max-width: 960px) {
  .admin-grid,
  .links-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .admin-hero {
    flex-direction: column;
    padding: 18px;
  }

  .admin-card {
    padding: 18px;
  }

  .admin-owner {
    width: 100%;
  }
}
</style>
