import request from './request'

export function getTrafficList(params: { pageNum: number; pageSize: number; utmSource?: string }) {
  return request.get('/growth/traffic/list', { params })
}

export function getTrafficSummary() {
  return request.get('/growth/traffic/summary')
}

export function getCouponList(params: { pageNum: number; pageSize: number; name?: string }) {
  return request.get('/growth/coupon/list', { params })
}

export function addCoupon(data: any) {
  return request.post('/growth/coupon/add', data)
}

export function updateCoupon(data: any) {
  return request.post('/growth/coupon/update', data)
}

export function deleteCoupon(data: { id: number }) {
  return request.post('/growth/coupon/delete', data)
}

export function getPointsRules() {
  return request.get('/growth/points/rules')
}

export function addPointsRule(data: any) {
  return request.post('/growth/points/rule/add', data)
}

export function updatePointsRule(data: any) {
  return request.post('/growth/points/rule/update', data)
}

export function getUserPointsSummary(params?: { user_id?: string; line_user_id?: string }) {
  return request.get('/growth/user/points/summary', { params })
}

export function getUserPointsLedger(params?: {
  user_id?: string
  line_user_id?: string
  page?: number
  page_size?: number
}) {
  return request.get('/growth/user/points/ledger', { params })
}

export function getUserPointsRedeems(params?: {
  user_id?: string
  line_user_id?: string
  page?: number
  page_size?: number
}) {
  return request.get('/growth/user/points/redeems', { params })
}

export function getAdminPointsAccounts(params?: {
  page?: number
  page_size?: number
  keyword?: string
}) {
  return request.get('/growth/admin/points/accounts', { params })
}

export function getAdminShareRelations(params?: {
  page?: number
  page_size?: number
  campaign_id?: string
  points_status?: string
}) {
  return request.get('/growth/admin/points/share-relations', { params })
}

export function getAdminConsumeRelations(params?: {
  page?: number
  page_size?: number
  user_id?: string
  points_status?: string
}) {
  return request.get('/growth/admin/points/consume-relations', { params })
}

export function adjustPoints(data: {
  user_id?: string
  line_user_id?: string
  type: 'credit' | 'debit'
  points: number
  reason: string
  operator_id: string
}) {
  return request.post('/growth/points/adjust', data)
}

export function getEntryConfig() {
  return request.get('/entry/config')
}

export function getEntryAllowedTypes() {
  return request.get('/entry/allowed-types')
}

export function getEntryFeatureRules() {
  return request.get('/entry/feature-rules')
}

export function getEntryTemplateList() {
  return request.get('/entries/templates')
}

export function createEntryTemplate(data: {
  template_name: string
  entry_type: string
  default_feature_name: string
}) {
  return request.post('/entries/templates', data)
}

export function updateEntryTemplate(
  templateId: string,
  data: {
    template_name: string
    entry_type: string
    default_feature_name: string
  },
) {
  return request.post(`/entries/templates/${templateId}/update`, data)
}

export function deleteEntryTemplate(templateId: string) {
  return request.post(`/entries/templates/${templateId}/delete`)
}

export function getEntryInstanceList() {
  return request.get('/entries')
}

export function createEntryInstance(data: {
  site_id: string
  site_name: string
  entry_type: string
  entry_code: string
}) {
  return request.post('/entries', data)
}

export function updateEntryInstance(
  entryId: string,
  data: {
    site_id: string
    site_name: string
    entry_type: string
    entry_code: string
    current_feature_name?: string
  },
) {
  return request.post(`/entries/${entryId}/update`, data)
}

export function disableEntryInstance(entryId: string) {
  return request.post(`/entries/${entryId}/disable`)
}

export function getQrAssetList() {
  return request.get('/entries/qrs')
}

export function getRouteList() {
  return request.get('/routes')
}

export function getRouteLogs() {
  return request.get('/routes/logs')
}

export function createRoute(data: {
  rule_name: string
  site_id: string
  entry_type: string
  feature_name: string
  priority?: string | number
}) {
  return request.post('/routes', data)
}

export function updateRoute(
  routeRuleId: string,
  data: {
    rule_name: string
    site_id: string
    entry_type: string
    feature_name: string
    priority?: string | number
  },
) {
  return request.put(`/routes/${routeRuleId}`, data)
}

export function enableRoute(routeRuleId: string) {
  return request.post(`/routes/${routeRuleId}/enable`)
}

export function disableRoute(routeRuleId: string) {
  return request.post(`/routes/${routeRuleId}/disable`)
}

export function testRouteMatch(data: {
  site_id?: string
  entry_type?: string
  entry_code?: string
  referrer_type?: string
  referrer_id?: string
}) {
  return request.post('/routes/test-match', data)
}

// ── 阶段三：用户端真实资料接口 ─────────────────────────────────────────────

export function getUserProfile(params?: { user_id?: string; line_user_id?: string }) {
  return request.get('/user/profile', { params })
}

export function getUserPrizes(params?: {
  user_id?: string
  line_user_id?: string
  page?: number
  page_size?: number
}) {
  return request.get('/user/prizes', { params })
}

export function getUserBenefits(params?: {
  user_id?: string
  line_user_id?: string
  status?: 'available' | 'used' | 'expired'
  page?: number
  page_size?: number
}) {
  return request.get('/user/benefits', { params })
}

export function getUserOrders(params?: {
  user_id?: string
  line_user_id?: string
  page?: number
  page_size?: number
}) {
  return request.get('/user/orders', { params })
}

export function getActivities(params?: { status?: string; activity_type?: string }) {
  return request.get('/activities', { params })
}

export function createActivity(data: Record<string, unknown>) {
  return request.post('/activities', data)
}

export function updateActivity(id: string, data: Record<string, unknown>) {
  return request.put(`/activities/${id}`, data)
}
