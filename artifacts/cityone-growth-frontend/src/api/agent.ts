import axios from 'axios'

const agentHttp = axios.create({
  baseURL: '',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

/** 初始化或恢复会话（后端7天内同用户自动恢复） */
export function initAgentSession(data: {
  line_user_id?: string
  site_id?: string
  entry_type?: string
  entry_code?: string
  language?: string
}) {
  return agentHttp.post('/api/agent/session/init', data)
}

/** 获取会话历史消息 */
export function getAgentSessionMessages(sessionId: string, limit = 50) {
  return agentHttp.get(`/api/agent/session/${sessionId}/messages?limit=${limit}`)
}

/** 发送消息 */
export function sendAgentMessage(sessionId: string, data: {
  text: string
  language?: string
}) {
  return agentHttp.post(`/api/agent/session/${sessionId}/message`, data)
}

/** 确认动作 */
export function confirmAgentAction(sessionId: string, data: {
  intent_code: string
  confirmed: boolean
  slots?: Record<string, unknown>
  language?: string
}) {
  return agentHttp.post(`/api/agent/session/${sessionId}/confirm`, data)
}

/** 通过 line_user_id 恢复最近会话（兜底入口，适用于本地无 sessionId 场景） */
export function getAgentSessionLatest(lineUserId: string) {
  return agentHttp.get(`/api/agent/session/latest?line_user_id=${lineUserId}`)
}

/** 获取可用 Agent 能力列表 */
export function getAgentCapabilities(params?: { line_user_id?: string }) {
  return agentHttp.get('/api/agent/capabilities', { params })
}

/** 上传文件 */
export function uploadAgentFile(sessionId: string, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('session_id', sessionId)
  return agentHttp.post('/api/agent/upload', fd)
}
