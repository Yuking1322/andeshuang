import { getLinuxDOConfig, isAdminUser } from '../_shared/linuxdo.js'
import { getLocalAuthClientConfig } from '../_shared/local-auth.js'
import { readSession } from '../_shared/session.js'

export async function onRequestGet(context) {
  const config = getLinuxDOConfig(context.env)
  const localAuth = await getLocalAuthClientConfig(context.env)
  const payload = config.sessionSecret
    ? await readSession(context.request, config.sessionSecret)
    : null

  if (!payload?.user) {
    return json({
      authenticated: false,
      localAuth
    })
  }

  return json({
    authenticated: true,
    user: payload.user,
    isAdmin: isAdminUser(payload.user, context.env),
    localAuth
  })
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
