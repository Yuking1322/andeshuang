<script setup>
import { computed } from 'vue'

const props = defineProps({
  selectedPackageIds: {
    type: Array,
    default: () => []
  },
  dashboardState: {
    type: Object,
    default: () => ({})
  },
  totalCategories: {
    type: Number,
    default: 0
  },
  totalPackages: {
    type: Number,
    default: 0
  }
})

const selectedCount = computed(() => props.selectedPackageIds.length)
const dashboard = computed(() => props.dashboardState || {})
const hasDetectionData = computed(() => Boolean(dashboard.value.hasDetectionData))
const installerLabel = computed(() =>
  dashboard.value.useChocolatey ? 'Chocolatey' : 'Scoop'
)
const guideCards = computed(() => [
  {
    key: 'login',
    step: '01',
    badge: '已解锁',
    title: '先登录，再开始整机配置',
    description: '控制台、体检、脚本下载和后悔药都在这一条工作流里，不需要再来回切页面。',
    hint: '你现在已经进入控制台，可以直接从体检或选环境开始。',
    tone: 'steady'
  },
  {
    key: 'detection',
    step: '02',
    badge: hasDetectionData.value ? '已导入' : '推荐',
    title: '先做一次一键体检',
    description: '下载体检器并导回 JSON 后，系统就知道哪些软件已安装，生成脚本时会自动跳过。',
    hint: hasDetectionData.value
      ? `当前已经导入体检结果，已识别 ${dashboard.value.detectedInstalledCount || 0} 项。`
      : '下载体检器 -> 双击运行 -> 导回桌面的 andeshuang-detection.json',
    tone: hasDetectionData.value ? 'success' : 'accent'
  },
  {
    key: 'selection',
    step: '03',
    badge: selectedCount.value > 0 ? '进行中' : '下一步',
    title: '按场景勾选你真正要补的环境',
    description: '支持关键词搜索、分类筛选、版本选择和依赖补齐，不用让用户自己拼命查安装顺序。',
    hint: selectedCount.value > 0
      ? `当前已选 ${selectedCount.value} 项，自动补齐依赖 ${dashboard.value.autoDependencyCount || 0} 项。`
      : '可以直接搜 Python、Docker、Node.js、数据库、AI 这类关键词。',
    tone: selectedCount.value > 0 ? 'success' : 'neutral'
  },
  {
    key: 'script',
    step: '04',
    badge: selectedCount.value > 0 ? '可执行' : '待选择',
    title: '最后生成安装脚本或后悔药',
    description: '脚本会按你当前选择的版本和安装策略生成；需要回滚时，也能直接导出卸载脚本。',
    hint: selectedCount.value > 0
      ? `当前将以 ${installerLabel.value} 为主，待安装 ${dashboard.value.selectedPendingCount || 0} 项。`
      : '至少勾选一个环境后，安装脚本和后悔药按钮才会真正有意义。',
    tone: selectedCount.value > 0 ? 'accent' : 'neutral'
  },
  {
    key: 'preset',
    step: '05',
    badge: '备用',
    title: '不想细选时，直接下预置傻瓜包',
    description: '预置包适合想马上起步的用户；如果执行失败，优先去看脚本旁边自动生成的日志。',
    hint: '右下方的环境控制台和右侧 AI 助手可以一起配合使用，先问再选会更稳。',
    tone: 'steady'
  }
])
</script>

<template>
  <section class="guide-shell">
    <div class="guide-header">
      <div>
        <p class="guide-label">操作文档</p>
        <h2>第一次来，就按这 5 步往下走</h2>
        <p class="guide-copy">
          这块放的不是营销话术，而是给第一次使用的同学看的实际操作路线。先看这块，再往下配环境，理解成本会低很多。
        </p>
      </div>

      <div class="guide-metrics">
        <span>{{ totalCategories }} 个环境方向</span>
        <span>{{ totalPackages }} 个可选组件</span>
        <span>{{ dashboard.selectedPendingCount || 0 }} 项待安装</span>
        <span>{{ hasDetectionData ? '已导入体检结果' : '尚未导入体检结果' }}</span>
      </div>
    </div>

    <div class="guide-grid">
      <article
        v-for="card in guideCards"
        :key="card.key"
        :class="['guide-card', `is-${card.tone}`]"
      >
        <div class="guide-card-head">
          <span class="guide-step">{{ card.step }}</span>
          <span class="guide-badge">{{ card.badge }}</span>
        </div>
        <strong>{{ card.title }}</strong>
        <p>{{ card.description }}</p>
        <div class="guide-foot">{{ card.hint }}</div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.guide-shell {
  display: grid;
  gap: 18px;
  padding: 26px 24px;
  border-radius: 28px;
  border: 1px solid rgba(18, 40, 37, 0.08);
  background:
    radial-gradient(circle at 8% 18%, rgba(196, 123, 54, 0.14), transparent 18%),
    radial-gradient(circle at 92% 0%, rgba(47, 117, 105, 0.14), transparent 22%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.96) 0%, rgba(246, 248, 245, 0.98) 100%);
  box-shadow: 0 22px 44px rgba(21, 37, 34, 0.08);
}

.guide-header {
  display: grid;
  gap: 16px;
}

.guide-label {
  margin: 0;
  color: #8a7355;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.guide-header h2 {
  margin: 10px 0 0;
  color: #152b27;
  font-size: clamp(34px, 4vw, 54px);
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.guide-copy {
  margin: 16px 0 0;
  max-width: 980px;
  color: #647673;
  font-size: 16px;
  line-height: 1.85;
}

.guide-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.guide-metrics span {
  padding: 9px 13px;
  border-radius: 999px;
  background: rgba(20, 44, 40, 0.05);
  border: 1px solid rgba(20, 44, 40, 0.06);
  color: #526663;
  font-size: 13px;
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.guide-card {
  min-height: 220px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid rgba(18, 40, 37, 0.08);
  background: rgba(255, 255, 255, 0.86);
  display: grid;
  gap: 12px;
  box-shadow: 0 18px 34px rgba(18, 40, 37, 0.06);
}

.guide-card.is-success {
  border-color: rgba(47, 117, 105, 0.18);
  background: linear-gradient(180deg, rgba(240, 248, 245, 0.98) 0%, rgba(255, 255, 255, 0.92) 100%);
}

.guide-card.is-accent {
  border-color: rgba(196, 123, 54, 0.2);
  background: linear-gradient(180deg, rgba(251, 246, 240, 0.98) 0%, rgba(255, 255, 255, 0.92) 100%);
}

.guide-card.is-steady {
  background: linear-gradient(180deg, rgba(248, 250, 248, 0.98) 0%, rgba(255, 255, 255, 0.92) 100%);
}

.guide-card.is-neutral {
  background: linear-gradient(180deg, rgba(247, 248, 247, 0.98) 0%, rgba(255, 255, 255, 0.92) 100%);
}

.guide-card-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.guide-step,
.guide-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.guide-step {
  min-width: 42px;
  height: 32px;
  padding: 0 12px;
  background: rgba(18, 40, 37, 0.08);
  color: #173f38;
}

.guide-badge {
  min-height: 32px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(18, 40, 37, 0.08);
  color: #5b6f6b;
}

.guide-card strong {
  color: #162b28;
  font-size: 18px;
  line-height: 1.35;
}

.guide-card p {
  margin: 0;
  color: #647673;
  font-size: 14px;
  line-height: 1.75;
}

.guide-foot {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(18, 40, 37, 0.08);
  color: #526663;
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 760px) {
  .guide-shell {
    padding: 18px;
  }
}
</style>
