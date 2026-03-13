export function setupCloudflareAnalytics() {
  const token = import.meta.env.VITE_CF_WEB_ANALYTICS_TOKEN?.trim()
  if (!token || typeof document === 'undefined') {
    return
  }

  if (document.querySelector('script[data-andeshuang-analytics="cloudflare"]')) {
    return
  }

  const script = document.createElement('script')
  script.defer = true
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  script.dataset.cfBeacon = JSON.stringify({ token })
  script.dataset.andeshuangAnalytics = 'cloudflare'
  document.head.appendChild(script)
}
