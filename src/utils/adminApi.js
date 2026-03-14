export async function fetchAdminOverview() {
  const response = await fetch('/api/admin/overview', {
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`ADMIN_OVERVIEW_FAILED_${response.status}`)
  }

  return response.json()
}

export async function updateLocalAuthSettings(payload) {
  return postJson('/api/admin/auth/settings', payload)
}

export async function updateLocalAuthUser(payload) {
  return postJson('/api/admin/auth/users', payload)
}

export async function deleteLocalAuthUser(payload) {
  return postJson('/api/admin/auth/users/delete', payload)
}

export async function generateLocalAuthInvite(payload) {
  return postJson('/api/admin/auth/invites/generate', payload)
}

export async function updateLocalAuthInvite(payload) {
  return postJson('/api/admin/auth/invites/update', payload)
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
