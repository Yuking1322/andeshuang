import { getLinuxDOConfig, isAdminUser } from './linuxdo.js'
import { readSession } from './session.js'

export async function requireAdminRequest(context) {
  const config = getLinuxDOConfig(context.env)
  const payload = config.sessionSecret
    ? await readSession(context.request, config.sessionSecret)
    : null

  if (!payload?.user) {
    return {
      ok: false,
      response: json(
        {
          authenticated: false
        },
        401
      )
    }
  }

  if (!isAdminUser(payload.user, context.env)) {
    return {
      ok: false,
      response: json(
        {
          authenticated: true,
          authorized: false
        },
        403
      )
    }
  }

  return {
    ok: true,
    user: payload.user,
    config
  }
}

export function isSameOriginRequest(request) {
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

export async function readJson(request) {
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

export function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  })
}
