<script setup>
import { computed, ref, watch } from 'vue'
import { Download, DocumentCopy, Monitor } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { environments, resolveDependencies } from '../data/environments.js'
import { generateScript } from '../utils/scriptGenerator.js'
import {
  createEmptyDetectionSnapshot,
  generateDetectionLauncher,
  getDetectionEntry,
  normalizeDetectionPayload
} from '../utils/detectionScript.js'

const DETECTION_STORAGE_KEY = 'andeshuang-detection-snapshot'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

const categoryKeys = Object.keys(environments)
const activeTab = ref(categoryKeys[0] ?? 'frontend')
const selectedPackages = ref([...props.modelValue])
const showPreview = ref(false)
const generatedScript = ref('')
const useChocolatey = ref(true)
const detectionInputRef = ref(null)
const detectionSnapshot = ref(readStoredDetectionSnapshot())

watch(
  () => props.modelValue,
  (nextValue) => {
    const incoming = Array.isArray(nextValue) ? nextValue : []
    if (incoming.join('|') !== selectedPackages.value.join('|')) {
      selectedPackages.value = [...incoming]
    }
  }
)

const selectedCount = computed(() => selectedPackages.value.length)
const resolvedIds = computed(() => resolveDependencies(selectedPackages.value))
const autoDependencyCount = computed(() => Math.max(0, resolvedIds.value.length - selectedPackages.value.length))
const detectionResults = computed(() => detectionSnapshot.value.results ?? {})
const hasDetectionData = computed(() => Object.keys(detectionResults.value).length > 0)
const installedPackageIds = computed(() =>
  Object.entries(detectionResults.value)
    .filter(([, value]) => value?.installed)
    .map(([id]) => id)
)
const detectedInstalledCount = computed(() => installedPackageIds.value.length)
const pendingInstallIds = computed(() =>
  resolvedIds.value.filter((id) => !getDetectionEntry(detectionSnapshot.value, id).installed)
)
const skippedInstalledCount = computed(() => Math.max(0, resolvedIds.value.length - pendingInstallIds.value.length))
const selectedPendingCount = computed(() =>
  hasDetectionData.value ? pendingInstallIds.value.length : resolvedIds.value.length
)
const previewTitle = computed(() =>
  useChocolatey.value ? 'Chocolatey 安装脚本预览' : 'Scoop 安装脚本预览'
)
const managerSummary = computed(() =>
  useChocolatey.value
    ? '适合需要管理员权限的完整安装方案。'
    : '适合普通权限环境，尽量减少系统改动。'
)
const detectionSummary = computed(() => {
  if (!hasDetectionData.value) {
    return '还没导入检测结果时，系统会按当前勾选项完整生成安装脚本。'
  }

  return `本次将安装 ${selectedPendingCount.value} 项，跳过已安装 ${skippedInstalledCount.value} 项。`
})
const formattedDetectionTime = computed(() => {
  if (!detectionSnapshot.value.generatedAt) return ''

  const parsed = new Date(detectionSnapshot.value.generatedAt)
  if (Number.isNaN(parsed.getTime())) return detectionSnapshot.value.generatedAt

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(parsed)
})

const isSelected = (packageId) => selectedPackages.value.includes(packageId)
const getPackageDetection = (packageId) => getDetectionEntry(detectionSnapshot.value, packageId)

const emitSelection = () => {
  emit('update:modelValue', [...selectedPackages.value])
}

const togglePackage = (packageId, checked) => {
  const selected = isSelected(packageId)
  const shouldEnable = typeof checked === 'boolean' ? checked : !selected

  if (shouldEnable && !selected) {
    selectedPackages.value = [...selectedPackages.value, packageId]
  }

  if (!shouldEnable && selected) {
    selectedPackages.value = selectedPackages.value.filter((id) => id !== packageId)
  }

  emitSelection()
}

const clearSelection = () => {
  selectedPackages.value = []
  emitSelection()
  ElMessage.info('已清空当前选择')
}

const handleGenerateScript = () => {
  if (selectedPackages.value.length === 0) {
    ElMessage.warning('请先选择至少一个软件包')
    return
  }

  const packageIdsToInstall = hasDetectionData.value ? pendingInstallIds.value : resolvedIds.value

  if (hasDetectionData.value && packageIdsToInstall.length === 0) {
    ElMessage.success('根据体检结果，当前所选环境已经安装完成')
    return
  }

  generatedScript.value = generateScript(packageIdsToInstall, useChocolatey.value)
  showPreview.value = true
}

const handleDownloadScript = () => {
  downloadTextFile('安的爽-一键安装.bat', generatedScript.value)
  ElMessage.success('安装脚本已下载，双击即可运行')
}

const handleCopyScript = async () => {
  if (!generatedScript.value) return

  try {
    await navigator.clipboard.writeText(generatedScript.value)
    ElMessage.success('脚本已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

const handleDownloadDetection = () => {
  downloadTextFile('安的爽-一键体检.cmd', generateDetectionLauncher())
  ElMessage.success('一键体检器已下载，双击运行后把桌面 JSON 导回页面即可')
}

const openDetectionImport = () => {
  detectionInputRef.value?.click()
}

const handleDetectionImport = async (event) => {
  const [file] = event.target.files || []
  event.target.value = ''

  if (!file) return

  try {
    const payload = JSON.parse(await file.text())
    const normalized = normalizeDetectionPayload(payload)
    detectionSnapshot.value = normalized
    persistDetectionSnapshot(normalized)
    ElMessage.success('体检结果已导入，后续会自动跳过已安装项')
  } catch {
    ElMessage.error('检测结果解析失败，请确认导入的是体检器生成的 JSON 文件')
  }
}

const clearDetectionSnapshot = () => {
  detectionSnapshot.value = createEmptyDetectionSnapshot()
  removeStoredDetectionSnapshot()
  ElMessage.info('已清除体检结果')
}

function readStoredDetectionSnapshot() {
  if (typeof window === 'undefined') {
    return createEmptyDetectionSnapshot()
  }

  const raw = window.localStorage.getItem(DETECTION_STORAGE_KEY)
  if (!raw) {
    return createEmptyDetectionSnapshot()
  }

  try {
    return normalizeDetectionPayload(JSON.parse(raw))
  } catch {
    window.localStorage.removeItem(DETECTION_STORAGE_KEY)
    return createEmptyDetectionSnapshot()
  }
}

function persistDetectionSnapshot(snapshot) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DETECTION_STORAGE_KEY, JSON.stringify(snapshot))
}

function removeStoredDetectionSnapshot() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(DETECTION_STORAGE_KEY)
}

function downloadTextFile(fileName, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function formatVersion(version) {
  if (!version) return ''

  const compact = version.replace(/\s+/g, ' ').trim()
  if (compact.length <= 42) return compact
  return `${compact.slice(0, 39)}...`
}
</script>

<template>
  <section class="environment-selector">
    <div class="board-grid">
      <el-card class="board-card detect-board">
        <div class="board-head">
          <div>
            <p class="board-kicker">智能体检</p>
            <h2>先看电脑里已经有什么</h2>
          </div>
          <span class="board-badge">{{ detectedInstalledCount }} 项已识别</span>
        </div>

        <p class="board-copy">
          现在是更傻瓜式流程：先下载一键体检器，双击运行，桌面会自动生成检测结果。导回页面后，已安装的软件会直接标记出来，后续不再重复安装。
        </p>

        <div class="metric-strip">
          <article class="mini-metric">
            <span class="mini-value">{{ detectedInstalledCount }}</span>
            <span class="mini-label">已识别</span>
          </article>
          <article class="mini-metric">
            <span class="mini-value">{{ skippedInstalledCount }}</span>
            <span class="mini-label">可跳过</span>
          </article>
          <article class="mini-metric">
            <span class="mini-value">{{ hasDetectionData ? '已导入' : '未导入' }}</span>
            <span class="mini-label">体检状态</span>
          </article>
        </div>

        <div class="step-row">
          <span>下载体检器</span>
          <span>双击运行</span>
          <span>导入 JSON</span>
        </div>

        <div class="board-actions">
          <el-button type="primary" :icon="Monitor" @click="handleDownloadDetection">
            下载一键体检器
          </el-button>
          <el-button plain @click="openDetectionImport">
            导入检测结果
          </el-button>
          <el-button v-if="hasDetectionData" text @click="clearDetectionSnapshot">
            清除体检结果
          </el-button>
        </div>

        <p class="board-note">
          {{ detectionSummary }}
          <template v-if="hasDetectionData && formattedDetectionTime">
            最近体检：{{ formattedDetectionTime }}<span v-if="detectionSnapshot.machineName"> · {{ detectionSnapshot.machineName }}</span>
          </template>
        </p>

        <input
          ref="detectionInputRef"
          class="sr-only"
          type="file"
          accept=".json,application/json"
          @change="handleDetectionImport"
        >
      </el-card>

      <el-card class="board-card config-board">
        <div class="board-head">
          <div>
            <p class="board-kicker">配置环境</p>
            <h2>再决定这台电脑还缺什么</h2>
          </div>
          <span class="board-badge warm">{{ selectedPendingCount }} 项待安装</span>
        </div>

        <p class="board-copy">
          选好要的环境后，系统会自动补齐依赖，并根据体检结果跳过已安装的软件，只保留真正需要装的部分。
        </p>

        <div class="config-metrics">
          <article class="config-metric">
            <strong>{{ selectedCount }}</strong>
            <span>当前勾选</span>
          </article>
          <article class="config-metric">
            <strong>{{ autoDependencyCount }}</strong>
            <span>自动补齐依赖</span>
          </article>
          <article class="config-metric">
            <strong>{{ selectedPendingCount }}</strong>
            <span>实际待安装</span>
          </article>
        </div>

        <div class="manager-picker">
          <p class="picker-label">安装方式</p>
          <el-radio-group v-model="useChocolatey">
            <el-radio :value="true">Chocolatey（管理员）</el-radio>
            <el-radio :value="false">Scoop（普通权限）</el-radio>
          </el-radio-group>
          <p class="picker-note">{{ managerSummary }}</p>
        </div>

        <div class="board-actions">
          <el-button plain :disabled="selectedCount === 0" @click="clearSelection">
            清空选择
          </el-button>
          <el-button
            type="primary"
            :icon="Download"
            :disabled="selectedCount === 0"
            @click="handleGenerateScript"
          >
            生成安装脚本
          </el-button>
        </div>
      </el-card>
    </div>

    <el-card class="library-card">
      <template #header>
        <div class="library-head">
          <div>
            <h2>环境软件库</h2>
            <p>点卡片即可勾选。看到“已安装”时，说明体检结果已经识别到它。</p>
          </div>
          <div class="library-tags">
            <el-tag type="success">已选 {{ selectedCount }}</el-tag>
            <el-tag v-if="autoDependencyCount > 0" type="warning">自动依赖 +{{ autoDependencyCount }}</el-tag>
            <el-tag v-if="hasDetectionData" type="info">已识别 {{ detectedInstalledCount }}</el-tag>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" class="env-tabs">
        <el-tab-pane
          v-for="(env, key) in environments"
          :key="key"
          :name="key"
        >
          <template #label>
            <span class="tab-label">
              <span class="tab-icon">{{ env.icon }}</span>
              {{ env.name }}
            </span>
          </template>

          <div class="env-description">
            <p>{{ env.description }}</p>
            <el-tag type="info" effect="plain">{{ env.packages.length }} 个软件包</el-tag>
          </div>

          <div class="packages-grid">
            <article
              v-for="(pkg, index) in env.packages"
              :key="pkg.id"
              class="package-card"
              :class="{
                'is-selected': isSelected(pkg.id),
                'is-installed': getPackageDetection(pkg.id).installed
              }"
              :style="{ animationDelay: `${index * 0.05}s` }"
              @click="togglePackage(pkg.id)"
            >
              <div class="card-top">
                <el-checkbox
                  :model-value="isSelected(pkg.id)"
                  @click.stop
                  @change="(val) => togglePackage(pkg.id, val)"
                />
                <div class="card-badges">
                  <el-tag v-if="getPackageDetection(pkg.id).installed" type="success" size="small">已安装</el-tag>
                  <el-tag v-if="pkg.popular" type="warning" size="small">热门</el-tag>
                  <el-tag v-if="pkg.dependencies?.length" type="info" size="small">有依赖</el-tag>
                </div>
              </div>

              <div class="card-main">
                <h3>{{ pkg.name }}</h3>
                <p>{{ pkg.description }}</p>
              </div>

              <div class="card-meta">
                <div v-if="getPackageDetection(pkg.id).installed" class="meta-item success">
                  <span class="meta-label success">状态</span>
                  <span>
                    已检测到
                    <template v-if="formatVersion(getPackageDetection(pkg.id).version)">
                      · {{ formatVersion(getPackageDetection(pkg.id).version) }}
                    </template>
                  </span>
                </div>
                <div v-if="pkg.dependencies?.length" class="meta-item">
                  <span class="meta-label">依赖</span>
                  <span>{{ pkg.dependencies.join(', ') }}</span>
                </div>
                <div v-if="pkg.size" class="meta-item">
                  <span class="meta-label">体积</span>
                  <span>{{ pkg.size }}</span>
                </div>
                <div v-if="pkg.note" class="meta-item warning">
                  <span class="meta-label">提示</span>
                  <span>{{ pkg.note }}</span>
                </div>
              </div>
            </article>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog
      v-model="showPreview"
      :title="previewTitle"
      width="860px"
    >
      <el-alert
        title="使用说明"
        type="info"
        :closable="false"
        class="preview-alert"
      >
        <p>
          下载后双击运行脚本，根据提示完成安装。安装结束后建议重启终端。
          <template v-if="hasDetectionData && skippedInstalledCount > 0">
            这次已自动跳过 {{ skippedInstalledCount }} 个已安装项目。
          </template>
        </p>
      </el-alert>

      <el-input
        v-model="generatedScript"
        type="textarea"
        :rows="18"
        readonly
        class="script-preview"
      />

      <template #footer>
        <el-button @click="showPreview = false">关闭</el-button>
        <el-button :icon="DocumentCopy" @click="handleCopyScript">
          复制脚本
        </el-button>
        <el-button
          type="primary"
          :icon="Download"
          @click="handleDownloadScript"
        >
          下载脚本
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.environment-selector {
  width: 100%;
  display: grid;
  gap: 22px;
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.board-card,
.library-card {
  border-radius: 28px;
  border: 1px solid rgba(19, 61, 54, 0.08);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 22px 48px rgba(31, 51, 47, 0.08);
}

.detect-board {
  background:
    radial-gradient(circle at top right, rgba(31, 138, 112, 0.18), transparent 26%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.94) 0%, rgba(243, 249, 246, 0.96) 100%);
}

.config-board {
  background:
    radial-gradient(circle at top right, rgba(242, 140, 40, 0.16), transparent 26%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.94) 0%, rgba(249, 247, 243, 0.96) 100%);
}

.board-head,
.library-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}

.board-kicker {
  margin: 0;
  color: #0f5f4b;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.board-head h2,
.library-head h2 {
  margin: 8px 0 0;
  font-size: 28px;
  line-height: 1.16;
  color: #173530;
}

.board-badge {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(31, 138, 112, 0.1);
  color: #0f5f4b;
  font-size: 12px;
  font-weight: 700;
}

.board-badge.warm {
  background: rgba(242, 140, 40, 0.12);
  color: #8f4c0e;
}

.board-copy,
.library-head p {
  margin: 16px 0 0;
  color: #58726e;
  font-size: 15px;
  line-height: 1.8;
}

.metric-strip,
.config-metrics {
  margin-top: 18px;
  display: grid;
  gap: 12px;
}

.metric-strip {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.config-metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.mini-metric,
.config-metric {
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(19, 61, 54, 0.06);
}

.mini-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mini-value,
.config-metric strong {
  font-size: 28px;
  font-weight: 800;
  color: #173530;
}

.mini-label,
.config-metric span {
  font-size: 13px;
  color: #5b7672;
}

.config-metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.step-row {
  margin-top: 18px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.step-row span {
  display: inline-flex;
  align-items: center;
  padding: 9px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(19, 61, 54, 0.08);
  color: #4f6a66;
  font-size: 13px;
}

.board-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.board-note,
.picker-note {
  margin: 14px 0 0;
  color: #5b7672;
  font-size: 13px;
  line-height: 1.7;
}

.manager-picker {
  margin-top: 18px;
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(19, 61, 54, 0.06);
}

.picker-label {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 700;
  color: #173530;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.library-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.env-tabs {
  margin-top: 8px;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
}

.tab-icon {
  font-size: 19px;
}

.env-description {
  margin-bottom: 18px;
  border-radius: 22px;
  padding: 18px;
  background: linear-gradient(135deg, #f7faf8 0%, #eff5f2 100%);
  border: 1px solid rgba(19, 61, 54, 0.06);
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.env-description p {
  margin: 0;
  color: #58726e;
  line-height: 1.7;
}

.packages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 16px;
}

.package-card {
  border-radius: 24px;
  border: 1px solid rgba(19, 61, 54, 0.08);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
  padding: 16px;
  cursor: pointer;
  transition: transform var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base);
  animation: riseIn 0.48s ease both;
}

.package-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 32px rgba(20, 55, 49, 0.1);
  border-color: rgba(31, 138, 112, 0.24);
}

.package-card.is-selected {
  border-color: rgba(31, 138, 112, 0.42);
  background: linear-gradient(160deg, #ffffff 0%, #eef7f3 100%);
  box-shadow: 0 16px 34px rgba(31, 138, 112, 0.12);
}

.package-card.is-installed {
  box-shadow: inset 0 0 0 1px rgba(31, 138, 112, 0.1);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(19, 61, 54, 0.06);
}

.card-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.card-main h3 {
  margin: 0;
  color: #173530;
  font-size: 19px;
}

.card-main p {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: #5b7672;
}

.card-meta {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: #f3f7f5;
  color: #5b7672;
  font-size: 12px;
}

.meta-item.success {
  background: rgba(31, 138, 112, 0.1);
  color: #0f5f4b;
}

.meta-item.warning {
  background: rgba(242, 140, 40, 0.12);
  color: #875321;
}

.meta-label {
  display: inline-flex;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(31, 138, 112, 0.1);
  color: #0f5f4b;
  font-size: 11px;
  font-weight: 700;
}

.meta-label.success {
  background: rgba(31, 138, 112, 0.14);
}

.preview-alert {
  margin-bottom: 14px;
}

.preview-alert p {
  margin: 0;
  line-height: 1.6;
}

.script-preview :deep(textarea) {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner),
:deep(.el-radio__input.is-checked .el-radio__inner) {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

:deep(.el-radio__label) {
  color: #173530;
}

:deep(.el-button--primary) {
  border: none;
  background: linear-gradient(135deg, #133d36 0%, #1f8a70 100%);
  border-radius: 14px;
  min-height: 44px;
}

:deep(.el-button--default) {
  border-radius: 14px;
  min-height: 44px;
}

:deep(.el-tabs__item) {
  font-weight: 700;
}

:deep(.el-tabs__item.is-active) {
  color: var(--color-primary);
}

:deep(.el-tabs__active-bar) {
  background-color: var(--color-primary);
}

@media (max-width: 1024px) {
  .board-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .metric-strip,
  .config-metrics,
  .packages-grid {
    grid-template-columns: 1fr;
  }

  .board-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .board-actions :deep(.el-button) {
    width: 100%;
  }

  .env-description {
    flex-direction: column;
    align-items: flex-start;
  }

  .library-head {
    flex-direction: column;
  }
}

@keyframes riseIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
