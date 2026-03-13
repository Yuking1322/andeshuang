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
