export function getClientPlatform() {
  if (typeof navigator === 'undefined') {
    return {
      id: 'unknown',
      label: '未知平台',
      isWindows: false
    }
  }

  const userAgent = navigator.userAgent.toLowerCase()
  const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase()
  const source = `${platform} ${userAgent}`

  if (source.includes('win')) {
    return {
      id: 'windows',
      label: 'Windows',
      isWindows: true
    }
  }

  if (source.includes('mac')) {
    return {
      id: 'macos',
      label: 'macOS',
      isWindows: false
    }
  }

  if (source.includes('linux') || source.includes('x11')) {
    return {
      id: 'linux',
      label: 'Linux',
      isWindows: false
    }
  }

  return {
    id: 'unknown',
    label: '未知平台',
    isWindows: false
  }
}
