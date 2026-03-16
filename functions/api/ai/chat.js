import { isSameOriginRequest, json, readJson } from '../../_shared/admin.js'
import { getLinuxDOConfig } from '../../_shared/linuxdo.js'
import { readSession } from '../../_shared/session.js'

const DEFAULT_AI_BASE_URL = 'https://api.daiju.live'
const DEFAULT_AI_MODEL = 'gpt-5.2'
const MAX_MESSAGES = 8
const MAX_MESSAGE_CHARS = 2000
const MAX_SELECTED_PACKAGES = 12

export async function onRequestPost(context) {
  if (!isSameOriginRequest(context.request)) {
    return json(
      {
        error: 'forbidden_origin'
      },
      403
    )
  }

  const sessionResult = await readAuthenticatedSession(context)
  if (!sessionResult.ok) {
    return sessionResult.response
  }

  const body = await readJson(context.request)
  if (!body.ok) {
    return json(
      {
        error: 'invalid_payload'
      },
      400
    )
  }

  const normalized = normalizePayload(body.value)
  if (!normalized.ok) {
    return json(
      {
        error: normalized.error
      },
      400
    )
  }

  const aiConfig = getAiConfig(context.env)
  if (aiConfig.missing.length > 0) {
    return json(
      {
        error: 'ai_unavailable'
      },
      503
    )
  }

  try {
    const response = await fetch(new URL('/v1/chat/completions', aiConfig.baseUrl).toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aiConfig.apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: buildUpstreamMessages(normalized.value, sessionResult.user),
        temperature: 0.3
      })
    })

    const rawText = await response.text()
    let data = null

    try {
      data = JSON.parse(rawText)
    } catch {
      data = null
    }

    if (!response.ok) {
      return json(
        {
          error: 'ai_request_failed',
          details: extractErrorMessage(data, rawText)
        },
        502
      )
    }

    const answer = extractAssistantContent(data)
    if (!answer) {
      return json(
        {
          error: 'empty_ai_response'
        },
        502
      )
    }

    return json({
      answer,
      model: data?.model || aiConfig.model,
      provider: new URL(aiConfig.baseUrl).hostname
    })
  } catch (error) {
    return json(
      {
        error: 'ai_request_failed',
        details: error?.message || 'unknown_error'
      },
      502
    )
  }
}

async function readAuthenticatedSession(context) {
  const config = getLinuxDOConfig(context.env)
  if (!config.sessionSecret) {
    return {
      ok: false,
      response: json(
        {
          error: 'session_unavailable'
        },
        503
      )
    }
  }

  const payload = await readSession(context.request, config.sessionSecret)
  if (!payload?.user) {
    return {
      ok: false,
      response: json(
        {
          error: 'unauthenticated'
        },
        401
      )
    }
  }

  return {
    ok: true,
    user: payload.user
  }
}

function getAiConfig(env) {
  const baseUrl = String(env.AI_API_BASE_URL || DEFAULT_AI_BASE_URL).trim()
  const apiKey = String(env.AI_API_KEY || '').trim()
  const model = String(env.AI_MODEL || DEFAULT_AI_MODEL).trim()
  const missing = []

  if (!apiKey) {
    missing.push('AI_API_KEY')
  }

  return {
    baseUrl: baseUrl || DEFAULT_AI_BASE_URL,
    apiKey,
    model: model || DEFAULT_AI_MODEL,
    missing
  }
}

function normalizePayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      error: 'invalid_payload'
    }
  }

  if (!Array.isArray(value.messages) || value.messages.length === 0) {
    return {
      ok: false,
      error: 'invalid_messages'
    }
  }

  const normalizedMessages = []

  value.messages.slice(-MAX_MESSAGES).forEach((item) => {
    const role = String(item?.role || '').trim()
    const content = String(item?.content || '').trim()

    if (!['user', 'assistant'].includes(role) || !content || content.length > MAX_MESSAGE_CHARS) {
      return
    }

    normalizedMessages.push({
      role,
      content
    })
  })

  if (normalizedMessages.length === 0) {
    return {
      ok: false,
      error: 'invalid_messages'
    }
  }

  return {
    ok: true,
    value: {
      messages: normalizedMessages,
      context: normalizeContext(value.context)
    }
  }
}

function normalizeContext(source) {
  const safeSource = source && typeof source === 'object' && !Array.isArray(source) ? source : {}
  const selectedPackages = Array.isArray(safeSource.selectedPackages)
    ? safeSource.selectedPackages
        .slice(0, MAX_SELECTED_PACKAGES)
        .map((item) => ({
          id: String(item?.id || '').trim(),
          name: String(item?.name || '').trim(),
          categoryName: String(item?.categoryName || '').trim()
        }))
        .filter((item) => item.id && item.name)
    : []

  return {
    selectedPackages,
    selectedCount: toSafeInt(safeSource.selectedCount),
    pendingCount: toSafeInt(safeSource.pendingCount),
    detectedInstalledCount: toSafeInt(safeSource.detectedInstalledCount),
    autoDependencyCount: toSafeInt(safeSource.autoDependencyCount),
    skippedInstalledCount: toSafeInt(safeSource.skippedInstalledCount),
    hasDetectionData: Boolean(safeSource.hasDetectionData),
    installer: safeSource.installer === 'Scoop' ? 'Scoop' : 'Chocolatey'
  }
}

function buildUpstreamMessages(payload, user) {
  return [
    {
      role: 'system',
      content: [
        '你是“安的爽”的内置 AI 助手，服务对象是正在配置 Windows 开发环境的用户。',
        '你的主要职责是：推荐环境组合、解释安装策略、帮助排查脚本和环境问题。',
        '请默认使用简体中文回答，语气简洁、直接、可执行。',
        '不要假装你已经执行过任何安装、体检、下载或系统修改。',
        '如果信息不足，要明确说出你是在基于当前页面上下文做推测。',
        '优先给出短步骤和明确取舍，不要写成长篇空话。'
      ].join('\n')
    },
    {
      role: 'system',
      content: buildContextPrompt(payload.context, user)
    },
    ...payload.messages
  ]
}

function buildContextPrompt(context, user) {
  const selectedPackagesText = context.selectedPackages.length
    ? context.selectedPackages
        .map((item) => `- ${item.name} (${item.id}) / ${item.categoryName || '未分类'}`)
        .join('\n')
    : '- 当前还没有勾选具体环境'

  return [
    '这是当前控制台上下文，请结合它回答：',
    `- 登录用户：${user?.name || user?.username || '未知用户'} (@${user?.username || 'unknown'})`,
    `- 已选环境数量：${context.selectedCount}`,
    `- 待安装数量：${context.pendingCount}`,
    `- 已识别安装数量：${context.detectedInstalledCount}`,
    `- 自动依赖数量：${context.autoDependencyCount}`,
    `- 已跳过数量：${context.skippedInstalledCount}`,
    `- 是否已导入体检结果：${context.hasDetectionData ? '是' : '否'}`,
    `- 当前安装方式：${context.installer}`,
    '- 已选环境列表：',
    selectedPackagesText
  ].join('\n')
}

function extractAssistantContent(payload) {
  const content = payload?.choices?.[0]?.message?.content

  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item
        }

        return String(item?.text || '').trim()
      })
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  return ''
}

function extractErrorMessage(payload, fallbackText) {
  const directMessage =
    payload?.error?.message ||
    payload?.message ||
    payload?.error ||
    ''

  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage.trim()
  }

  return String(fallbackText || 'upstream_error').slice(0, 300)
}

function toSafeInt(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}
