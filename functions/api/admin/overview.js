import { getLinuxDOConfig } from '../../_shared/linuxdo.js'
import { readSession } from '../../_shared/session.js'

export async function onRequestGet(context) {
  const config = getLinuxDOConfig(context.env)
  const payload = config.sessionSecret
    ? await readSession(context.request, config.sessionSecret)
    : null

  if (!payload?.user) {
    return json(
      {
        authenticated: false
      },
      401
    )
  }

  return json({
    authenticated: true,
    admin: {
      user: payload.user
    },
    dashboards: {
      cloudflareHome: context.env.CLOUDFLARE_DASHBOARD_URL || 'https://dash.cloudflare.com/',
      pagesProject: context.env.CLOUDFLARE_PAGES_PROJECT_URL || '',
      webAnalytics: context.env.CLOUDFLARE_WEB_ANALYTICS_URL || '',
      downloads: context.env.CLOUDFLARE_DOWNLOADS_URL || ''
    },
    operations: {
      staticRequestsPlan: 'Pages 静态资源通常不消耗 Functions 请求额度',
      functionsBudget: 'Workers Free 额度通常按每日 100000 次请求计算'
    }
  })
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  })
}
