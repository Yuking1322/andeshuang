import { buildAuthorizeUrl, getLinuxDOConfig, getMissingConfig } from '../../../_shared/linuxdo.js'
import { createOAuthStateCookie, shouldUseSecureCookies } from '../../../_shared/session.js'

export async function onRequestGet(context) {
  const config = getLinuxDOConfig(context.env)
  const missingConfig = getMissingConfig(config)

  if (missingConfig.length > 0) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/?authError=config_missing'
      }
    })
  }

  const state = crypto.randomUUID()
  const location = buildAuthorizeUrl(config, state)
  const secure = shouldUseSecureCookies(context.request)

  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Set-Cookie': createOAuthStateCookie(state, secure)
    }
  })
}
