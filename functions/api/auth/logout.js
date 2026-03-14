import { clearOAuthStateCookie, clearSessionCookie, shouldUseSecureCookies } from '../../_shared/session.js'

export async function onRequestPost(context) {
  if (!isSameOriginRequest(context.request)) {
    return new Response(
      JSON.stringify({
        authenticated: false,
        error: 'forbidden_origin'
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      }
    )
  }

  const secure = shouldUseSecureCookies(context.request)
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
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
