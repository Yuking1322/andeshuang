<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getPackageById } from '../data/environments.js'
import { askAiAssistant } from '../utils/aiApi.js'

const MAX_HISTORY = 8

const props = defineProps({
  selectedPackageIds: {
    type: Array,
    default: () => []
  },
  dashboardState: {
    type: Object,
    default: () => ({})
  }
})

const chatBodyRef = ref(null)
const draft = ref('')
const pending = ref(false)
const currentModel = ref('')
const currentProvider = ref('')
const messages = ref([])
const selectedCount = computed(() => props.selectedPackageIds.length)
const dashboard = computed(() => props.dashboardState || {})
const hasDetectionData = computed(() => Boolean(dashboard.value.hasDetectionData))
const hasConversation = computed(() => messages.value.length > 0 || pending.value)

const selectedPackageSummary = computed(() =>
  props.selectedPackageIds
    .map((id) => getPackageById(id))
    .filter(Boolean)
    .map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      categoryName: pkg.categoryName || ''
    }))
)

const installerLabel = computed(() =>
  props.dashboardState?.useChocolatey ? 'Chocolatey' : 'Scoop'
)
const assistantStatusPills = computed(() => {
  if (!hasDetectionData.value) {
    return ['体检未完成', '先做体检', '再选场景']
  }

  return [
    installerLabel.value,
    `已选 ${selectedCount.value} 项`,
    `待补齐 ${dashboard.value.selectedPendingCount || 0} 项`,
    `已识别 ${dashboard.value.detectedInstalledCount || 0} 项`
  ]
})

const quickPrompts = computed(() => {
  if (!hasDetectionData.value) {
    return [
      '我还没做体检，为什么要先体检再选环境？',
      '体检做完以后，系统会根据什么给我建议？',
      '如果我只是第一次装环境，先选场景包还是先做体检？',
      '导入体检结果后，我应该先看哪里？'
    ]
  }

  if (selectedPackageSummary.value.length > 0) {
    const names = selectedPackageSummary.value.slice(0, 3).map((item) => item.name).join('、')

    return [
      '我当前这套选择合理吗？',
      `我现在选了 ${names}，还缺哪些关键项？`,
      '根据我当前选择，先体检还是直接生成脚本？',
      '如果安装失败，我应该按什么顺序排查？'
    ]
  }

  return [
    '我要搭一套稳一点的前端入门环境，推荐选什么？',
    '我想学 Python 数据分析，推荐一套入门配置。',
    '我在配 Java 后端开发环境，第一批应该装哪些？'
  ]
})

watch(
  () => messages.value.length,
  async () => {
    await nextTick()
    scrollToBottom()
  }
)

function applyQuickPrompt(prompt) {
  if (pending.value) return
  draft.value = prompt
  handleSend()
}

async function handleSend() {
  const question = draft.value.trim()
  if (!question || pending.value) return

  draft.value = ''
  pushMessage('user', question)
  pending.value = true

  try {
    const response = await askAiAssistant({
      messages: buildRequestMessages(),
      context: buildRequestContext()
    })

    currentModel.value = response.model || ''
    currentProvider.value = response.provider || ''
    pushMessage('assistant', response.answer || '这次没有拿到有效回复，你可以换个问法再试一次。')
  } catch (error) {
    const fallback = formatAiError(error)
    pushMessage('assistant', fallback, true)
    ElMessage.warning(fallback)
  } finally {
    pending.value = false
  }
}

function clearConversation() {
  messages.value = []
}

function buildRequestMessages() {
  return messages.value
    .slice(-MAX_HISTORY)
    .map((item) => ({
      role: item.role,
      content: item.content
    }))
}

function buildRequestContext() {
  return {
    selectedPackages: selectedPackageSummary.value,
    selectedCount: props.selectedPackageIds.length,
    pendingCount: Number(props.dashboardState?.selectedPendingCount || 0),
    detectedInstalledCount: Number(props.dashboardState?.detectedInstalledCount || 0),
    autoDependencyCount: Number(props.dashboardState?.autoDependencyCount || 0),
    skippedInstalledCount: Number(props.dashboardState?.skippedInstalledCount || 0),
    hasDetectionData: Boolean(props.dashboardState?.hasDetectionData),
    installer: installerLabel.value
  }
}

function pushMessage(role, content, isError = false) {
  messages.value = [
    ...messages.value,
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      role,
      content,
      isError
    }
  ]
}

function scrollToBottom() {
  if (!chatBodyRef.value) return
  chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
}

function formatAiError(error) {
  const code = error?.code || ''

  if (code === 'unauthenticated') {
    return '你需要先保持登录状态，AI 问答才能继续使用。'
  }

  if (code === 'ai_unavailable') {
    return 'AI 服务还没有配置完成，先把服务端的 AI 环境变量补齐。'
  }

  if (code === 'empty_ai_response') {
    return 'AI 这次没有返回有效内容，换个问法再试一次。'
  }

  return 'AI 助手暂时不可用，请稍后再试。'
}
</script>

<template>
  <section class="assistant-card">
    <div class="assistant-head">
      <div>
        <p class="assistant-label">AI 环境顾问</p>
        <h3>边配环境，边问为什么这样选</h3>
        <p class="assistant-copy">
          更适合做场景推荐、版本取舍和排障。
        </p>
      </div>
    </div>

    <div class="assistant-stats">
      <span v-for="pill in assistantStatusPills" :key="pill">{{ pill }}</span>
    </div>

    <div v-if="!hasConversation" class="assistant-prompts">
      <button
        v-for="prompt in quickPrompts"
        :key="prompt"
        type="button"
        class="prompt-chip"
        :disabled="pending"
        @click="applyQuickPrompt(prompt)"
      >
        {{ prompt }}
      </button>
    </div>

    <div :class="['assistant-feedback', { active: pending }]">
      <div class="feedback-state">
        <span class="feedback-dot" />
        <strong>{{ pending ? 'AI 正在思考...' : 'AI 已就绪' }}</strong>
      </div>
      <span class="feedback-text">
        {{ pending ? '正在整理推荐和排障建议，请稍等一下。' : '可以直接提问，或者先点一个上面的快捷问题。' }}
      </span>
    </div>

    <div ref="chatBodyRef" class="assistant-chat">
      <div v-if="!hasConversation" class="chat-empty">
        <strong>我是你的 AI 环境顾问</strong>
        <p>现在可以直接问我场景推荐、版本取舍和排障建议。开始对话后，消息会稳定显示在这里。</p>
      </div>

      <article
        v-for="message in messages"
        :key="message.id"
        :class="['chat-bubble', `is-${message.role}`, { 'is-error': message.isError }]"
      >
        <span class="bubble-role">{{ message.role === 'assistant' ? 'AI' : '你' }}</span>
        <p>{{ message.content }}</p>
      </article>

      <article v-if="pending" class="chat-bubble is-assistant is-loading">
        <span class="bubble-role">AI</span>
        <div class="thinking-row">
          <span class="thinking-dot" />
          <span class="thinking-dot" />
          <span class="thinking-dot" />
        </div>
        <p>正在组织建议...</p>
      </article>
    </div>

    <div class="assistant-compose">
      <el-input
        v-model="draft"
        type="textarea"
        :autosize="{ minRows: 3, maxRows: 6 }"
        maxlength="800"
        show-word-limit
        placeholder="例如：我想搭一套稳一点的 Python 数据分析环境，应该怎么选？"
        @keyup.ctrl.enter="handleSend"
      />

      <div class="compose-actions">
        <div class="compose-meta">
          <span>Ctrl + Enter 发送</span>
          <span v-if="currentModel">{{ currentModel }} @ {{ currentProvider }}</span>
        </div>

        <div class="compose-buttons">
          <el-button plain @click="clearConversation">
            清空
          </el-button>
          <el-button type="primary" :loading="pending" @click="handleSend">
            {{ pending ? '思考中...' : '发送' }}
          </el-button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.assistant-card {
  display: grid;
  grid-template-rows: auto auto auto auto minmax(140px, 1fr) auto;
  gap: 14px;
  padding: 18px;
  min-height: 0;
  height: 100%;
  max-height: none;
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid rgba(18, 40, 37, 0.08);
  background:
    radial-gradient(circle at top right, rgba(196, 123, 54, 0.14), transparent 22%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(244, 247, 244, 0.98) 100%);
  box-shadow: 0 22px 40px rgba(21, 37, 34, 0.08);
}

.assistant-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.assistant-label {
  margin: 0;
  color: #8a7355;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.assistant-head h3 {
  margin: 8px 0 0;
  color: #162b28;
  font-size: 28px;
  line-height: 1.15;
}

.assistant-copy {
  margin: 10px 0 0;
  color: #647673;
  font-size: 13px;
  line-height: 1.65;
}

.assistant-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.assistant-stats span {
  padding: 8px 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(18, 40, 37, 0.06);
  color: #5c706d;
  font-size: 12px;
  font-weight: 700;
}

.assistant-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.prompt-chip {
  border: none;
  border-radius: 999px;
  padding: 8px 11px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(18, 40, 37, 0.06);
  color: #536663;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  text-align: left;
}

.prompt-chip:hover:enabled {
  border-color: rgba(47, 117, 105, 0.24);
  color: #1c5e52;
}

.prompt-chip:disabled {
  cursor: wait;
  opacity: 0.65;
}

.assistant-feedback {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 18px;
  background: rgba(18, 40, 37, 0.04);
  border: 1px solid rgba(18, 40, 37, 0.06);
}

.assistant-feedback.active {
  background: rgba(47, 117, 105, 0.08);
  border-color: rgba(47, 117, 105, 0.16);
}

.feedback-state {
  display: flex;
  align-items: center;
  gap: 10px;
}

.feedback-state strong {
  color: #173f38;
  font-size: 13px;
}

.feedback-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #6f817d;
}

.assistant-feedback.active .feedback-dot {
  background: #2f7569;
  box-shadow: 0 0 0 8px rgba(47, 117, 105, 0.12);
  animation: pulseDot 1.2s ease-in-out infinite;
}

.feedback-text {
  color: #647673;
  font-size: 13px;
  line-height: 1.7;
}

.assistant-chat {
  display: grid;
  gap: 12px;
  min-height: 0;
  max-height: none;
  overflow-y: auto;
  padding: 4px 6px 4px 0;
  align-content: start;
}

.chat-empty {
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px dashed rgba(18, 40, 37, 0.12);
  background: rgba(255, 255, 255, 0.5);
  align-self: start;
}

.chat-empty strong {
  color: #173f38;
  font-size: 13px;
}

.chat-empty p {
  margin: 8px 0 0;
  color: #647673;
  font-size: 13px;
  line-height: 1.7;
}

.chat-bubble {
  max-width: 100%;
  padding: 14px 16px;
  border-radius: 18px;
  display: grid;
  gap: 8px;
}

.chat-bubble.is-assistant {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(18, 40, 37, 0.06);
}

.chat-bubble.is-user {
  background: linear-gradient(135deg, #173f38 0%, #2f7569 100%);
  color: #f4f8f6;
  margin-left: 22px;
}

.chat-bubble.is-error {
  border-color: rgba(196, 123, 54, 0.18);
  background: rgba(251, 245, 238, 0.96);
}

.chat-bubble.is-loading {
  border-style: dashed;
}

.thinking-row {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.thinking-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2f7569;
  animation: thinkingBounce 0.9s ease-in-out infinite;
}

.thinking-dot:nth-child(2) {
  animation-delay: 0.12s;
}

.thinking-dot:nth-child(3) {
  animation-delay: 0.24s;
}

.bubble-role {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #7a6f60;
}

.chat-bubble.is-user .bubble-role {
  color: rgba(244, 248, 246, 0.74);
}

.chat-bubble p {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.8;
}

.assistant-compose {
  display: grid;
  gap: 10px;
}

.compose-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.compose-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #6a7c78;
  font-size: 12px;
}

.compose-buttons {
  display: flex;
  gap: 10px;
  align-items: center;
}

@media (max-width: 900px) {
  .assistant-card {
    grid-template-rows: auto auto auto auto minmax(120px, 1fr) auto;
  }
}

@media (max-width: 640px) {
  .assistant-card {
    padding: 18px;
  }

  .assistant-status {
    grid-template-columns: 1fr;
  }

  .assistant-head,
  .compose-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .compose-buttons {
    width: 100%;
  }

  .compose-buttons :deep(.el-button) {
    flex: 1;
  }
}

@keyframes pulseDot {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.85;
  }

  50% {
    transform: scale(1.18);
    opacity: 1;
  }
}

@keyframes thinkingBounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }

  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
</style>
