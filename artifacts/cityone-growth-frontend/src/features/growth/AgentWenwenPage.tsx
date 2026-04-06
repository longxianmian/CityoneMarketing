import React, { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Tag, Alert, Switch, Button, Form, Input,
  Table, Modal, Select, Tabs, Tooltip, Spin, message, Badge, Divider,
  Popconfirm, Row, Col, Collapse
} from 'antd'
import {
  RobotOutlined, EditOutlined, PlusOutlined, DeleteOutlined,
  SaveOutlined, WarningOutlined, CodeOutlined, FileTextOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined
} from '@ant-design/icons'
import {
  getAgentsList, updateAgent, toggleAgent,
  getAgentKeywords, saveAgentKeywords,
  getAgentSkills, updateAgentSkill,
  getCardTemplates, createCardTemplate, updateCardTemplate, deleteCardTemplate,
  getPolicyContents, savePolicyContent
} from '../../api/agent-admin'
import { getAgentIntents, updateAgentIntent } from '../../api/agent-admin'
import { useI18n } from '../../i18n'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const AGENT_CODE = 'wenwen'
const LANGUAGES = [
  { key: 'zh', label: '中文' },
  { key: 'th', label: 'ไทย' },
  { key: 'en', label: 'English' },
]


const KEYWORD_FIELDS = [
  { key: 'identity_keywords', label: '身份定位词', placeholder: '你是...（核心角色与定位）' },
  { key: 'responsibility_keywords', label: '职责范围词', placeholder: '负责...（主要职责列表）' },
  { key: 'execution_keywords', label: '执行原则词', placeholder: '先...再...（执行优先级）' },
  { key: 'boundary_keywords', label: '边界约束词', placeholder: '不处理...（行为边界）' },
  { key: 'output_keywords', label: '输出格式词', placeholder: '优先使用...输出...（格式要求）' },
  { key: 'forbidden_keywords', label: '禁止行为词', placeholder: '禁止...（明确禁止项）' },
]

const POLICY_TYPES = [
  { value: 'member_terms', label: '会员服务条款' },
  { value: 'points_rules', label: '积分规则' },
  { value: 'user_agreement', label: '用户协议' },
  { value: 'privacy_policy', label: '隐私政策' },
  { value: 'service_terms', label: '服务条款' },
]

function validateJson(str: string) {
  try { JSON.parse(str); return true; } catch { return false; }
}

export default function AgentWenwenPage() {
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
  const [kwData, setKwData] = useState<Record<string, any>>({})
  const [kwLoading, setKwLoading] = useState(false)
  const [kwSaving, setKwSaving] = useState(false)
  const [kwForm] = Form.useForm()

  const loadKeywords = useCallback(async (lang: string) => {
    setKwLoading(true)
    try {
      const res = await getAgentKeywords({ agent_code: AGENT_CODE, language: lang })
      const record = (res.data?.data || []).find((k: any) => k.language === lang)
      setKwData(prev => ({ ...prev, [lang]: record }))
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
      loadKeywords(kwLang)
    } catch { message.error('保存关键词失败') }
    setKwSaving(false)
  }

  const switchKwLang = (lang: string) => {
    setKwLang(lang)
    loadKeywords(lang)
  }

  // ── Skills ──────────────────────────────────────────────────────────────────
  const [skills, setSkills] = useState<any[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [skillEditModal, setSkillEditModal] = useState<any>(null)
  const [skillForm] = Form.useForm()
  const [schemaError, setSchemaError] = useState('')

  const loadSkills = useCallback(async () => {
    setSkillsLoading(true)
    try {
      const res = await getAgentSkills({ agent_code: AGENT_CODE })
      setSkills(res.data?.data || [])
    } catch { message.error('加载 Skill 失败') }
    setSkillsLoading(false)
  }, [])

  const openSkillEdit = (skill: any) => {
    setSkillEditModal(skill)
    skillForm.setFieldsValue({
      skill_name: skill.skill_name,
      skill_description: skill.skill_description,
      json_schema: skill.json_schema || '',
      risk_level: skill.risk_level || 'low',
      requires_approval: skill.requires_approval,
      requires_user_confirmation: skill.requires_user_confirmation,
    })
    setSchemaError('')
  }

  const saveSkill = async () => {
    const vals = skillForm.getFieldsValue()
    if (vals.json_schema && !validateJson(vals.json_schema)) {
      setSchemaError('JSON Schema 格式不合法，请修正后再保存')
      return
    }
    try {
      await updateAgentSkill(skillEditModal.id, vals)
      message.success('Skill 已保存')
      setSkillEditModal(null)
      loadSkills()
    } catch { message.error('保存 Skill 失败') }
  }

  const toggleSkill = async (skill: any, checked: boolean) => {
    try {
      await updateAgentSkill(skill.id, { is_enabled: checked })
      message.success(checked ? '已启用' : '已禁用')
      loadSkills()
    } catch { message.error('操作失败') }
  }

  // ── 卡片模板 ──────────────────────────────────────────────────────────────
  const [cards, setCards] = useState<any[]>([])
  const [cardsLoading, setCardsLoading] = useState(false)
  const [cardModal, setCardModal] = useState<any>(null)
  const [cardModalMode, setCardModalMode] = useState<'create' | 'edit'>('create')
  const [cardForm] = Form.useForm()

  const loadCards = useCallback(async () => {
    setCardsLoading(true)
    try {
      const res = await getCardTemplates()
      setCards(res.data?.data || [])
    } catch { message.error('加载卡片模板失败') }
    setCardsLoading(false)
  }, [])

  const openCardCreate = () => {
    setCardModalMode('create')
    setCardModal({})
    cardForm.resetFields()
  }

  const openCardEdit = (card: any) => {
    setCardModalMode('edit')
    setCardModal(card)
    cardForm.setFieldsValue({
      card_type: card.card_type,
      language: card.language,
      title: card.title,
      description: card.description,
      target_page: card.target_page,
      button_config: JSON.stringify(card.button_config || [], null, 2),
      payload_schema: card.payload_schema || '',
    })
  }

  const saveCard = async () => {
    try {
      const vals = cardForm.getFieldsValue()
      let buttonConfig = vals.button_config
      try { buttonConfig = JSON.parse(vals.button_config) } catch { message.error('按钮配置 JSON 格式错误'); return }
      const data = { ...vals, button_config: buttonConfig }
      if (cardModalMode === 'create') {
        await createCardTemplate(data)
        message.success('卡片模板已创建')
      } else {
        await updateCardTemplate(cardModal.id, data)
        message.success('卡片模板已更新')
      }
      setCardModal(null)
      loadCards()
    } catch { message.error('保存失败') }
  }

  const deleteCard = async (id: number) => {
    try {
      await deleteCardTemplate(id)
      message.success('已删除')
      loadCards()
    } catch { message.error('删除失败') }
  }

  // ── 协议内容 ──────────────────────────────────────────────────────────────
  const [policies, setPolicies] = useState<any[]>([])
  const [policiesLoading, setPoliciesLoading] = useState(false)
  const [policyModal, setPolicyModal] = useState<any>(null)
  const [policyForm] = Form.useForm()

  const loadPolicies = useCallback(async () => {
    setPoliciesLoading(true)
    try {
      const res = await getPolicyContents()
      setPolicies(res.data?.data || [])
    } catch { message.error('加载协议内容失败') }
    setPoliciesLoading(false)
  }, [])

  const openPolicyEdit = (policy: any) => {
    setPolicyModal(policy)
    policyForm.setFieldsValue({
      title: policy.title,
      content: policy.content,
      status: policy.status,
    })
  }

  const savePolicy = async () => {
    const vals = policyForm.getFieldsValue()
    try {
      await savePolicyContent({ ...policyModal, ...vals })
      message.success('协议内容已保存')
      setPolicyModal(null)
      loadPolicies()
    } catch { message.error('保存失败') }
  }

  // ── 初始化 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAgent()
    loadKeywords('zh')
    loadSkills()
    loadCards()
    loadPolicies()
  }, [loadAgent, loadKeywords, loadSkills, loadCards, loadPolicies])

  const riskColor: Record<string, string> = { low: 'green', medium: 'orange', high: 'red' }
  const riskLabel: Record<string, string> = { low: '低风险', medium: '中风险', high: '⚠️ 高风险' }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">

      {/* 顶部身份卡片 */}
      <Card>
        <Space align="start" style={{ width: '100%' }}>
          <RobotOutlined style={{ fontSize: 32, color: '#1677ff', marginTop: 4 }} />
          <div style={{ flex: 1 }}>
            <Space align="center">
              <Title level={4} style={{ margin: 0 }}>
                问问 Agent
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>
                  {agentInfo?.agent_name?.th} / {agentInfo?.agent_name?.en}
                </Text>
              </Title>
              <Tag color="blue">wenwen</Tag>
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
              {agentInfo?.role_summary?.zh || '用户咨询服务、卡片式任务助手、裂变引导与权益承接'}
            </Paragraph>
          </div>
        </Space>
      </Card>

      {/* 1. 基础信息编辑区 */}
      <Card
        title={<Space><EditOutlined />基础信息配置</Space>}
        extra={<Button type="primary" icon={<SaveOutlined />} loading={agentSaving} onClick={saveAgent}>保存基础信息</Button>}
      >
        {agentLoading ? <Spin /> : (
          <Form form={agentForm} layout="vertical">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="显示名称（中文）" name="name_zh">
                  <Input placeholder="问问" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="显示名称（泰文）" name="name_th">
                  <Input placeholder="ถามดู" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="显示名称（英文）" name="name_en">
                  <Input placeholder="Ask" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="角色摘要（中文）" name="role_summary_zh">
                  <TextArea rows={2} placeholder="角色摘要" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="角色摘要（泰文）" name="role_summary_th">
                  <TextArea rows={2} placeholder="คำอธิบาย" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="角色摘要（英文）" name="role_summary_en">
                  <TextArea rows={2} placeholder="Role summary" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        )}
      </Card>

      {/* 2. 角色关键词编辑区 */}
      <Card
        title={<Space><CodeOutlined />角色关键词配置（Role Keywords）</Space>}
        extra={
          <Space>
            {LANGUAGES.map(l => (
              <Button
                key={l.key}
                type={kwLang === l.key ? 'primary' : 'default'}
                size="small"
                onClick={() => switchKwLang(l.key)}
              >
                {l.label}
              </Button>
            ))}
            <Button type="primary" icon={<SaveOutlined />} loading={kwSaving} onClick={saveKeywords}>保存</Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          message="关键词将注入 Agent System Prompt，直接影响 AI 回答行为。修改前请确认语义准确。"
          style={{ marginBottom: 16 }}
        />
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

      {/* 3. Skill 列表区 */}
      <Card
        title={<Space><CheckCircleOutlined />Skill 配置列表</Space>}
        extra={<Button icon={<ReloadOutlined />} onClick={loadSkills}>刷新</Button>}
      >
        <Alert
          type="warning"
          showIcon
          message={<>标注 <Tag color="red">⚠️ 高风险</Tag> 的 Skill 会触发超级管理员授权流程，修改时请谨慎。</>}
          style={{ marginBottom: 12 }}
        />
        <Table
          loading={skillsLoading}
          dataSource={skills}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: 'Skill 名称', dataIndex: 'skill_name', width: 160,
              render: (v: string, r: any) => <Space>{v}<Tag color={riskColor[r.risk_level]}>{riskLabel[r.risk_level]}</Tag></Space> },
            { title: 'Skill Code', dataIndex: 'skill_code', width: 200, render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
            { title: '描述', dataIndex: 'skill_description', ellipsis: true },
            { title: '需授权', dataIndex: 'requires_approval', width: 70,
              render: (v: boolean) => v ? <Tag color="red">是</Tag> : <Tag color="default">否</Tag> },
            { title: '需确认', dataIndex: 'requires_user_confirmation', width: 70,
              render: (v: boolean) => v ? <Tag color="orange">是</Tag> : <Tag color="default">否</Tag> },
            { title: '状态', dataIndex: 'is_enabled', width: 80,
              render: (v: boolean, r: any) => (
                <Switch checked={v} size="small" onChange={c => toggleSkill(r, c)} />
              ) },
            { title: '操作', width: 80,
              render: (_: any, r: any) => (
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openSkillEdit(r)}>编辑</Button>
              ) },
          ]}
          expandable={{
            expandedRowRender: (r: any) => (
              <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                <Text strong>JSON Schema：</Text>
                <pre style={{ margin: '4px 0 0', fontSize: 12, overflowX: 'auto' }}>
                  {r.json_schema ? JSON.stringify(JSON.parse(r.json_schema), null, 2) : '(未配置)'}
                </pre>
              </div>
            ),
          }}
        />
      </Card>

      {/* 4. 卡片模板区 */}
      <Card
        title={<Space><FileTextOutlined />卡片模板配置（Card Templates）</Space>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCardCreate}>新增模板</Button>}
      >
        <Table
          loading={cardsLoading}
          dataSource={cards}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '类型', dataIndex: 'card_type', width: 150, render: (v: string) => <Text code>{v}</Text> },
            { title: '语言', dataIndex: 'language', width: 60, render: (v: string) => <Tag>{v}</Tag> },
            { title: '标题', dataIndex: 'title', width: 150 },
            { title: '描述', dataIndex: 'description', ellipsis: true },
            { title: '跳转页面', dataIndex: 'target_page', width: 140, render: (v: string) => <Text code style={{ fontSize: 11 }}>{v || '-'}</Text> },
            { title: '状态', dataIndex: 'is_enabled', width: 70,
              render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag> },
            { title: '操作', width: 100,
              render: (_: any, r: any) => (
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openCardEdit(r)}>编辑</Button>
                  <Popconfirm title="确认删除？" onConfirm={() => deleteCard(r.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              ) },
          ]}
        />
      </Card>

      {/* 5. 协议内容入口 */}
      <Card
        title={<Space><FileTextOutlined />协议内容配置（Policy Contents）</Space>}
      >
        <Table
          loading={policiesLoading}
          dataSource={policies}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '协议类型', dataIndex: 'policy_type', width: 150,
              render: (v: string) => POLICY_TYPES.find(p => p.value === v)?.label || v },
            { title: '语言', dataIndex: 'language', width: 60, render: (v: string) => <Tag>{v}</Tag> },
            { title: '标题', dataIndex: 'title', width: 160 },
            { title: '状态', dataIndex: 'status', width: 80,
              render: (v: string) => v === 'published' ? <Tag color="green">已发布</Tag> : <Tag color="orange">草稿</Tag> },
            { title: '更新时间', dataIndex: 'updated_at', width: 140,
              render: (v: string) => new Date(v).toLocaleDateString() },
            { title: '操作', width: 80,
              render: (_: any, r: any) => (
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openPolicyEdit(r)}>编辑</Button>
              ) },
          ]}
        />
      </Card>

      {/* Skill 编辑 Modal */}
      <Modal
        title={<Space><EditOutlined />编辑 Skill：{skillEditModal?.skill_name}</Space>}
        open={!!skillEditModal}
        onCancel={() => setSkillEditModal(null)}
        onOk={saveSkill}
        okText="保存"
        width={680}
      >
        {skillEditModal && (
          <>
            {skillEditModal.risk_level === 'high' && (
              <Alert
                type="error"
                showIcon
                icon={<WarningOutlined />}
                message="⚠️ 高风险 Skill —— 此 Skill 配置修改将影响生产行为，保存前请确认"
                style={{ marginBottom: 12 }}
              />
            )}
            <Form form={skillForm} layout="vertical">
              <Form.Item label="Skill 名称" name="skill_name">
                <Input />
              </Form.Item>
              <Form.Item label="描述" name="skill_description">
                <TextArea rows={2} />
              </Form.Item>
              <Form.Item
                label={<Space><CodeOutlined />JSON Schema <Text type="secondary" style={{ fontSize: 12 }}>（输入参数定义，保存前自动校验格式）</Text></Space>}
                name="json_schema"
                validateStatus={schemaError ? 'error' : ''}
                help={schemaError}
              >
                <TextArea
                  rows={8}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                  placeholder={'{\n  "type": "object",\n  "properties": {}\n}'}
                  onChange={() => setSchemaError('')}
                />
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="风险等级" name="risk_level">
                    <Select options={[
                      { value: 'low', label: '低风险' },
                      { value: 'medium', label: '中风险' },
                      { value: 'high', label: '⚠️ 高风险' },
                    ]} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="需超管授权" name="requires_approval" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="需用户确认" name="requires_user_confirmation" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </>
        )}
      </Modal>

      {/* 卡片模板编辑 Modal */}
      <Modal
        title={cardModalMode === 'create' ? '新增卡片模板' : '编辑卡片模板'}
        open={cardModal !== null}
        onCancel={() => setCardModal(null)}
        onOk={saveCard}
        okText="保存"
        width={620}
      >
        <Form form={cardForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="卡片类型 card_type" name="card_type" rules={[{ required: true }]}>
                <Input placeholder="benefit_recommend" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="语言" name="language" rules={[{ required: true }]}>
                <Select options={LANGUAGES.map(l => ({ value: l.key, label: l.label }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="标题" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input />
          </Form.Item>
          <Form.Item label="跳转页面路径" name="target_page">
            <Input placeholder="/user/welfare" />
          </Form.Item>
          <Form.Item label="按钮配置（JSON 数组）" name="button_config">
            <TextArea rows={3} style={{ fontFamily: 'monospace', fontSize: 12 }}
              placeholder={'[{"label": "立即领取", "action": "claim_benefit"}]'} />
          </Form.Item>
          <Form.Item label="Payload Schema" name="payload_schema">
            <TextArea rows={3} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 协议内容编辑 Modal */}
      <Modal
        title={`编辑协议：${policyModal?.title}`}
        open={!!policyModal}
        onCancel={() => setPolicyModal(null)}
        onOk={savePolicy}
        okText="保存"
        width={700}
      >
        <Form form={policyForm} layout="vertical">
          <Form.Item label="标题" name="title">
            <Input />
          </Form.Item>
          <Form.Item label="发布状态" name="status">
            <Select options={[
              { value: 'draft', label: '草稿' },
              { value: 'published', label: '已发布' },
            ]} />
          </Form.Item>
          <Form.Item label="正文内容" name="content">
            <TextArea rows={12} placeholder="请填写协议正文..." />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
