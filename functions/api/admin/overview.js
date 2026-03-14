import { getLocalAuthAdminSnapshot } from '../../_shared/local-auth.js'
import { json, requireAdminRequest } from '../../_shared/admin.js'

export async function onRequestGet(context) {
  const admin = await requireAdminRequest(context)
  if (!admin.ok) {
    return admin.response
  }

  const authManagement = await getLocalAuthAdminSnapshot(context.env)

  return json({
    authenticated: true,
    authorized: true,
    admin: {
      user: admin.user
    },
    dashboards: {
      cloudflareHome: context.env.CLOUDFLARE_DASHBOARD_URL || 'https://dash.cloudflare.com/',
      pagesProject: context.env.CLOUDFLARE_PAGES_PROJECT_URL || '',
      webAnalytics: context.env.CLOUDFLARE_WEB_ANALYTICS_URL || '',
      downloads: context.env.CLOUDFLARE_DOWNLOADS_URL || ''
    },
    operations: {
      staticRequestsPlan: 'Pages 静态资源通常不消耗 Functions 请求额度',
      functionsBudget: 'Workers Free 通常按每日 100000 次请求估算'
    },
    authManagement
  })
}
