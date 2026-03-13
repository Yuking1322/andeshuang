const DEFAULTS = {
  authUrl: 'https://connect.linux.do/oauth2/authorize',
  tokenUrl: 'https://connect.linux.do/oauth2/token',
  userUrl: 'https://connect.linux.do/api/user'
}

export function getLinuxDOConfig(env) {
  return {
    clientId: env.LINUXDO_CLIENT_ID || '',
    clientSecret: env.LINUXDO_CLIENT_SECRET || '',
    redirectUri: env.LINUXDO_REDIRECT_URI || '',
    authUrl: env.LINUXDO_AUTH_URL || DEFAULTS.authUrl,
    tokenUrl: env.LINUXDO_TOKEN_URL || DEFAULTS.tokenUrl,
    userUrl: env.LINUXDO_USER_URL || DEFAULTS.userUrl,
    sessionSecret: env.SESSION_SECRET || ''
  }
}

export function getMissingConfig(config) {
  return [
    ['LINUXDO_CLIENT_ID', config.clientId],
    ['LINUXDO_CLIENT_SECRET', config.clientSecret],
    ['LINUXDO_REDIRECT_URI', config.redirectUri],
    ['SESSION_SECRET', config.sessionSecret]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)
}

export function buildAuthorizeUrl(config, state) {
  const url = new URL(config.authUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('state', state)
  return url.toString()
}

export async function exchangeCodeForToken(config, code) {
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`TOKEN_EXCHANGE_FAILED:${response.status}:${body}`)
  }

  return response.json()
}

export async function fetchLinuxDOUser(config, accessToken) {
  const response = await fetch(config.userUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`USER_FETCH_FAILED:${response.status}:${body}`)
  }

  const payload = await response.json()
  return mapLinuxDOUser(payload)
}

function mapLinuxDOUser(payload) {
  const avatarTemplate = payload.avatar || payload.avatar_url || payload.avatar_template || ''

  return {
    id: payload.id ?? '',
    username: payload.username || payload.preferred_username || payload.name || '',
    name: payload.name || payload.username || '',
    avatar: buildAvatarUrl(avatarTemplate),
    trustLevel: payload.trust_level ?? payload.trustLevel ?? null
  }
}

function buildAvatarUrl(value) {
  if (!value) return ''
  const normalized = value.replace('{size}', '120')

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized
  }

  if (normalized.startsWith('//')) {
    return `https:${normalized}`
  }

  if (normalized.startsWith('/')) {
    return `https://linux.do${normalized}`
  }

  return normalized
}
