import React, { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Tag, Alert, Switch, Button, Form, Input,
  Table, Modal, Select, Tabs, Spin, message, Popconfirm, Row, Col, InputNumber
} from 'antd'
import {
  RobotOutlined, EditOutlined, PlusOutlined, DeleteOutlined,
  SaveOutlined, WarningOutlined, CodeOutlined, BarChartOutlined,
  BellOutlined, FileTextOutlined, BulbOutlined, ReloadOutlined
} from '@ant-design/icons'
import {
  getAgentsList, updateAgent, toggleAgent,
  getAgentKeywords, saveAgentKeywords,
  getKpiMetrics, createKpiMetric, updateKpiMetric, deleteKpiMetric,
  getReportTemplates, createReportTemplate, updateReportTemplate, deleteReportTemplate,
  getAlertRules, createAlertRule, updateAlertRule, deleteAlertRule,
  getActionSuggestions, createActionSuggestion, updateActionSuggestion, deleteActionSuggestion
} from '../../api/agent-admin'
import { useI18n } from '../../i18n'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const AGENT_CODE = 'digital_business_manager'
const LANGUAGES = [
  { key: 'zh', label: '中文' },
  { key: 'th', label: 'ไทย' },
  { key: 'en', label: 'English' },
]

const KEYWORD_FIELDS = [
  { key: 'identity_keywords', label: '身份定位词', placeholder: '你是...（核心角色与定位）' },
  { key: 'responsibility_keywords', label: '职责范围词', placeholder: '负责...（主要职责列表）' },
  { key: 'execution_keywords', label: '执行原则词', placeholder: '先...再...（执行优先级）' },
  { key: 'boundary_keywords', label: '边界约束词', placeholder: '不擅自...（行为边界）' },
  { key: 'output_keywords', label: '输出格式词', placeholder: '输出必须包含...（格式要求）' },
  { key: 'forbidden_keywords', label: '禁止行为词', placeholder: '禁止...（明确禁止项）' },
]

const DEPARTMENTS = [
  { value: 'business', label: '商务部' },
  { value: 'marketing', label: '推广部' },
  { value: 'operations', label: '运营部' },
  { value: 'all', label: '全部' },
]

const PERIOD_TYPES = [
  { value: 'daily', label: '日' },
  { value: 'weekly', label: '周' },
  { value: 'monthly', label: '月' },
]

const RISK_LEVELS = [
  { value: 'low', label: '低风险' },
  { value: 'medium', label: '中风险' },
  { value: 'high', label: '高风险' },
]

const REPORT_TYPES = [
  { value: 'daily', label: '日报' },
  { value: 'weekly', label: '周报' },
  { value: 'monthly', label: '月报' },
  { value: 'activity_review', label: '活动复盘' },
  { value: 'channel_review', label: '渠道复盘' },
  { value: 'site_review', label: '站点复盘' },
]

const riskColor: Record<string, string> = { low: 'green', medium: 'orange', high: 'red' }

export default function AgentBizPage() {
  const { t } = useI18n()
  const [deptTab, setDeptTab] = useState('business')

  // ── 基础信息 ────────────────────────────────────────────────────────────────
  const [agentInfo, setAgentInfo] = useState<any>(null)
  const [agentLoading, setAgentLoading] = useState(true)
  const [agentSaving, setAgentSaving] = useState(false)
  const [agentForm] = Form.useForm()

  const loadAgent = useCallback(async () => {
    setAgentLoading(true)
    try {
      const res = await getAgentsList()
      const agent = (res.data?.data || []).find((a: any) => a.agent_code === AGENT_CODE)
      setAgentInfo(agent)
      if (agent) {
        agentForm.setFieldsValue({
          name_zh: agent.agent_name?.zh || '',
          name_th: agent.agent_name?.th || '',
          name_en: agent.agent_name?.en || '',
          role_summary_zh: agent.role_summary?.zh || '',
          role_summary_th: agent.role_summary?.th || '',
          role_summary_en: agent.role_summary?.en || '',
        })
      }
    } catch { message.error('加载 Agent 基础信息失败') }
    setAgentLoading(false)
  }, [agentForm])

  const saveAgent = async () => {
    const vals = agentForm.getFieldsValue()
    setAgentSaving(true)
    try {
      await updateAgent(AGENT_CODE, {
        agent_name: { zh: vals.name_zh, th: vals.name_th, en: vals.name_en },
        role_summary: { zh: vals.role_summary_zh, th: vals.role_summary_th, en: vals.role_summary_en },
      })
      message.success('基础信息已保存')
      loadAgent()
    } catch { message.error('保存失败') }
    setAgentSaving(false)
  }

  const handleToggle = async (checked: boolean) => {
    try {
      await toggleAgent(AGENT_CODE, checked)
      message.success(checked ? 'Agent 已启用' : 'Agent 已关闭')
      loadAgent()
    } catch { message.error('操作失败') }
  }

  // ── 角色关键词 ──────────────────────────────────────────────────────────────
  const [kwLang, setKwLang] = useState('zh')
  const [kwLoading, setKwLoading] = useState(false)
  const [kwSaving, setKwSaving] = useState(false)
  const [kwForm] = Form.useForm()

  const loadKeywords = useCallback(async (lang: string) => {
    setKwLoading(true)
    try {
      const res = await getAgentKeywords({ agent_code: AGENT_CODE, language: lang })
      const record = (res.data?.data || []).find((k: any) => k.language === lang)
      if (record) {
        const patch: any = {}
        KEYWORD_FIELDS.forEach(f => { patch[f.key] = record[f.key] || '' })
        kwForm.setFieldsValue(patch)
      } else {
        kwForm.resetFields()
      }
    } catch { message.error('加载关键词失败') }
    setKwLoading(false)
  }, [kwForm])

  const saveKeywords = async () => {
    const vals = kwForm.getFieldsValue()
    setKwSaving(true)
    try {
      await saveAgentKeywords({ agent_code: AGENT_CODE, language: kwLang, ...vals })
      message.success(`${kwLang} 关键词已保存`)
    } catch { message.error('保存关键词失败') }
    setKwSaving(false)
  }

  const switchKwLang = (lang: string) => {
    setKwLang(lang)
    loadKeywords(lang)
  }

  // ── KPI 指标 ──────────────────────────────────────────────────────────────
  const [kpis, setKpis] = useState<any[]>([])
  const [kpisLoading, setKpisLoading] = useState(false)
  const [kpiModal, setKpiModal] = useState<any>(null)
  const [kpiModalMode, setKpiModalMode] = useState<'create' | 'edit'>('create')
  const [kpiForm] = Form.useForm()

  const loadKpis = useCallback(async () => {
    setKpisLoading(true)
    try {
      const res = await getKpiMetrics()
      setKpis(res.data?.data || [])
    } catch { message.error('加载 KPI 指标失败') }
    setKpisLoading(false)
  }, [])

  const openKpiCreate = () => {
    setKpiModalMode('create')
    setKpiModal({})
    kpiForm.resetFields()
    kpiForm.setFieldsValue({ department: deptTab, is_enabled: true })
  }

  const openKpiEdit = (item: any) => {
    setKpiModalMode('edit')
    setKpiModal(item)
    kpiForm.setFieldsValue({ ...item })
  }

  const saveKpi = async () => {
    const vals = kpiForm.getFieldsValue()
    try {
      if (kpiModalMode === 'create') {
        await createKpiMetric(vals)
        message.success('KPI 指标已创建')
      } else {
        await updateKpiMetric(kpiModal.id, vals)
        message.success('KPI 指标已更新')
      }
      setKpiModal(null)
      loadKpis()
    } catch { message.error('保存失败') }
  }

  const deleteKpi = async (id: number) => {
    try {
      await deleteKpiMetric(id)
      message.success('已删除')
      loadKpis()
    } catch { message.error('删除失败') }
  }

  const toggleKpi = async (item: any, checked: boolean) => {
    try {
      await updateKpiMetric(item.id, { is_enabled: checked })
      message.success(checked ? '已启用' : '已禁用')
      loadKpis()
    } catch { message.error('操作失败') }
  }

  // ── 报表模板 ──────────────────────────────────────────────────────────────
  const [reports, setReports] = useState<any[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportModal, setReportModal] = useState<any>(null)
  const [reportModalMode, setReportModalMode] = useState<'create' | 'edit'>('create')
  const [reportForm] = Form.useForm()

  const loadReports = useCallback(async () => {
    setReportsLoading(true)
    try {
      const res = await getReportTemplates()
      setReports(res.data?.data || [])
    } catch { message.error('加载报表模板失败') }
    setReportsLoading(false)
  }, [])

  const openReportCreate = () => {
    setReportModalMode('create')
    setReportModal({})
    reportForm.resetFields()
    reportForm.setFieldsValue({ department: deptTab, is_enabled: true, metric_codes: [] })
  }

  const openReportEdit = (item: any) => {
    setReportModalMode('edit')
    setReportModal(item)
    reportForm.setFieldsValue({
      ...item,
      metric_codes: (item.metric_codes || []).join(', '),
      table_schema: typeof item.table_schema === 'string' ? item.table_schema : JSON.stringify(item.table_schema, null, 2),
    })
  }

  const saveReport = async () => {
    const vals = reportForm.getFieldsValue()
    let metricCodes = vals.metric_codes
    if (typeof metricCodes === 'string') {
      metricCodes = metricCodes.split(',').map((s: string) => s.trim()).filter(Boolean)
    }
    try {
      const data = { ...vals, metric_codes: metricCodes }
      if (reportModalMode === 'create') {
        await createReportTemplate(data)
        message.success('报表模板已创建')
      } else {
        await updateReportTemplate(reportModal.id, data)
        message.success('报表模板已更新')
      }
      setReportModal(null)
      loadReports()
    } catch { message.error('保存失败') }
  }

  const deleteReport = async (id: number) => {
    try {
      await deleteReportTemplate(id)
      message.success('已删除')
      loadReports()
    } catch { message.error('删除失败') }
  }

  const toggleReport = async (item: any, checked: boolean) => {
    try {
      await updateReportTemplate(item.id, { is_enabled: checked })
      message.success(checked ? '已启用' : '已禁用')
      loadReports()
    } catch { message.error('操作失败') }
  }

  // ── 预警规则 ──────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<any[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertModal, setAlertModal] = useState<any>(null)
  const [alertModalMode, setAlertModalMode] = useState<'create' | 'edit'>('create')
  const [alertForm] = Form.useForm()

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true)
    try {
      const res = await getAlertRules()
      setAlerts(res.data?.data || [])
    } catch { message.error('加载预警规则失败') }
    setAlertsLoading(false)
  }, [])

  const openAlertCreate = () => {
    setAlertModalMode('create')
    setAlertModal({})
    alertForm.resetFields()
    alertForm.setFieldsValue({ risk_level: 'medium', is_enabled: true })
  }

  const openAlertEdit = (item: any) => {
    setAlertModalMode('edit')
    setAlertModal(item)
    alertForm.setFieldsValue({ ...item })
  }

  const saveAlert = async () => {
    const vals = alertForm.getFieldsValue()
    try {
      if (alertModalMode === 'create') {
        await createAlertRule(vals)
        message.success('预警规则已创建')
      } else {
        await updateAlertRule(alertModal.id, vals)
        message.success('预警规则已更新')
      }
      setAlertModal(null)
      loadAlerts()
    } catch { message.error('保存失败') }
  }

  const deleteAlert = async (id: number) => {
    try {
      await deleteAlertRule(id)
      message.success('已删除')
      loadAlerts()
    } catch { message.error('删除失败') }
  }

  const toggleAlert = async (item: any, checked: boolean) => {
    try {
      await updateAlertRule(item.id, { is_enabled: checked })
      message.success(checked ? '已启用' : '已禁用')
      loadAlerts()
    } catch { message.error('操作失败') }
  }

  // ── 动作建议模板 ──────────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionModal, setSuggestionModal] = useState<any>(null)
  const [suggestionModalMode, setSuggestionModalMode] = useState<'create' | 'edit'>('create')
  const [suggestionForm] = Form.useForm()

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true)
    try {
      const res = await getActionSuggestions()
      setSuggestions(res.data?.data || [])
    } catch { message.error('加载动作建议失败') }
    setSuggestionsLoading(false)
  }, [])

  const openSuggestionCreate = () => {
    setSuggestionModalMode('create')
    setSuggestionModal({})
    suggestionForm.resetFields()
    suggestionForm.setFieldsValue({ department: deptTab, is_enabled: true })
  }

  const openSuggestionEdit = (item: any) => {
    setSuggestionModalMode('edit')
    setSuggestionModal(item)
    suggestionForm.setFieldsValue({ ...item })
  }

  const saveSuggestion = async () => {
    const vals = suggestionForm.getFieldsValue()
    try {
      if (suggestionModalMode === 'create') {
        await createActionSuggestion(vals)
        message.success('已创建')
      } else {
        await updateActionSuggestion(suggestionModal.id, vals)
        message.success('已更新')
      }
      setSuggestionModal(null)
      loadSuggestions()
    } catch { message.error('保存失败') }
  }

  const deleteSuggestion = async (id: number) => {
    try {
      await deleteActionSuggestion(id)
      message.success('已删除')
      loadSuggestions()
    } catch { message.error('删除失败') }
  }

  // ── 初始化 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAgent()
    loadKeywords('zh')
    loadKpis()
    loadReports()
    loadAlerts()
    loadSuggestions()
  }, [loadAgent, loadKeywords, loadKpis, loadReports, loadAlerts, loadSuggestions])

  const filteredKpis = kpis.filter(k => k.department === deptTab)
  const filteredReports = reports.filter(r => r.department === deptTab || r.department === 'all')
  const filteredSuggestions = suggestions.filter(s => s.department === deptTab)

  const deptLabel = DEPARTMENTS.find(d => d.value === deptTab)?.label || deptTab

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">

      {/* 顶部身份卡片 */}
      <Card>
        <Space align="start" style={{ width: '100%' }}>
          <RobotOutlined style={{ fontSize: 32, color: '#722ed1', marginTop: 4 }} />
          <div style={{ flex: 1 }}>
            <Space align="center">
              <Title level={4} style={{ margin: 0 }}>
                数字经营管理助手
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>
                  {agentInfo?.agent_name?.th} / {agentInfo?.agent_name?.en}
                </Text>
              </Title>
              <Tag color="purple">digital_business_manager</Tag>
              {agentInfo && (
                <Switch
                  checked={agentInfo.is_enabled}
                  onChange={handleToggle}
                  checkedChildren="启用"
                  unCheckedChildren="停用"
                />
              )}
            </Space>
            <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
              {agentInfo?.role_summary?.zh || '三部门经营报表、KPI 分析、复盘与预警'}
            </Paragraph>
          </div>
        </Space>
      </Card>

      {/* 1. 基础信息 */}
      <Card
        title={<Space><EditOutlined />基础信息配置</Space>}
        extra={<Button type="primary" icon={<SaveOutlined />} loading={agentSaving} onClick={saveAgent}>保存</Button>}
      >
        {agentLoading ? <Spin /> : (
          <Form form={agentForm} layout="vertical">
            <Row gutter={16}>
              <Col span={8}><Form.Item label="显示名称（中文）" name="name_zh"><Input /></Form.Item></Col>
              <Col span={8}><Form.Item label="显示名称（泰文）" name="name_th"><Input /></Form.Item></Col>
              <Col span={8}><Form.Item label="显示名称（英文）" name="name_en"><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}><Form.Item label="角色摘要（中文）" name="role_summary_zh"><TextArea rows={2} /></Form.Item></Col>
              <Col span={8}><Form.Item label="角色摘要（泰文）" name="role_summary_th"><TextArea rows={2} /></Form.Item></Col>
              <Col span={8}><Form.Item label="角色摘要（英文）" name="role_summary_en"><TextArea rows={2} /></Form.Item></Col>
            </Row>
          </Form>
        )}
      </Card>

      {/* 2. 角色关键词 */}
      <Card
        title={<Space><CodeOutlined />角色关键词配置（Role Keywords）</Space>}
        extra={
          <Space>
            {LANGUAGES.map(l => (
              <Button key={l.key} type={kwLang === l.key ? 'primary' : 'default'} size="small" onClick={() => switchKwLang(l.key)}>
                {l.label}
              </Button>
            ))}
            <Button type="primary" icon={<SaveOutlined />} loading={kwSaving} onClick={saveKeywords}>保存</Button>
          </Space>
        }
      >
        <Alert type="info" showIcon
          message="关键词约束 Agent 出表行为与分析边界，确保 KPI 口径严格遵守已确认文档。"
          style={{ marginBottom: 16 }} />
        {kwLoading ? <Spin /> : (
          <Form form={kwForm} layout="vertical">
            <Row gutter={16}>
              {KEYWORD_FIELDS.map(f => (
                <Col span={12} key={f.key}>
                  <Form.Item label={f.label} name={f.key}>
                    <TextArea rows={3} placeholder={f.placeholder} />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Form>
        )}
      </Card>

      {/* 部门 Tab 切换 */}
      <Card bodyStyle={{ paddingBottom: 0, paddingTop: 0 }}>
        <Tabs
          activeKey={deptTab}
          onChange={setDeptTab}
          items={DEPARTMENTS.filter(d => d.value !== 'all').map(d => ({ key: d.value, label: d.label }))}
        />
      </Card>

      {/* 3. KPI 指标 */}
      <Card
        title={<Space><BarChartOutlined />KPI 指标配置 — {deptLabel}</Space>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openKpiCreate}>新增指标</Button>}
      >
        <Table
          loading={kpisLoading}
          dataSource={filteredKpis}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '指标名称', dataIndex: 'metric_name', width: 150 },
            { title: 'Metric Code', dataIndex: 'metric_code', width: 180,
              render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
            { title: '目标值', dataIndex: 'target_value', width: 80 },
            { title: '单位', dataIndex: 'unit', width: 60 },
            { title: '周期', dataIndex: 'period_type', width: 60,
              render: (v: string) => PERIOD_TYPES.find(p => p.value === v)?.label || v },
            { title: '描述', dataIndex: 'description', ellipsis: true },
            { title: '状态', dataIndex: 'is_enabled', width: 80,
              render: (v: boolean, r: any) => <Switch checked={v} size="small" onChange={c => toggleKpi(r, c)} /> },
            { title: '操作', width: 100,
              render: (_: any, r: any) => (
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openKpiEdit(r)}>编辑</Button>
                  <Popconfirm title="确认删除？" onConfirm={() => deleteKpi(r.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              ) },
          ]}
        />
      </Card>

      {/* 4. 报表模板 */}
      <Card
        title={<Space><FileTextOutlined />报表模板 — {deptLabel}</Space>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openReportCreate}>新增模板</Button>}
      >
        <Table
          loading={reportsLoading}
          dataSource={filteredReports}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '模板名称', dataIndex: 'template_name', width: 160 },
            { title: '类型', dataIndex: 'template_type', width: 100,
              render: (v: string) => <Tag>{REPORT_TYPES.find(r => r.value === v)?.label || v}</Tag> },
            { title: '部门', dataIndex: 'department', width: 80,
              render: (v: string) => DEPARTMENTS.find(d => d.value === v)?.label || v },
            { title: '状态', dataIndex: 'is_enabled', width: 80,
              render: (v: boolean, r: any) => <Switch checked={v} size="small" onChange={c => toggleReport(r, c)} /> },
            { title: '操作', width: 100,
              render: (_: any, r: any) => (
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openReportEdit(r)}>编辑</Button>
                  <Popconfirm title="确认删除？" onConfirm={() => deleteReport(r.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              ) },
          ]}
        />
      </Card>

      {/* 5. 预警规则 */}
      <Card
        title={<Space><BellOutlined />预警规则配置</Space>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAlertCreate}>新增规则</Button>}
      >
        <Table
          loading={alertsLoading}
          dataSource={alerts}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '触发指标', dataIndex: 'metric_code', width: 180,
              render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
            { title: '告警条件', dataIndex: 'alert_condition', width: 160,
              render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
            { title: '风险等级', dataIndex: 'risk_level', width: 80,
              render: (v: string) => <Tag color={riskColor[v]}>{RISK_LEVELS.find(r => r.value === v)?.label}</Tag> },
            { title: '告警文本', dataIndex: 'alert_text', ellipsis: true },
            { title: '状态', dataIndex: 'is_enabled', width: 80,
              render: (v: boolean, r: any) => <Switch checked={v} size="small" onChange={c => toggleAlert(r, c)} /> },
            { title: '操作', width: 100,
              render: (_: any, r: any) => (
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openAlertEdit(r)}>编辑</Button>
                  <Popconfirm title="确认删除？" onConfirm={() => deleteAlert(r.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              ) },
          ]}
        />
      </Card>

      {/* 6. 动作建议模板 */}
      <Card
        title={<Space><BulbOutlined />动作建议模板 — {deptLabel}</Space>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openSuggestionCreate}>新增建议</Button>}
      >
        <Table
          loading={suggestionsLoading}
          dataSource={filteredSuggestions}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '部门', dataIndex: 'department', width: 80,
              render: (v: string) => DEPARTMENTS.find(d => d.value === v)?.label || v },
            { title: '适用场景', dataIndex: 'applicable_scene', width: 160,
              render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
            { title: '建议内容（摘要）', dataIndex: 'suggestion_content', ellipsis: true,
              render: (v: string) => <Text style={{ fontSize: 12 }}>{v?.substring(0, 60)}...</Text> },
            { title: '操作', width: 100,
              render: (_: any, r: any) => (
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openSuggestionEdit(r)}>编辑</Button>
                  <Popconfirm title="确认删除？" onConfirm={() => deleteSuggestion(r.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              ) },
          ]}
        />
      </Card>

      {/* KPI Modal */}
      <Modal title={kpiModalMode === 'create' ? `新增 KPI 指标 — ${deptLabel}` : '编辑 KPI 指标'}
        open={kpiModal !== null} onCancel={() => setKpiModal(null)} onOk={saveKpi} okText="保存" width={560}>
        <Form form={kpiForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="指标名称" name="metric_name" rules={[{ required: true }]}><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Metric Code" name="metric_code" rules={[{ required: true }]}><Input placeholder="new_device_count" /></Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="部门" name="department">
                <Select options={DEPARTMENTS.filter(d => d.value !== 'all')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="目标值" name="target_value">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="单位" name="unit"><Input placeholder="台" /></Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="周期" name="period_type">
                <Select options={PERIOD_TYPES} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="描述" name="description"><Input /></Form.Item>
          <Form.Item label="启用" name="is_enabled" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      {/* 报表模板 Modal */}
      <Modal title={reportModalMode === 'create' ? '新增报表模板' : '编辑报表模板'}
        open={reportModal !== null} onCancel={() => setReportModal(null)} onOk={saveReport} okText="保存" width={600}>
        <Form form={reportForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="模板名称" name="template_name" rules={[{ required: true }]}><Input /></Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="类型" name="template_type" rules={[{ required: true }]}>
                <Select options={REPORT_TYPES} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="部门" name="department">
                <Select options={DEPARTMENTS} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="关联指标（metric_code，逗号分隔）" name="metric_codes">
            <Input placeholder="new_device_count, new_site_count" />
          </Form.Item>
          <Form.Item label="表格字段定义（JSON Schema）" name="table_schema">
            <TextArea rows={4} style={{ fontFamily: 'monospace', fontSize: 12 }}
              placeholder={'{"columns":["指标","目标值","实际值","完成率","是否达标","异常说明"]}'} />
          </Form.Item>
          <Form.Item label="启用" name="is_enabled" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      {/* 预警规则 Modal */}
      <Modal title={alertModalMode === 'create' ? '新增预警规则' : '编辑预警规则'}
        open={alertModal !== null} onCancel={() => setAlertModal(null)} onOk={saveAlert} okText="保存" width={560}>
        <Form form={alertForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="触发指标 metric_code" name="metric_code" rules={[{ required: true }]}>
                <Select showSearch options={kpis.map(k => ({ value: k.metric_code, label: `${k.metric_code} - ${k.metric_name}` }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="告警条件表达式" name="alert_condition">
                <Input placeholder="cpf > 10" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="风险等级" name="risk_level">
            <Select options={RISK_LEVELS} />
          </Form.Item>
          <Form.Item label="告警文本" name="alert_text">
            <TextArea rows={3} placeholder="请填写告警提示文案..." />
          </Form.Item>
          <Form.Item label="启用" name="is_enabled" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      {/* 动作建议 Modal */}
      <Modal title={suggestionModalMode === 'create' ? '新增动作建议' : '编辑动作建议'}
        open={suggestionModal !== null} onCancel={() => setSuggestionModal(null)} onOk={saveSuggestion} okText="保存" width={560}>
        <Form form={suggestionForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="部门" name="department" rules={[{ required: true }]}>
                <Select options={DEPARTMENTS.filter(d => d.value !== 'all')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="适用场景代码" name="applicable_scene" rules={[{ required: true }]}>
                <Input placeholder="cpf_over_limit" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="建议内容（每条换行）" name="suggestion_content">
            <TextArea rows={6} placeholder="1. 立即暂停...\n2. 分析...\n3. 优化..." />
          </Form.Item>
          <Form.Item label="启用" name="is_enabled" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
