import { clearOAuthStateCookie, clearSessionCookie, shouldUseSecureCookies } from '../../_shared/session.js'

export async function onRequestPost(context) {
  const secure = shouldUseSecureCookies(context.request)
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8'
  })

  headers.append('Set-Cookie', clearSessionCookie(secure))
  headers.append('Set-Cookie', clearOAuthStateCookie(secure))

  return new Response(
    JSON.stringify({
      authenticated: false
    }),
    {
      status: 200,
      headers
    }
  )
}
