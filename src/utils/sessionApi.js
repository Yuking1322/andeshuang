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
