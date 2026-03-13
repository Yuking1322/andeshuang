<script setup>
import { computed, ref, watch } from 'vue'
import { Download, DocumentCopy, FolderOpened, Monitor } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { environments, resolveDependencies } from '../data/environments.js'
import { windowsPresetDownloads } from '../data/downloadPresets.js'
import { generateScript } from '../utils/scriptGenerator.js'
import {
  createEmptyDetectionSnapshot,
  generateDetectionLauncher,
  getDetectionEntry,
  normalizeDetectionPayload
} from '../utils/detectionScript.js'
import { getClientPlatform } from '../utils/platform.js'

const DETECTION_STORAGE_KEY = 'andeshuang-detection-snapshot'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'dashboard-update'])

const categoryKeys = Object.keys(environments)
const activeTab = ref(categoryKeys[0] ?? 'frontend')
const selectedPackages = ref([...props.modelValue])
const showPreview = ref(false)
const generatedScript = ref('')
const scriptMode = ref('install')
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

const platformInfo = computed(() => getClientPlatform())
const isWindowsPlatform = computed(() => platformInfo.value.isWindows)
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
  `${useChocolatey.value ? 'Chocolatey' : 'Scoop'}${scriptMode.value === 'uninstall' ? ' 卸载脚本预览' : ' 安装脚本预览'}`
)
const managerSummary = computed(() =>
  useChocolatey.value
    ? '适合需要管理员权限的完整安装流程。'
    : '适合普通权限环境，尽量减少系统级变更。'
)
const detectionSummary = computed(() => {
  if (!hasDetectionData.value) {
    return '还没导入体检结果时，系统会按当前勾选项完整生成安装脚本。'
  }

  return `这次将安装 ${selectedPendingCount.value} 项，跳过已安装 ${skippedInstalledCount.value} 项。`
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
const presetDownloads = computed(() =>
  windowsPresetDownloads.map((item) => ({
    ...item,
    href: `/downloads/windows/${item.fileName}`
  }))
)
const troubleshootingTips = [
  '日志会保存在脚本所在目录，文件名以 andeshuang-install 或 andeshuang-uninstall 开头。',
  '如果安装失败，优先检查管理员权限、网络代理、包源可用性和软件是否正在运行。',
  '像 CUDA 这类手动型软件会保留提示，不会被脚本强行安装或卸载。'
]

const isSelected = (packageId) => selectedPackages.value.includes(packageId)
const getPackageDetection = (packageId) => getDetectionEntry(detectionSnapshot.value, packageId)

watch(
  [
    selectedCount,
    selectedPendingCount,
    detectedInstalledCount,
    autoDependencyCount,
    skippedInstalledCount,
    hasDetectionData,
    useChocolatey
  ],
  () => {
    emit('dashboard-update', {
      selectedCount: selectedCount.value,
      selectedPendingCount: selectedPendingCount.value,
      detectedInstalledCount: detectedInstalledCount.value,
      autoDependencyCount: autoDependencyCount.value,
      skippedInstalledCount: skippedInstalledCount.value,
      hasDetectionData: hasDetectionData.value,
      useChocolatey: useChocolatey.value
    })
  },
  { immediate: true }
)

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
  if (!ensureWindowsAction()) return
  if (selectedPackages.value.length === 0) {
    ElMessage.warning('请先选择至少一个软件包')
    return
  }

  const packageIdsToInstall = hasDetectionData.value ? pendingInstallIds.value : resolvedIds.value

  if (hasDetectionData.value && packageIdsToInstall.length === 0) {
    ElMessage.success('根据体检结果，当前所选环境已经安装完成')
    return
  }

  scriptMode.value = 'install'
  generatedScript.value = generateScript(packageIdsToInstall, {
    useChocolatey: useChocolatey.value,
    mode: 'install'
  })
  showPreview.value = true
}

const handleGenerateUninstallScript = () => {
  if (!ensureWindowsAction()) return
  if (selectedPackages.value.length === 0) {
    ElMessage.warning('请先选择至少一个软件包')
    return
  }

  scriptMode.value = 'uninstall'
  generatedScript.value = generateScript(resolvedIds.value, {
    useChocolatey: useChocolatey.value,
    mode: 'uninstall'
  })
  showPreview.value = true
}

const handleDownloadScript = () => {
  const fileName = scriptMode.value === 'uninstall' ? '安的爽-后悔药.bat' : '安的爽-一键安装.bat'
  downloadTextFile(fileName, generatedScript.value)
  ElMessage.success(scriptMode.value === 'uninstall' ? '卸载脚本已下载，双击即可运行' : '安装脚本已下载，双击即可运行')
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
  if (!ensureWindowsAction()) return
  downloadTextFile('安的爽-一键体检.cmd', generateDetectionLauncher())
  ElMessage.success('一键体检器已下载，双击运行后把桌面 JSON 导回页面即可')
}

const openDetectionImport = () => {
  if (!ensureWindowsAction()) return
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

function ensureWindowsAction() {
  if (isWindowsPlatform.value) return true

  ElMessage.warning(`当前检测到 ${platformInfo.value.label}，v1 仅完整支持 Windows 下载与脚本执行`)
  return false
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
  <section class="console-stage">
    <div class="module-grid">
      <section class="console-module inspector-module">
        <div class="module-body">
          <div class="module-header">
            <div>
              <p class="module-label">智能体检</p>
              <h3>先确认这台电脑已经装了什么</h3>
            </div>
            <span class="module-chip">{{ hasDetectionData ? '已导入结果' : '等待体检' }}</span>
          </div>

          <p class="module-copy">
            下载体检器后双击运行，桌面会自动生成结果文件；把结果导回页面，系统就会自动标记已安装的软件。
          </p>

          <div class="command-row">
            <span>下载体检器</span>
            <span>双击运行</span>
            <span>导入结果</span>
          </div>

          <div class="module-actions">
            <el-button type="primary" :icon="Monitor" :disabled="!isWindowsPlatform" @click="handleDownloadDetection">
              下载一键体检器
            </el-button>
            <el-button plain :icon="FolderOpened" :disabled="!isWindowsPlatform" @click="openDetectionImport">
              导入检测结果
            </el-button>
            <el-button v-if="hasDetectionData" text @click="clearDetectionSnapshot">
              清除体检结果
            </el-button>
          </div>

          <p class="module-note">
            {{ hasDetectionData ? detectionSummary : '导入体检结果后，系统会自动跳过已经安装的软件。' }}
            <template v-if="hasDetectionData && formattedDetectionTime">
              最近体检：{{ formattedDetectionTime }}<span v-if="detectionSnapshot.machineName"> · {{ detectionSnapshot.machineName }}</span>
            </template>
          </p>
        </div>

        <input
          ref="detectionInputRef"
          class="sr-only"
          type="file"
          accept=".json,application/json"
          @change="handleDetectionImport"
        >
      </section>

      <section class="console-module plan-module">
        <div class="module-body">
          <div class="module-header">
            <div>
              <p class="module-label">配置环境</p>
              <h3>决定这台电脑真正还缺什么</h3>
            </div>
            <span class="module-chip warm">{{ selectedPendingCount }} 项待安装</span>
          </div>

          <p class="module-copy">
            勾选你想补齐的环境，系统会自动补齐依赖，并优先跳过已经识别到的已安装内容。
          </p>

          <div v-if="!isWindowsPlatform" class="platform-alert">
            当前检测到 {{ platformInfo.label }}。v1 只完整支持 Windows 的体检、安装脚本和预置傻瓜包分发。
          </div>

          <div class="planner-block">
            <p class="planner-label">安装策略</p>
            <el-radio-group v-model="useChocolatey">
              <el-radio :value="true">Chocolatey（管理员）</el-radio>
              <el-radio :value="false">Scoop（普通权限）</el-radio>
            </el-radio-group>
            <p class="module-note">{{ managerSummary }}</p>
          </div>

          <div class="module-actions">
            <el-button plain :disabled="selectedCount === 0" @click="clearSelection">
              清空选择
            </el-button>
            <el-button plain :disabled="selectedCount === 0 || !isWindowsPlatform" @click="handleGenerateUninstallScript">
              后悔药
            </el-button>
            <el-button
              type="primary"
              :icon="Download"
              :disabled="selectedCount === 0 || !isWindowsPlatform"
              @click="handleGenerateScript"
            >
              生成安装脚本
            </el-button>
          </div>
        </div>
      </section>
    </div>

    <section class="console-module preset-module">
      <div class="module-body">
        <div class="module-header">
          <div>
            <p class="module-label">Windows 傻瓜包</p>
            <h3>直接下载预置好的常用包</h3>
            <p class="module-copy compact">适合不想自己选太多项的用户，双击就能开始安装。</p>
          </div>
          <span class="module-chip warm">静态分发</span>
        </div>

        <div v-if="isWindowsPlatform" class="preset-grid">
          <a
            v-for="preset in presetDownloads"
            :key="preset.id"
            class="preset-card"
            :href="preset.href"
            download
          >
            <strong>{{ preset.name }}</strong>
            <span>{{ preset.description }}</span>
            <em>{{ preset.fileName }}</em>
          </a>
        </div>

        <div v-else class="platform-alert">
          当前检测到 {{ platformInfo.label }}。预置傻瓜包目前只提供 Windows 版本，后续再补 Linux 脚本分发。
        </div>

        <div class="trouble-box">
          <div>
            <p class="planner-label">报错怎么办</p>
            <p class="trouble-copy">安装或卸载失败时，不需要让用户一脸懵，先去看脚本旁边的日志文件。</p>
          </div>

          <ul>
            <li v-for="tip in troubleshootingTips" :key="tip">{{ tip }}</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="console-module library-module">
      <div class="module-body library-body">
        <div class="module-header">
          <div>
            <p class="module-label">环境软件库</p>
            <h3>从库里选择你想要的环境组件</h3>
            <p class="module-copy compact">看到“已安装”时，说明体检结果已经识别到了这个软件。</p>
          </div>
          <div class="library-tags">
            <el-tag type="success">已选 {{ selectedCount }}</el-tag>
            <el-tag v-if="hasDetectionData && skippedInstalledCount > 0" type="info">将跳过 {{ skippedInstalledCount }}</el-tag>
            <el-tag v-if="!isWindowsPlatform" type="warning">{{ platformInfo.label }} 仅查看模式</el-tag>
          </div>
        </div>

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
                  <div class="card-select">
                    <el-checkbox
                      :model-value="isSelected(pkg.id)"
                      @click.stop
                      @change="(val) => togglePackage(pkg.id, val)"
                    />
                    <span class="package-id">{{ pkg.id }}</span>
                  </div>
                  <div class="card-badges">
                    <el-tag v-if="getPackageDetection(pkg.id).installed" type="success" size="small">已安装</el-tag>
                    <el-tag v-if="pkg.popular" type="warning" size="small">热门</el-tag>
                    <el-tag v-if="pkg.dependencies?.length" type="info" size="small">有依赖</el-tag>
                  </div>
                </div>

                <div class="card-main">
                  <h4>{{ pkg.name }}</h4>
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
      </div>
    </section>

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
          <template v-if="scriptMode === 'uninstall'">
            下载后双击运行脚本即可开始卸载，执行前建议先关闭相关软件并保留日志文件。
          </template>
          <template v-else>
            下载后双击运行脚本，根据提示完成安装。安装结束后建议重启终端。
          </template>
          <template v-if="scriptMode !== 'uninstall' && hasDetectionData && skippedInstalledCount > 0">
            本次已自动跳过 {{ skippedInstalledCount }} 个已安装项目。
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
.console-stage {
  display: grid;
  gap: 18px;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.console-module {
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid rgba(18, 40, 37, 0.08);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 20px 40px rgba(21, 37, 34, 0.08);
}

.inspector-module {
  background:
    radial-gradient(circle at top right, rgba(47, 117, 105, 0.16), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(244, 247, 245, 0.96) 100%);
}

.plan-module {
  background:
    radial-gradient(circle at top right, rgba(196, 123, 54, 0.16), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(247, 244, 240, 0.96) 100%);
}

.preset-module,
.library-module {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(245, 247, 244, 0.98) 100%);
}

.module-body {
  padding: 22px;
}

.library-body {
  padding-top: 20px;
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}

.module-label {
  margin: 0;
  color: #8a7355;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.module-header h3 {
  margin: 8px 0 0;
  color: #162b28;
  font-size: 28px;
  line-height: 1.15;
}

.module-chip {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(47, 117, 105, 0.1);
  color: #185549;
  font-size: 12px;
  font-weight: 700;
}

.module-chip.warm {
  background: rgba(196, 123, 54, 0.12);
  color: #8e5821;
}

.module-copy {
  margin: 14px 0 0;
  color: #647673;
  font-size: 15px;
  line-height: 1.8;
}

.module-copy.compact {
  margin-top: 12px;
}

.command-row {
  margin-top: 18px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.command-row span {
  padding: 9px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(18, 40, 37, 0.06);
  color: #5d716d;
  font-size: 13px;
}

.module-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.module-note {
  margin: 14px 0 0;
  color: #6a7c78;
  font-size: 13px;
  line-height: 1.75;
}

.planner-block {
  margin-top: 18px;
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(18, 40, 37, 0.06);
}

.planner-label {
  margin: 0 0 12px;
  color: #162b28;
  font-size: 13px;
  font-weight: 700;
}

.platform-alert {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(196, 123, 54, 0.12);
  color: #8f5b24;
  line-height: 1.75;
}

.preset-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.preset-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 22px;
  border: 1px solid rgba(18, 40, 37, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(245, 248, 246, 1) 100%);
  text-decoration: none;
  transition: transform var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base);
}

.preset-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 30px rgba(18, 40, 37, 0.08);
  border-color: rgba(47, 117, 105, 0.2);
}

.preset-card strong {
  color: #162b28;
  font-size: 16px;
}

.preset-card span,
.preset-card em {
  color: #647673;
  font-size: 13px;
  line-height: 1.7;
  font-style: normal;
}

.trouble-box {
  margin-top: 20px;
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 24px;
  background: rgba(18, 40, 37, 0.04);
  border: 1px solid rgba(18, 40, 37, 0.05);
}

.trouble-copy {
  margin: 8px 0 0;
  color: #647673;
  line-height: 1.75;
}

.trouble-box ul {
  margin: 0;
  padding-left: 18px;
  color: #647673;
  line-height: 1.8;
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
  font-size: 18px;
}

.env-description {
  margin-bottom: 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-radius: 22px;
  background: linear-gradient(135deg, #f7f9f7 0%, #eff4f1 100%);
  border: 1px solid rgba(18, 40, 37, 0.05);
}

.env-description p {
  margin: 0;
  color: #617572;
  line-height: 1.75;
}

.packages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.package-card {
  border-radius: 24px;
  border: 1px solid rgba(18, 40, 37, 0.08);
  padding: 16px;
  background:
    radial-gradient(circle at top right, rgba(196, 123, 54, 0.06), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(249, 250, 248, 0.98) 100%);
  cursor: pointer;
  transition: transform var(--transition-base), border-color var(--transition-base), box-shadow var(--transition-base);
  animation: riseIn 0.48s ease both;
}

.package-card:hover {
  transform: translateY(-4px);
  border-color: rgba(47, 117, 105, 0.22);
  box-shadow: 0 18px 34px rgba(18, 40, 37, 0.08);
}

.package-card.is-selected {
  border-color: rgba(47, 117, 105, 0.34);
  box-shadow: 0 20px 36px rgba(47, 117, 105, 0.12);
}

.package-card.is-installed {
  box-shadow: inset 0 0 0 1px rgba(47, 117, 105, 0.1);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(18, 40, 37, 0.06);
}

.card-select {
  display: flex;
  align-items: center;
  gap: 8px;
}

.package-id {
  display: inline-flex;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(18, 40, 37, 0.05);
  color: #6f817d;
  font-size: 11px;
  letter-spacing: 0.04em;
}

.card-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.card-main h4 {
  margin: 0;
  color: #152b27;
  font-size: 19px;
}

.card-main p {
  margin: 8px 0 0;
  color: #647673;
  font-size: 14px;
  line-height: 1.72;
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
  background: #f2f5f3;
  color: #657875;
  font-size: 12px;
}

.meta-item.success {
  background: rgba(47, 117, 105, 0.1);
  color: #185549;
}

.meta-item.warning {
  background: rgba(196, 123, 54, 0.12);
  color: #8f5b24;
}

.meta-label {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(47, 117, 105, 0.1);
  color: #185549;
  font-size: 11px;
  font-weight: 700;
}

.meta-label.success {
  background: rgba(47, 117, 105, 0.16);
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
  background-color: var(--color-primary-light);
  border-color: var(--color-primary-light);
}

:deep(.el-radio__label) {
  color: #1a2d2a;
}

:deep(.el-button--primary) {
  border: none;
  background: linear-gradient(135deg, #173f38 0%, #2f7569 100%);
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
  color: var(--color-primary-light);
}

:deep(.el-tabs__active-bar) {
  background-color: var(--color-primary-light);
}

@media (max-width: 1024px) {
  .module-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .module-body {
    padding: 18px;
  }

  .preset-grid,
  .packages-grid {
    grid-template-columns: 1fr;
  }

  .module-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .module-actions :deep(.el-button) {
    width: 100%;
  }

  .env-description {
    flex-direction: column;
    align-items: flex-start;
  }

  .module-header {
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
