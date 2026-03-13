import { clearCookie, createCookie, parseCookies } from './cookies.js'

export const SESSION_COOKIE_NAME = 'andeshuang_session'
export const OAUTH_STATE_COOKIE_NAME = 'andeshuang_oauth_state'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
export const OAUTH_STATE_TTL_SECONDS = 60 * 10

export function readCookie(request, name) {
  return parseCookies(request)[name] || ''
}

export function shouldUseSecureCookies(request) {
  const url = new URL(request.url)
  return url.protocol === 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)
}

export function createOAuthStateCookie(value, secure = true) {
  return createCookie(OAUTH_STATE_COOKIE_NAME, value, {
    maxAge: OAUTH_STATE_TTL_SECONDS,
    secure
  })
}

export function clearOAuthStateCookie(secure = true) {
  return clearCookie(OAUTH_STATE_COOKIE_NAME, {
    secure
  })
}

export async function createSessionCookie(user, secret, secure = true) {
  const payload = {
    user,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000
  }

  const token = await signPayload(payload, secret)
  return createCookie(SESSION_COOKIE_NAME, token, {
    maxAge: SESSION_TTL_SECONDS,
    secure
  })
}

export function clearSessionCookie(secure = true) {
  return clearCookie(SESSION_COOKIE_NAME, {
    secure
  })
}

export async function readSession(request, secret) {
  const token = readCookie(request, SESSION_COOKIE_NAME)
  if (!token) return null

  return verifyPayload(token, secret)
}

async function signPayload(payload, secret) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = await signValue(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

async function verifyPayload(token, secret) {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  const expectedSignature = await signValue(encodedPayload, secret)
  if (signature !== expectedSignature) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload))
    if (!payload?.expiresAt || payload.expiresAt < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

async function signValue(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return base64UrlEncode(signature)
}

function base64UrlEncode(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
