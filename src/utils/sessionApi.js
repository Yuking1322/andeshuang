export async function fetchSession() {
  const response = await fetch('/api/session', {
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`SESSION_REQUEST_FAILED_${response.status}`)
  }

  return response.json()
}

export function beginLinuxDOLogin() {
  window.location.assign('/api/auth/linuxdo/login')
}

export async function registerLocalAccount(payload) {
  return postJson('/api/auth/local/register', payload)
}

export async function loginLocalAccount(payload) {
  return postJson('/api/auth/local/login', payload)
}

export async function logoutSession() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`LOGOUT_FAILED_${response.status}`)
  }

  return response.json()
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const data = await safeJson(response)
  if (!response.ok) {
    const error = new Error(data?.error || `REQUEST_FAILED_${response.status}`)
    error.code = data?.error || ''
    error.status = response.status
    error.details = data
    throw error
  }

  return data
}

async function safeJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}
