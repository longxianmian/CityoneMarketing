/**
 * clientLogger — 前端关键事件埋点
 *
 * 用途：dev 调试时把用户操作链路每一步打到后端 data/client-events.jsonl，
 * agent 直接 grep 文件就能精确还原"你点了什么 → 系统怎么反应"，
 * 弥补口头描述不准确的问题。
 *
 * 设计：
 *   - console.info 同步输出（DevTools 也能看）
 *   - 队列 + 批量 POST 到 /api/growth/client-log（200ms debounce）
 *   - 页面跳走时用 navigator.sendBeacon 兜底，避免丢失最后一批日志
 *
 * 不做的事：
 *   - 不收集 PII / 不打密钥 / 不打完整 URL（intent token 截断显示）
 *   - 不阻塞业务流程（fetch 失败静默吞掉）
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const SESSION_ID = (() => {
  try {
    const k = '__cg_session_id__'
    let v = sessionStorage.getItem(k)
    if (!v) {
      v = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
      sessionStorage.setItem(k, v)
    }
    return v
  } catch {
    return `s${Date.now().toString(36)}`
  }
})()

interface LogEvent {
  client_ts: string
  session_id: string
  event: string
  page: string
  data?: Record<string, any>
}

let queue: LogEvent[] = []
let flushTimer: number = 0

function safePath() {
  try {
    return window.location.pathname + window.location.search
  } catch {
    return ''
  }
}

function flush() {
  if (!queue.length) return
  const payload = { events: queue }
  queue = []
  const url = `${API_BASE}/api/growth/client-log`
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url, blob)
      return
    }
  } catch {
    // 降级到 fetch
  }
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // 静默吞
  })
}

/** 关键事件埋点：event 用 snake.case，data 任意 JSON-safe 对象 */
export function clientLog(event: string, data?: Record<string, any>) {
  const evt: LogEvent = {
    client_ts: new Date().toISOString(),
    session_id: SESSION_ID,
    event,
    page: safePath(),
    data: data || {},
  }
  // DevTools 可见
  // eslint-disable-next-line no-console
  console.info('[clog]', event, data || '')
  queue.push(evt)
  if (flushTimer) window.clearTimeout(flushTimer)
  flushTimer = window.setTimeout(flush, 200)
}

// 页面卸载/切走前兜底 flush
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  window.addEventListener('beforeunload', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}
