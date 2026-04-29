import request from './request'

// ─── 原有接口（保持原样，baseURL=/api，路径从 /api/ 开始兼容已有调用） ─────────

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

export function seedIntentVectors() {
  return request.post('/agent-admin/seed-intent-vectors', {})
}

export function reEmbedIntent(intentCode: string) {
  return request.post('/agent-admin/re-embed-intent', { intent_code: intentCode })
}

export function runIntentRecallTest(data: { text: string; top_k?: number }) {
  return request.post('/agent-admin/recall-test', data)
}

export function getIntentLabels() {
  return request.get('/agent-admin/intent-labels')
}

// ─── 新增接口（baseURL=/api，下面路径不带 /api/ 前缀） ────────────────────────
// 前端 request baseURL = '/api'，Vite dev proxy 会把 '/api/*' 转发给
// VITE_API_PROXY_TARGET（默认 http://127.0.0.1:3100）
// 所以下面路径应为 '/admin/...' 而不是 '/api/admin/...'

// ─── Agents 基础信息 ──────────────────────────────────────────────────────────

export function getAgentsList() {
  return request.get('/admin/agents')
}

export function updateAgent(agentCode: string, data: any) {
  return request.post(`/admin/agents/${agentCode}/update`, data)
}

export function toggleAgent(agentCode: string, isEnabled: boolean) {
  return request.post(`/admin/agents/${agentCode}/toggle`, { is_enabled: isEnabled })
}

// ─── 角色关键词 ───────────────────────────────────────────────────────────────

export function getAgentKeywords(params?: { agent_code?: string; language?: string }) {
  return request.get('/admin/agent-keywords', { params })
}

export function saveAgentKeywords(data: any) {
  return request.post('/admin/agent-keywords/save', data)
}

// ─── Skills ──────────────────────────────────────────────────────────────────

export function getAgentSkills(params?: { agent_code?: string }) {
  return request.get('/admin/agent-skills', { params })
}

export function createAgentSkill(data: any) {
  return request.post('/admin/agent-skills', data)
}

export function updateAgentSkill(id: number, data: any) {
  return request.post(`/admin/agent-skills/${id}/update`, data)
}

export function deleteAgentSkill(id: number) {
  return request.post(`/admin/agent-skills/${id}/delete`, {})
}

// ─── 问问卡片模板 ─────────────────────────────────────────────────────────────

export function getCardTemplates(params?: { language?: string }) {
  return request.get('/admin/wenwen/card-templates', { params })
}

export function createCardTemplate(data: any) {
  return request.post('/admin/wenwen/card-templates', data)
}

export function updateCardTemplate(id: number, data: any) {
  return request.post(`/admin/wenwen/card-templates/${id}/update`, data)
}

export function deleteCardTemplate(id: number) {
  return request.post(`/admin/wenwen/card-templates/${id}/delete`, {})
}

// ─── 协议内容 ─────────────────────────────────────────────────────────────────

export function getPolicyContents(params?: { policy_type?: string; language?: string }) {
  return request.get('/admin/wenwen/policy-contents', { params })
}

export function savePolicyContent(data: any) {
  return request.post('/admin/wenwen/policy-contents/save', data)
}

// ─── 业务 KPI 指标 ────────────────────────────────────────────────────────────

export function getKpiMetrics(params?: { department?: string }) {
  return request.get('/admin/biz/kpi-metrics', { params })
}

export function createKpiMetric(data: any) {
  return request.post('/admin/biz/kpi-metrics', data)
}

export function updateKpiMetric(id: number, data: any) {
  return request.post(`/admin/biz/kpi-metrics/${id}/update`, data)
}

export function deleteKpiMetric(id: number) {
  return request.post(`/admin/biz/kpi-metrics/${id}/delete`, {})
}

// ─── 报表模板 ─────────────────────────────────────────────────────────────────

export function getReportTemplates(params?: { department?: string; template_type?: string }) {
  return request.get('/admin/biz/report-templates', { params })
}

export function createReportTemplate(data: any) {
  return request.post('/admin/biz/report-templates', data)
}

export function updateReportTemplate(id: number, data: any) {
  return request.post(`/admin/biz/report-templates/${id}/update`, data)
}

export function deleteReportTemplate(id: number) {
  return request.post(`/admin/biz/report-templates/${id}/delete`, {})
}

// ─── 预警规则 ─────────────────────────────────────────────────────────────────

export function getAlertRules() {
  return request.get('/admin/biz/alert-rules')
}

export function createAlertRule(data: any) {
  return request.post('/admin/biz/alert-rules', data)
}

export function updateAlertRule(id: number, data: any) {
  return request.post(`/admin/biz/alert-rules/${id}/update`, data)
}

export function deleteAlertRule(id: number) {
  return request.post(`/admin/biz/alert-rules/${id}/delete`, {})
}

// ─── 动作建议模板 ─────────────────────────────────────────────────────────────

export function getActionSuggestions(params?: { department?: string }) {
  return request.get('/admin/biz/action-suggestions', { params })
}

export function createActionSuggestion(data: any) {
  return request.post('/admin/biz/action-suggestions', data)
}

export function updateActionSuggestion(id: number, data: any) {
  return request.post(`/admin/biz/action-suggestions/${id}/update`, data)
}

export function deleteActionSuggestion(id: number) {
  return request.post(`/admin/biz/action-suggestions/${id}/delete`, {})
}

// ─── 运维故障类型字典 ─────────────────────────────────────────────────────────

export function getIssueTypes() {
  return request.get('/admin/ops/issue-types')
}

export function createIssueType(data: any) {
  return request.post('/admin/ops/issue-types', data)
}

export function updateIssueType(id: number, data: any) {
  return request.post(`/admin/ops/issue-types/${id}/update`, data)
}

export function deleteIssueType(id: number) {
  return request.post(`/admin/ops/issue-types/${id}/delete`, {})
}

// ─── 运维修复动作字典 ─────────────────────────────────────────────────────────

export function getRepairActions(params?: { issue_code?: string }) {
  return request.get('/admin/ops/repair-actions', { params })
}

export function createRepairAction(data: any) {
  return request.post('/admin/ops/repair-actions', data)
}

export function updateRepairAction(id: number, data: any) {
  return request.post(`/admin/ops/repair-actions/${id}/update`, data)
}

export function deleteRepairAction(id: number) {
  return request.post(`/admin/ops/repair-actions/${id}/delete`, {})
}
