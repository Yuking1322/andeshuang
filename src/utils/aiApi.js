export async function askAiAssistant(payload, options = {}) {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload),
    signal: options.signal
  })

  const data = await safeJson(response)
  if (!response.ok) {
    const error = new Error(data?.error || `AI_REQUEST_FAILED_${response.status}`)
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
