import { getLinuxDOConfig, isAdminUser } from '../../../_shared/linuxdo.js'
import { authenticateLocalUser, hasLocalAuthDatabase, validateLoginInput } from '../../../_shared/local-auth.js'
import { createSessionCookie, shouldUseSecureCookies } from '../../../_shared/session.js'

export async function onRequestPost(context) {
  const config = getLinuxDOConfig(context.env)

  if (!isSameOriginRequest(context.request)) {
    return json(
      {
        authenticated: false,
        error: 'forbidden_origin',
        message: '当前请求来源不被允许。'
      },
      403
    )
  }

  if (!hasLocalAuthDatabase(context.env)) {
    return json(
      {
        authenticated: false,
        error: 'local_auth_unavailable',
        message: '当前环境还没有绑定内测账号数据库。'
      },
      503
    )
  }

  if (!config.sessionSecret) {
    return json(
      {
        authenticated: false,
        error: 'session_unavailable',
        message: '当前环境缺少会话密钥，暂时无法登录内测账号。'
      },
      503
    )
  }

  const body = await readJson(context.request)
  if (!body.ok) {
    return json(
      {
        authenticated: false,
        error: 'invalid_payload',
        message: '登录请求格式不正确，请检查输入内容。'
      },
      400
    )
  }

  const validated = validateLoginInput(body.value)
  if (!validated.ok) {
    return json(
      {
        authenticated: false,
        error: validated.error,
        message: validated.message
      },
      400
    )
  }

  const user = await authenticateLocalUser(
    context.env.AUTH_DB,
    validated.value.username,
    validated.value.password
  )

  if (!user) {
    return json(
      {
        authenticated: false,
        error: 'invalid_credentials',
        message: '用户名或密码不正确。'
      },
      401
    )
  }

  const secure = shouldUseSecureCookies(context.request)
  const sessionCookie = await createSessionCookie(user, config.sessionSecret, secure)
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  headers.append('Set-Cookie', sessionCookie)

  return new Response(
    JSON.stringify({
      authenticated: true,
      user,
      isAdmin: isAdminUser(user, context.env)
    }),
    {
      status: 200,
      headers
    }
  )
}

async function readJson(request) {
  try {
    return {
      ok: true,
      value: await request.json()
    }
  } catch {
    return {
      ok: false
    }
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  })
}

function isSameOriginRequest(request) {
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('Origin')
  const referer = request.headers.get('Referer')

  if (origin) {
    return origin === requestUrl.origin
  }

  if (referer) {
    try {
      return new URL(referer).origin === requestUrl.origin
    } catch {
      return false
    }
  }

  return true
}
