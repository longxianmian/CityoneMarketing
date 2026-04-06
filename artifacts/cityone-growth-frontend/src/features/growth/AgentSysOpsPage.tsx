import React, { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Tag, Alert, Switch, Button, Form, Input,
  Table, Modal, Select, Tabs, Spin, message, Badge, Popconfirm, Row, Col
} from 'antd'
import {
  RobotOutlined, EditOutlined, PlusOutlined, DeleteOutlined,
  SaveOutlined, WarningOutlined, CodeOutlined, ToolOutlined,
  BugOutlined, ReloadOutlined
} from '@ant-design/icons'
import {
  getAgentsList, updateAgent, toggleAgent,
  getAgentKeywords, saveAgentKeywords,
  getIssueTypes, createIssueType, updateIssueType, deleteIssueType,
  getRepairActions, createRepairAction, updateRepairAction, deleteRepairAction,
  getReportTemplates
} from '../../api/agent-admin'
import { useI18n } from '../../i18n'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const AGENT_CODE = 'digital_ops_engineer'
const LANGUAGES = [
  { key: 'zh', label: '中文' },
  { key: 'th', label: 'ไทย' },
  { key: 'en', label: 'English' },
]

const KEYWORD_FIELDS = [
  { key: 'identity_keywords', label: '身份定位词', placeholder: '你是...（核心角色与定位）' },
  { key: 'responsibility_keywords', label: '职责范围词', placeholder: '负责...（主要职责列表）' },
  { key: 'execution_keywords', label: '执行原则词', placeholder: '先...再...（执行优先级）' },
  { key: 'boundary_keywords', label: '边界约束词', placeholder: '不允许...（行为边界）' },
  { key: 'output_keywords', label: '输出格式词', placeholder: '输出必须包含...（格式要求）' },
  { key: 'forbidden_keywords', label: '禁止行为词', placeholder: '禁止...（明确禁止项）' },
]

const RISK_LEVELS = [
  { value: 'low', label: '低风险' },
  { value: 'medium', label: '中风险' },
  { value: 'high', label: '⚠️ 高风险' },
]
const riskColor: Record<string, string> = { low: 'green', medium: 'orange', high: 'red' }

export default function AgentSysOpsPage() {
  const { t } = useI18n()

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

  // ── 故障类型字典 ──────────────────────────────────────────────────────────
  const [issues, setIssues] = useState<any[]>([])
  const [issuesLoading, setIssuesLoading] = useState(false)
  const [issueModal, setIssueModal] = useState<any>(null)
  const [issueModalMode, setIssueModalMode] = useState<'create' | 'edit'>('create')
  const [issueForm] = Form.useForm()

  const loadIssues = useCallback(async () => {
    setIssuesLoading(true)
    try {
      const res = await getIssueTypes()
      setIssues(res.data?.data || [])
    } catch { message.error('加载故障类型失败') }
    setIssuesLoading(false)
  }, [])

  const openIssueCreate = () => {
    setIssueModalMode('create')
    setIssueModal({})
    issueForm.resetFields()
  }

  const openIssueEdit = (item: any) => {
    setIssueModalMode('edit')
    setIssueModal(item)
    issueForm.setFieldsValue({ ...item })
  }

  const saveIssue = async () => {
    const vals = issueForm.getFieldsValue()
    try {
      if (issueModalMode === 'create') {
        await createIssueType(vals)
        message.success('已创建')
      } else {
        await updateIssueType(issueModal.id, vals)
        message.success('已更新')
      }
      setIssueModal(null)
      loadIssues()
    } catch { message.error('保存失败') }
  }

  const deleteIssue = async (id: number) => {
    try {
      await deleteIssueType(id)
      message.success('已删除')
      loadIssues()
    } catch { message.error('删除失败') }
  }

  const toggleIssue = async (item: any, checked: boolean) => {
    try {
      await updateIssueType(item.id, { is_enabled: checked })
      message.success(checked ? '已启用' : '已禁用')
      loadIssues()
    } catch { message.error('操作失败') }
  }

  // ── 修复动作字典 ──────────────────────────────────────────────────────────
  const [repairs, setRepairs] = useState<any[]>([])
  const [repairsLoading, setRepairsLoading] = useState(false)
  const [repairModal, setRepairModal] = useState<any>(null)
  const [repairModalMode, setRepairModalMode] = useState<'create' | 'edit'>('create')
  const [repairForm] = Form.useForm()

  const loadRepairs = useCallback(async () => {
    setRepairsLoading(true)
    try {
      const res = await getRepairActions()
      setRepairs(res.data?.data || [])
    } catch { message.error('加载修复动作失败') }
    setRepairsLoading(false)
  }, [])

  const openRepairCreate = () => {
    setRepairModalMode('create')
    setRepairModal({})
    repairForm.resetFields()
  }

  const openRepairEdit = (item: any) => {
    setRepairModalMode('edit')
    setRepairModal(item)
    repairForm.setFieldsValue({ ...item })
  }

  const saveRepair = async () => {
    const vals = repairForm.getFieldsValue()
    try {
      if (repairModalMode === 'create') {
        await createRepairAction(vals)
        message.success('已创建')
      } else {
        await updateRepairAction(repairModal.id, vals)
        message.success('已更新')
      }
      setRepairModal(null)
      loadRepairs()
    } catch { message.error('保存失败') }
  }

  const deleteRepair = async (id: number) => {
    try {
      await deleteRepairAction(id)
      message.success('已删除')
      loadRepairs()
    } catch { message.error('删除失败') }
  }

  const toggleRepair = async (item: any, checked: boolean) => {
    try {
      await updateRepairAction(item.id, { is_enabled: checked })
      message.success(checked ? '已启用' : '已禁用')
      loadRepairs()
    } catch { message.error('操作失败') }
  }

  // ── 初始化 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAgent()
    loadKeywords('zh')
    loadIssues()
    loadRepairs()
  }, [loadAgent, loadKeywords, loadIssues, loadRepairs])

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">

      {/* 顶部身份卡片 */}
      <Card>
        <Space align="start" style={{ width: '100%' }}>
          <RobotOutlined style={{ fontSize: 32, color: '#fa8c16', marginTop: 4 }} />
          <div style={{ flex: 1 }}>
            <Space align="center">
              <Title level={4} style={{ margin: 0 }}>
                数字运维工程师
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>
                  {agentInfo?.agent_name?.th} / {agentInfo?.agent_name?.en}
                </Text>
              </Title>
              <Tag color="orange">digital_ops_engineer</Tag>
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
              {agentInfo?.role_summary?.zh || '生产级系统运维、诊断、修复、上报'}
            </Paragraph>
          </div>
        </Space>
      </Card>

      <Alert
        type="error"
        showIcon
        icon={<WarningOutlined />}
        message="⚠️ 安全提示：此 Agent 具有生产修复权限，高风险操作需超级管理员授权后方可执行。修改配置前请充分评估影响范围。"
      />

      {/* 1. 基础信息 */}
      <Card
        title={<Space><EditOutlined />基础信息配置</Space>}
        extra={<Button type="primary" icon={<SaveOutlined />} loading={agentSaving} onClick={saveAgent}>保存基础信息</Button>}
      >
        {agentLoading ? <Spin /> : (
          <Form form={agentForm} layout="vertical">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="显示名称（中文）" name="name_zh"><Input /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="显示名称（泰文）" name="name_th"><Input /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="显示名称（英文）" name="name_en"><Input /></Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="角色摘要（中文）" name="role_summary_zh"><TextArea rows={2} /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="角色摘要（泰文）" name="role_summary_th"><TextArea rows={2} /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="角色摘要（英文）" name="role_summary_en"><TextArea rows={2} /></Form.Item>
              </Col>
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
        <Alert type="warning" showIcon
          message="这些关键词将影响运维 Agent 的系统提示词。高风险边界词尤为重要，请确保禁止行为词完整准确。"
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

      {/* 3. 故障类型字典 */}
      <Card
        title={<Space><BugOutlined />故障类型字典（Issue Types）</Space>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openIssueCreate}>新增故障类型</Button>}
      >
        <Table
          loading={issuesLoading}
          dataSource={issues}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '故障名称', dataIndex: 'issue_name', width: 150,
              render: (v: string, r: any) => (
                <Space>{v}<Tag color={riskColor[r.risk_level]}>{RISK_LEVELS.find(x => x.value === r.risk_level)?.label}</Tag></Space>
              ) },
            { title: 'Issue Code', dataIndex: 'issue_code', width: 180,
              render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
            { title: '描述', dataIndex: 'description', ellipsis: true },
            { title: '自动修复', dataIndex: 'auto_repair_supported', width: 80,
              render: (v: boolean) => v ? <Tag color="green">支持</Tag> : <Tag color="default">不支持</Tag> },
            { title: '状态', dataIndex: 'is_enabled', width: 80,
              render: (v: boolean, r: any) => (
                <Switch checked={v} size="small" onChange={c => toggleIssue(r, c)} />
              ) },
            { title: '操作', width: 100,
              render: (_: any, r: any) => (
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openIssueEdit(r)}>编辑</Button>
                  <Popconfirm title="确认删除？" onConfirm={() => deleteIssue(r.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              ) },
          ]}
        />
      </Card>

      {/* 4. 修复动作字典 */}
      <Card
        title={<Space><ToolOutlined />修复动作字典（Repair Actions）</Space>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openRepairCreate}>新增修复动作</Button>}
      >
        <Alert type="info" showIcon
          message={<>标注 <Tag color="red">⚠️ 需授权</Tag> 的动作必须经超级管理员审批后才能执行，这是生产安全的核心防线。</>}
          style={{ marginBottom: 12 }} />
        <Table
          loading={repairsLoading}
          dataSource={repairs}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '动作名称', dataIndex: 'action_name', width: 160 },
            { title: 'Action Code', dataIndex: 'action_code', width: 200,
              render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
            { title: '对应故障', dataIndex: 'issue_code', width: 160,
              render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
            { title: '描述', dataIndex: 'description', ellipsis: true },
            { title: '可回滚', dataIndex: 'rollback_supported', width: 75,
              render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag color="default">否</Tag> },
            { title: '需授权', dataIndex: 'requires_approval', width: 75,
              render: (v: boolean) => v
                ? <Tag color="red" icon={<WarningOutlined />}>⚠️ 是</Tag>
                : <Tag color="default">否</Tag> },
            { title: '状态', dataIndex: 'is_enabled', width: 80,
              render: (v: boolean, r: any) => (
                <Switch checked={v} size="small" onChange={c => toggleRepair(r, c)} />
              ) },
            { title: '操作', width: 100,
              render: (_: any, r: any) => (
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openRepairEdit(r)}>编辑</Button>
                  <Popconfirm title="确认删除？" onConfirm={() => deleteRepair(r.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              ) },
          ]}
        />
      </Card>

      {/* 高风险操作授权流说明 */}
      <Card title={<Space><WarningOutlined style={{ color: '#f5222d' }} />高风险操作授权流（只读说明）</Space>}>
        <Alert
          type="error"
          showIcon
          message="以下情况必须触发超级管理员授权流程，Agent 不得绕过："
          description={
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li>修改动作涉及生产配置、权限模型、数据库结构等高风险变更</li>
              <li>修复动作被标注为 <Tag color="red">requires_approval = true</Tag></li>
              <li>风险等级评估为 <Tag color="red">high / critical</Tag></li>
              <li>变更影响范围超出单一模块</li>
            </ul>
          }
        />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">授权申请 Skill：</Text>
          <Text code>request_super_admin_authorization</Text>
          <br />
          <Text type="secondary">授权申请必须包含：问题摘要、风险等级、拟执行动作、影响范围</Text>
        </div>
      </Card>

      {/* 故障类型 Modal */}
      <Modal
        title={issueModalMode === 'create' ? '新增故障类型' : '编辑故障类型'}
        open={issueModal !== null}
        onCancel={() => setIssueModal(null)}
        onOk={saveIssue}
        okText="保存"
        width={520}
      >
        <Form form={issueForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="故障名称" name="issue_name" rules={[{ required: true }]}>
                <Input placeholder="Token 过期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Issue Code" name="issue_code" rules={[{ required: true }]}>
                <Input placeholder="token_expired" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="描述" name="description">
            <TextArea rows={2} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="风险等级" name="risk_level">
                <Select options={RISK_LEVELS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="支持自动修复" name="auto_repair_supported" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="启用" name="is_enabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 修复动作 Modal */}
      <Modal
        title={repairModalMode === 'create' ? '新增修复动作' : '编辑修复动作'}
        open={repairModal !== null}
        onCancel={() => setRepairModal(null)}
        onOk={saveRepair}
        okText="保存"
        width={560}
      >
        {repairModal?.requires_approval && (
          <Alert type="error" showIcon icon={<WarningOutlined />}
            message="⚠️ 此动作标注为需超管授权，修改时请确认安全边界"
            style={{ marginBottom: 12 }} />
        )}
        <Form form={repairForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="动作名称" name="action_name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Action Code" name="action_code" rules={[{ required: true }]}>
                <Input placeholder="clear_frontend_token" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="对应故障 Issue Code" name="issue_code">
            <Select options={issues.map(i => ({ value: i.issue_code, label: `${i.issue_code} - ${i.issue_name}` }))} />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={2} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="可回滚" name="rollback_supported" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="需超管授权" name="requires_approval" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="启用" name="is_enabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  )
}
