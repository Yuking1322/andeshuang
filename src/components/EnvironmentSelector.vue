<script setup>
import { computed, ref, watch } from 'vue'
import { DocumentCopy, Download, FolderOpened, Monitor, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  automationMeta,
  environments,
  getDefaultVersionId,
  getPackageSearchText,
  resolveDependencies,
  resolvePackageConfig
} from '../data/environments.js'
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
const VERSION_STORAGE_KEY = 'andeshuang-version-selection'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'dashboard-update'])

const quickSearchOptions = ['Python', 'Docker', 'Ollama', 'Java', '.NET', 'Rust', '数据库', 'AI']
const filterTabs = [
  { id: 'all', label: '全部环境', icon: '✨' },
  ...Object.entries(environments).map(([key, env]) => ({
    id: key,
    label: env.name,
    icon: env.icon
  }))
]

const activeTab = ref('all')
const searchQuery = ref('')
const automationFilter = ref('all')
const versionFilter = ref('all')
const installedFilter = ref('all')
const onlyPopular = ref(false)
const selectedPackages = ref([...props.modelValue])
const selectedVersions = ref(readStoredVersionSelections())
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

watch(
  selectedVersions,
  (value) => persistVersionSelections(value),
  { deep: true }
)

const platformInfo = computed(() => getClientPlatform())
const isWindowsPlatform = computed(() => platformInfo.value.isWindows)
const resolvedIds = computed(() => resolveDependencies(selectedPackages.value))
const selectedCount = computed(() => selectedPackages.value.length)
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
    ? 'Chocolatey 更适合系统级完整安装，管理员权限下覆盖面更广。'
    : 'Scoop 更轻量，适合偏开发者工具链和普通权限安装。'
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
  'CUDA、Docker Desktop 这类环境即使能触发安装，也经常还会要求额外确认或系统能力支持。'
]

const filteredGroups = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const groups = activeTab.value === 'all'
    ? Object.entries(environments)
    : environments[activeTab.value]
      ? [[activeTab.value, environments[activeTab.value]]]
      : []

  return groups
    .map(([categoryKey, env]) => {
      const packages = env.packages
        .map((pkg) => {
          const resolved = resolvePackageConfig(pkg, selectedVersions.value)
          return {
            ...resolved,
            categoryKey,
            categoryName: env.name,
            categoryDescription: env.description,
            automationMeta: automationMeta[resolved.automation] || automationMeta.guided,
            detection: getDetectionEntry(detectionSnapshot.value, resolved.id),
            managerSupport: getManagerSupportLabel(resolved),
            versionOptions: resolved.versionOptions || [],
            currentVersionId: selectedVersions.value[resolved.id] || getDefaultVersionId(resolved)
          }
        })
        .filter((pkg) => matchesFilters(pkg, query))
        .sort(sortPackages)

      return {
        key: categoryKey,
        env,
        packages
      }
    })
    .filter((group) => group.packages.length > 0)
})

const matchingPackageCount = computed(() =>
  filteredGroups.value.reduce((count, group) => count + group.packages.length, 0)
)

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

const isSelected = (packageId) => selectedPackages.value.includes(packageId)

function ensureVersionSelection(packageConfig) {
  const defaultVersionId = getDefaultVersionId(packageConfig)
  if (!defaultVersionId || selectedVersions.value[packageConfig.id]) {
    return
  }

  selectedVersions.value = {
    ...selectedVersions.value,
    [packageConfig.id]: defaultVersionId
  }
}

const togglePackage = (packageConfig, checked) => {
  const selected = isSelected(packageConfig.id)
  const shouldEnable = typeof checked === 'boolean' ? checked : !selected

  if (shouldEnable && !selected) {
    ensureVersionSelection(packageConfig)
    selectedPackages.value = [...selectedPackages.value, packageConfig.id]
  }

  if (!shouldEnable && selected) {
    selectedPackages.value = selectedPackages.value.filter((id) => id !== packageConfig.id)
  }

  emitSelection()
}

const updatePackageVersion = (packageConfig, versionId) => {
  selectedVersions.value = {
    ...selectedVersions.value,
    [packageConfig.id]: versionId
  }
}

const clearSelection = () => {
  selectedPackages.value = []
  emitSelection()
  ElMessage.info('已清空当前选择')
}

const clearFilters = () => {
  searchQuery.value = ''
  automationFilter.value = 'all'
  versionFilter.value = 'all'
  installedFilter.value = 'all'
  onlyPopular.value = false
  activeTab.value = 'all'
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
    mode: 'install',
    selectedVersions: selectedVersions.value
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
    mode: 'uninstall',
    selectedVersions: selectedVersions.value
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

function matchesFilters(packageConfig, query) {
  const searchText = getPackageSearchText(packageConfig)

  if (query && !searchText.includes(query.toLowerCase())) return false
  if (automationFilter.value !== 'all' && packageConfig.automation !== automationFilter.value) return false
  if (versionFilter.value === 'versioned' && !packageConfig.versionSelectable) return false
  if (versionFilter.value === 'simple' && packageConfig.versionSelectable) return false
  if (installedFilter.value === 'installed' && !packageConfig.detection?.installed) return false
  if (installedFilter.value === 'missing' && packageConfig.detection?.installed) return false
  if (onlyPopular.value && !packageConfig.popular) return false

  return true
}

function sortPackages(left, right) {
  const leftSelected = isSelected(left.id) ? 1 : 0
  const rightSelected = isSelected(right.id) ? 1 : 0
  if (leftSelected !== rightSelected) return rightSelected - leftSelected

  const leftPopular = left.popular ? 1 : 0
  const rightPopular = right.popular ? 1 : 0
  if (leftPopular !== rightPopular) return rightPopular - leftPopular

  return left.name.localeCompare(right.name, 'zh-CN')
}

function getManagerSupportLabel(packageConfig) {
  const chocolatey = packageConfig.managerActions?.chocolatey?.installCommands?.length > 0
  const scoop = packageConfig.managerActions?.scoop?.installCommands?.length > 0

  if (chocolatey && scoop) return 'Chocolatey + Scoop'
  if (chocolatey) return '更适合 Chocolatey'
  if (scoop) return '更适合 Scoop'
  return '查看官方入口'
}

function readStoredDetectionSnapshot() {
  if (typeof window === 'undefined') return createEmptyDetectionSnapshot()

  const raw = window.localStorage.getItem(DETECTION_STORAGE_KEY)
  if (!raw) return createEmptyDetectionSnapshot()

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

function readStoredVersionSelections() {
  if (typeof window === 'undefined') return {}

  const raw = window.localStorage.getItem(VERSION_STORAGE_KEY)
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    window.localStorage.removeItem(VERSION_STORAGE_KEY)
    return {}
  }
}

function persistVersionSelections(snapshot) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(snapshot))
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
  return compact.length <= 42 ? compact : `${compact.slice(0, 39)}...`
}

function applyQuickSearch(term) {
  searchQuery.value = term
  activeTab.value = 'all'
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
            这轮已经扩成真正的环境库：支持搜索、筛选、版本选择和不同自动化等级，不再只有“勾选几个包”这么简单。
          </p>

          <div v-if="!isWindowsPlatform" class="platform-alert">
            当前检测到 {{ platformInfo.label }}。v1 只完整支持 Windows 的体检、安装脚本和预置傻瓜包分发。
          </div>

          <div class="planner-block">
            <p class="planner-label">安装策略</p>
            <el-radio-group v-model="useChocolatey">
              <el-radio :value="true">Chocolatey（覆盖更广）</el-radio>
              <el-radio :value="false">Scoop（更轻量）</el-radio>
            </el-radio-group>
            <p class="module-note">{{ managerSummary }}</p>
          </div>

          <div class="module-actions">
            <el-button plain :disabled="selectedCount === 0" @click="clearSelection">
              清空选择
            </el-button>
            <el-button plain @click="clearFilters">
              清空筛选
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
            <h3>直接下载预置好的常用环境包</h3>
            <p class="module-copy compact">我顺手把预置包也扩了一轮，适合不想自己从零勾选的用户。</p>
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
            <p class="trouble-copy">安装或卸载失败时，不要让用户一脸懵，先去看脚本旁边的日志文件。</p>
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
            <h3>搜索你真正想配置的环境</h3>
            <p class="module-copy compact">
              支持全局搜索、环境分类、自动化等级筛选和版本选择。很多环境都会给出推荐版本，但不会强迫用户接受默认值。
            </p>
          </div>
          <div class="library-tags">
            <el-tag type="success">已选 {{ selectedCount }}</el-tag>
            <el-tag type="info">匹配 {{ matchingPackageCount }}</el-tag>
            <el-tag v-if="hasDetectionData && skippedInstalledCount > 0" type="info">将跳过 {{ skippedInstalledCount }}</el-tag>
            <el-tag v-if="!isWindowsPlatform" type="warning">{{ platformInfo.label }} 仅查看模式</el-tag>
          </div>
        </div>

        <div class="search-shell">
          <el-input
            v-model="searchQuery"
            placeholder="搜索环境、语言、工具或场景，例如 Python / Docker / Ollama / Rust"
            clearable
            size="large"
            class="search-input"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>

          <div class="quick-searches">
            <button
              v-for="term in quickSearchOptions"
              :key="term"
              type="button"
              class="quick-chip"
              @click="applyQuickSearch(term)"
            >
              {{ term }}
            </button>
          </div>

          <div class="filter-row">
            <el-select v-model="automationFilter" class="filter-select">
              <el-option label="全部自动化等级" value="all" />
              <el-option label="只看真一键" value="one-click" />
              <el-option label="只看半自动" value="guided" />
              <el-option label="只看手动补充" value="manual" />
            </el-select>

            <el-select v-model="versionFilter" class="filter-select">
              <el-option label="全部版本模式" value="all" />
              <el-option label="支持版本选择" value="versioned" />
              <el-option label="无需选版本" value="simple" />
            </el-select>

            <el-select v-model="installedFilter" class="filter-select">
              <el-option label="全部安装状态" value="all" />
              <el-option label="只看已安装" value="installed" />
              <el-option label="只看待补齐" value="missing" />
            </el-select>

            <el-switch
              v-model="onlyPopular"
              inline-prompt
              active-text="热门"
              inactive-text="全部"
            />
          </div>
        </div>

        <el-tabs v-model="activeTab" class="env-tabs">
          <el-tab-pane
            v-for="tab in filterTabs"
            :key="tab.id"
            :name="tab.id"
          >
            <template #label>
              <span class="tab-label">
                <span class="tab-icon">{{ tab.icon }}</span>
                {{ tab.label }}
              </span>
            </template>

            <div v-if="filteredGroups.length === 0" class="empty-state">
              <h4>没有找到符合条件的环境</h4>
              <p>试试清空筛选，或者换一个关键词，比如 Python、Docker、Ollama、数据库、Rust。</p>
            </div>

            <div
              v-for="group in filteredGroups"
              v-else
              :key="group.key"
              class="category-group"
            >
              <div class="env-description">
                <div>
                  <div class="group-title-line">
                    <span class="group-icon">{{ group.env.icon }}</span>
                    <strong>{{ group.env.name }}</strong>
                  </div>
                  <p>{{ group.env.description }}</p>
                </div>
                <el-tag type="info" effect="plain">{{ group.packages.length }} 个软件包</el-tag>
              </div>

              <div class="packages-grid">
                <article
                  v-for="(pkg, index) in group.packages"
                  :key="pkg.id"
                  class="package-card"
                  :class="{
                    'is-selected': isSelected(pkg.id),
                    'is-installed': pkg.detection.installed
                  }"
                  :style="{ animationDelay: `${index * 0.04}s` }"
                  @click="togglePackage(pkg)"
                >
                  <div class="card-top">
                    <div class="card-select">
                      <el-checkbox
                        :model-value="isSelected(pkg.id)"
                        @click.stop
                        @change="(val) => togglePackage(pkg, val)"
                      />
                      <span class="package-id">{{ pkg.id }}</span>
                    </div>
                    <div class="card-badges">
                      <el-tag v-if="pkg.detection.installed" type="success" size="small">已安装</el-tag>
                      <el-tag v-if="pkg.popular" type="warning" size="small">热门</el-tag>
                      <el-tag :type="pkg.automationMeta.tone" size="small">{{ pkg.automationMeta.label }}</el-tag>
                    </div>
                  </div>

                  <div class="card-main">
                    <div class="title-row">
                      <h4>{{ pkg.name }}</h4>
                      <a
                        v-if="pkg.officialUrl"
                        class="official-link"
                        :href="pkg.officialUrl"
                        target="_blank"
                        rel="noreferrer"
                        @click.stop
                      >
                        官方
                      </a>
                    </div>
                    <p>{{ pkg.description }}</p>
                  </div>

                  <div class="card-meta">
                    <div class="meta-item">
                      <span class="meta-label">支持</span>
                      <span>{{ pkg.managerSupport }}</span>
                    </div>

                    <div v-if="pkg.versionSelectable" class="version-panel" @click.stop>
                      <span class="meta-label">版本</span>
                      <el-select
                        :model-value="pkg.currentVersionId"
                        size="small"
                        class="version-select"
                        @update:model-value="(value) => updatePackageVersion(pkg, value)"
                      >
                        <el-option
                          v-for="version in pkg.versionOptions"
                          :key="version.id"
                          :label="version.label"
                          :value="version.id"
                        >
                          <div class="version-option">
                            <strong>{{ version.label }}</strong>
                            <span>{{ version.summary }}</span>
                          </div>
                        </el-option>
                      </el-select>
                      <p class="version-summary">
                        {{
                          pkg.versionOptions.find((item) => item.id === pkg.currentVersionId)?.summary ||
                          pkg.selectedVersionSummary
                        }}
                      </p>
                    </div>

                    <div v-if="pkg.detection.installed" class="meta-item success">
                      <span class="meta-label success">状态</span>
                      <span>
                        已检测到
                        <template v-if="formatVersion(pkg.detection.version)">
                          · {{ formatVersion(pkg.detection.version) }}
                        </template>
                      </span>
                    </div>

                    <div v-if="pkg.dependencies?.length" class="meta-item">
                      <span class="meta-label">依赖</span>
                      <span>{{ pkg.dependencies.join(', ') }}</span>
                    </div>

                    <div v-if="pkg.tags?.length" class="meta-item">
                      <span class="meta-label">标签</span>
                      <span>{{ pkg.tags.join(' / ') }}</span>
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
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </section>

    <el-dialog
      v-model="showPreview"
      :title="previewTitle"
      width="900px"
    >
      <el-alert
        title="使用说明"
        type="info"
        :closable="false"
        class="preview-alert"
      >
        <p>
          <template v-if="scriptMode === 'uninstall'">
            下载后双击运行脚本即可开始卸载。若某些软件本来就不适合自动回滚，脚本会在日志和结尾说明里明确提示。
          </template>
          <template v-else>
            下载后双击运行脚本，根据提示完成安装。带版本选择的软件会按你当前在页面里选定的版本生成。
          </template>
          <template v-if="scriptMode !== 'uninstall' && hasDetectionData && skippedInstalledCount > 0">
            本次已自动跳过 {{ skippedInstalledCount }} 个已安装项目。
          </template>
        </p>
      </el-alert>

      <el-input
        v-model="generatedScript"
        type="textarea"
        :rows="20"
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

.search-shell {
  margin-top: 18px;
  padding: 16px;
  border-radius: 24px;
  background: rgba(18, 40, 37, 0.04);
  border: 1px solid rgba(18, 40, 37, 0.05);
}

.search-input {
  width: 100%;
}

.quick-searches {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.quick-chip {
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(18, 40, 37, 0.06);
  color: #536663;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.quick-chip:hover {
  border-color: rgba(47, 117, 105, 0.24);
  color: #1c5e52;
}

.filter-row {
  margin-top: 16px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-select {
  width: 190px;
}

.library-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.env-tabs {
  margin-top: 16px;
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

.category-group + .category-group {
  margin-top: 22px;
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

.group-title-line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.group-title-line strong {
  color: #152b27;
  font-size: 18px;
}

.group-icon {
  font-size: 20px;
}

.env-description p {
  margin: 8px 0 0;
  color: #617572;
  line-height: 1.75;
}

.packages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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

.title-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
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

.official-link {
  display: inline-flex;
  color: #1f6d5f;
  text-decoration: none;
  font-weight: 700;
  font-size: 12px;
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
  white-space: nowrap;
}

.meta-label.success {
  background: rgba(47, 117, 105, 0.16);
}

.version-panel {
  padding: 12px;
  border-radius: 16px;
  background: rgba(18, 40, 37, 0.03);
  border: 1px solid rgba(18, 40, 37, 0.05);
}

.version-select {
  width: 100%;
  margin-top: 8px;
}

.version-summary {
  margin: 8px 0 0;
  color: #6a7c78;
  font-size: 12px;
  line-height: 1.6;
}

.version-option {
  display: grid;
  gap: 2px;
}

.version-option strong {
  color: #152b27;
  font-size: 13px;
}

.version-option span {
  color: #6b7d79;
  font-size: 12px;
}

.empty-state {
  padding: 30px 20px;
  border-radius: 24px;
  background: rgba(18, 40, 37, 0.04);
  border: 1px dashed rgba(18, 40, 37, 0.12);
  text-align: center;
}

.empty-state h4 {
  margin: 0;
  color: #152b27;
  font-size: 22px;
}

.empty-state p {
  margin: 10px 0 0;
  color: #647673;
  line-height: 1.8;
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

@media (max-width: 820px) {
  .module-body {
    padding: 18px;
  }

  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-select {
    width: 100%;
  }
}

@media (max-width: 768px) {
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

  .module-header,
  .title-row {
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
