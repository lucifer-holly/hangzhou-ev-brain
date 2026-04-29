/**
 * Translate raw error objects/strings into user-friendly bilingual
 * messages. Use this everywhere we surface an error to a non-technical
 * end user (toasts, inline error states, banners).
 *
 * Keep technical detail in the developer console; only friendly text
 * goes to the UI.
 */

interface FriendlyError {
  title: string
  hint: string
}

export function friendlyError(e: unknown): FriendlyError {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  const lc = raw.toLowerCase()

  if (lc.includes('failed to fetch') || lc.includes('network') || lc.includes('econnrefused')) {
    return { title: '网络异常 · Network unavailable', hint: '正在重试，请检查后端是否已启动' }
  }
  if (lc.includes('websocket') || lc.includes('ws ')) {
    return { title: '实时连接断开', hint: '正在重新连接 · Realtime stream lost' }
  }
  if (lc.includes('timeout') || lc.includes('timed out')) {
    return { title: '请求超时 · Request timed out', hint: '稍后再试，或检查网络情况' }
  }
  if (lc.includes(' 5') || /\b50\d\b/.test(raw)) {
    return { title: '服务暂时不可用 · Service unavailable', hint: '后端可能正在重启，请稍候' }
  }
  if (lc.includes(' 4') || /\b40[0134]\b/.test(raw)) {
    return { title: '请求被拒绝 · Request rejected', hint: '请检查 API key 或参数' }
  }
  if (lc.includes('amap') || lc.includes('map')) {
    return { title: '地图加载失败', hint: '检查 VITE_AMAP_KEY 或回退到 OSM 模式' }
  }

  return {
    title: raw || '出了点小问题 · Something went wrong',
    hint: '请稍后再试',
  }
}

/** One-line shortcut for inline labels — title only, no hint. */
export function friendlyTitle(e: unknown): string {
  return friendlyError(e).title
}
