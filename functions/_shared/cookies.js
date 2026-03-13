const DEFAULT_PATH = '/'

export function parseCookies(request) {
  const header = request.headers.get('Cookie') || ''
  return header.split(';').reduce((cookies, item) => {
    const [name, ...rest] = item.trim().split('=')
    if (!name) return cookies
    cookies[name] = decodeURIComponent(rest.join('=') || '')
    return cookies
  }, {})
}

export function createCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`]

  parts.push(`Path=${options.path || DEFAULT_PATH}`)

  if (typeof options.maxAge === 'number') {
    parts.push(`Max-Age=${options.maxAge}`)
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`)
  }

  if (options.httpOnly !== false) {
    parts.push('HttpOnly')
  }

  if (options.secure !== false) {
    parts.push('Secure')
  }

  parts.push(`SameSite=${options.sameSite || 'Lax'}`)

  return parts.join('; ')
}

export function clearCookie(name, options = {}) {
  return createCookie(name, '', {
    ...options,
    expires: new Date(0),
    maxAge: 0
  })
}
