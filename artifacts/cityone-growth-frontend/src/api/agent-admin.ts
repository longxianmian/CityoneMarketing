import request from './request'

export function getAgentConfig() {
  return request.get('/api/admin/agent/config')
}

export function updateAgentConfig(data: any) {
  return request.post('/api/admin/agent/config/update', data)
}

export function getAgentIntents(params?: any) {
  return request.get('/api/admin/agent/intents', { params })
}

export function updateAgentIntent(data: any) {
  return request.post('/api/admin/agent/intents/update', data)
}

export function createAgentIntent(data: any) {
  return request.post('/api/admin/agent/intents/create', data)
}

export function getAgentTools() {
  return request.get('/api/admin/agent/tools')
}

export function updateAgentTool(data: any) {
  return request.post('/api/admin/agent/tools/update', data)
}

export function getAgentLogs(params: any) {
  return request.get('/api/admin/agent/logs', { params })
}

export function getAgentMetrics(params?: any) {
  return request.get('/api/admin/agent/metrics', { params })
}
