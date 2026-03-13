import { exchangeCodeForToken, fetchLinuxDOUser, getLinuxDOConfig, getMissingConfig } from '../../../_shared/linuxdo.js'
import {
  clearOAuthStateCookie,
  createSessionCookie,
  readCookie,
  OAUTH_STATE_COOKIE_NAME,
  shouldUseSecureCookies
} from '../../../_shared/session.js'

export async function onRequestGet(context) {
  const config = getLinuxDOConfig(context.env)
  const missingConfig = getMissingConfig(config)

  if (missingConfig.length > 0) {
    return redirectWithError('/', 'config_missing')
  }

  const url = new URL(context.request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const stateCookie = readCookie(context.request, OAUTH_STATE_COOKIE_NAME)
  const secure = shouldUseSecureCookies(context.request)

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return redirectWithError('/', 'state_mismatch', secure)
  }

  try {
    const tokenResponse = await exchangeCodeForToken(config, code)
    const accessToken = tokenResponse.access_token || ''

    if (!accessToken) {
      return redirectWithError('/', 'token_missing', secure)
    }

    const user = await fetchLinuxDOUser(config, accessToken)
    const sessionCookie = await createSessionCookie(user, config.sessionSecret, secure)
    const headers = new Headers({
      Location: '/'
    })
    headers.append('Set-Cookie', sessionCookie)
    headers.append('Set-Cookie', clearOAuthStateCookie(secure))

    return new Response(null, {
      status: 302,
      headers
    })
  } catch {
    return redirectWithError('/', 'login_failed', secure)
  }
}

function redirectWithError(baseUrl, code, secure) {
  const location = new URL(baseUrl, 'https://dummy.local')
  location.searchParams.set('authError', code)
  const headers = new Headers({
    Location: `${location.pathname}${location.search}`
  })
  headers.append('Set-Cookie', clearOAuthStateCookie(secure))

  return new Response(null, {
    status: 302,
    headers
  })
}
