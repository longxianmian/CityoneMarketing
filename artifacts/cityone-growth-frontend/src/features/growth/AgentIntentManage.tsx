import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd'
import { EditOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { createAgentIntent, getAgentIntents, updateAgentIntent } from '../../api/agent-admin'
import { useI18n } from '../../i18n'

const { TextArea } = Input

const DISPATCH_OPTIONS = [
  { value: 'chat_only', label: 'chat_only' },
  { value: 'card_only', label: 'card_only' },
  { value: 'tool_then_card', label: 'tool_then_card' },
  { value: 'tool_then_confirm', label: 'tool_then_confirm' },
  { value: 'tool_then_pay', label: 'tool_then_pay' },
  { value: 'out_of_scope', label: 'out_of_scope' },
]

const TOOL_OPTIONS = [
  { value: 'search_platform_content', label: 'search_platform_content' },
  { value: 'get_user_account', label: 'get_user_account' },
  { value: 'query_nearby_stations', label: 'query_nearby_stations' },
  { value: 'generate_invite_link', label: 'generate_invite_link' },
  { value: 'get_user_orders', label: 'get_user_orders' },
]

const CARD_TEMPLATE_OPTIONS = [
  { value: 'benefit_recommend', label: 'benefit_recommend' },
  { value: 'task_result', label: 'task_result' },
  { value: 'growth_invitation', label: 'growth_invitation' },
  { value: 'policy_info', label: 'policy_info' },
  { value: 'action_confirm', label: 'action_confirm' },
  { value: 'payment_confirm', label: 'payment_confirm' },
]

const SCOPE_OPTIONS = [
  { value: 'in_scope', label: 'in_scope' },
  { value: 'greeting', label: 'greeting' },
  { value: 'out_of_scope', label: 'out_of_scope' },
]

const dispatchColor: Record<string, string> = {
  chat_only: 'blue',
  card_only: 'cyan',
  tool_then_card: 'green',
  tool_then_confirm: 'orange',
  tool_then_pay: 'volcano',
  out_of_scope: 'default',
}

function phrasesToStr(arr?: string[]) {
  return (arr || []).join('\n')
}

function strToPhrases(s?: string) {
  return (s || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function AgentIntentManage() {
  const { t } = useI18n()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAgentIntents()
      setData(res.data?.data || res.data?.list || [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const stats = useMemo(() => {
    const total = data.length
    const enabled = data.filter((item) => item.enabled !== false).length
    const confirm = data.filter((item) => item.requires_confirmation).length
    const pay = data.filter((item) => item.requires_payment).length
    return { total, enabled, confirm, pay }
  }, [data])

  const openNew = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      dispatch_mode: 'tool_then_card',
      intent_scope: 'in_scope',
      similarity_threshold: 0.68,
      priority: 10,
      enabled: true,
      requires_confirmation: false,
      requires_payment: false,
      need_confirm: false,
    })
    setModalOpen(true)
  }

  const openEdit = (row: any) => {
    setEditing(row)
    form.setFieldsValue({
      code: row.intent_code,
      name: row.intent_name,
      dispatch_mode: row.dispatch_mode || 'tool_then_card',
      tool_name: row.tool_name || undefined,
      card_template_key: row.card_template_key || undefined,
      intent_scope: row.intent_scope || 'in_scope',
      similarity_threshold: Number(row.similarity_threshold ?? 0.68),
      priority: Number(row.priority ?? 10),
      requires_confirmation: !!row.requires_confirmation,
      requires_payment: !!row.requires_payment,
      need_confirm: !!row.need_confirm,
      phrases_zh: phrasesToStr(row.phrases?.zh),
      phrases_th: phrasesToStr(row.phrases?.th),
      phrases_en: phrasesToStr(row.phrases?.en),
      resp_zh: row.template_responses?.zh || '',
      resp_th: row.template_responses?.th || '',
      resp_en: row.template_responses?.en || '',
      enabled: row.enabled !== false,
    })
    setModalOpen(true)
  }

  const onSave = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        intent_code: values.code,
        intent_name: values.name,
        dispatch_mode: values.dispatch_mode,
        tool_name: values.tool_name || null,
        card_template_key: values.card_template_key || null,
        intent_scope: values.intent_scope,
        similarity_threshold: Number(values.similarity_threshold ?? 0.68),
        priority: Number(values.priority ?? 10),
        enabled: values.enabled !== false,
        requires_confirmation: !!values.requires_confirmation,
        requires_payment: !!values.requires_payment,
        need_confirm: !!values.need_confirm,
        phrases: {
          zh: strToPhrases(values.phrases_zh),
          th: strToPhrases(values.phrases_th),
          en: strToPhrases(values.phrases_en),
        },
        template_responses: {
          zh: values.resp_zh || '',
          th: values.resp_th || '',
          en: values.resp_en || '',
        },
      }

      if (editing) {
        await updateAgentIntent(payload)
        message.success(t('agentIntentManage.savedOk'))
      } else {
        await createAgentIntent(payload)
        message.success(t('agentIntentManage.createdOk'))
      }
      setModalOpen(false)
      load()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(t('agentIntentManage.saveError'))
    }
  }

  const toggleEnabled = async (row: any) => {
    try {
      await updateAgentIntent({ intent_code: row.intent_code, enabled: row.enabled === false })
      load()
    } catch {
      message.error(t('agentIntentManage.toggleError'))
    }
  }

  const columns = [
    {
      title: t('agentIntentManage.colCode'),
      dataIndex: 'intent_code',
      width: 180,
      render: (value: string) => <code style={{ fontSize: 12 }}>{value}</code>,
    },
    {
      title: t('agentIntentManage.colName'),
      dataIndex: 'intent_name',
      width: 160,
    },
    {
      title: '分发方式',
      dataIndex: 'dispatch_mode',
      width: 150,
      render: (value: string) => <Tag color={dispatchColor[value] || 'default'}>{value}</Tag>,
    },
    {
      title: '动作配置',
      width: 240,
      render: (_: unknown, row: any) => (
        <Space wrap size={[4, 4]}>
          {row.tool_name && <Tag color="green">工具：{row.tool_name}</Tag>}
          {row.card_template_key && <Tag color="purple">卡片：{row.card_template_key}</Tag>}
          {row.requires_confirmation && <Tag color="orange">需确认</Tag>}
          {row.requires_payment && <Tag color="volcano">需支付</Tag>}
          {!row.tool_name && !row.card_template_key && !row.requires_confirmation && !row.requires_payment && (
            <span style={{ color: '#bbb' }}>-</span>
          )}
        </Space>
      ),
    },
    {
      title: '阈值',
      dataIndex: 'similarity_threshold',
      width: 90,
      render: (value: number) => (typeof value === 'number' ? value.toFixed(2) : '-'),
    },
    {
      title: '关键词预览',
      width: 260,
      render: (_: unknown, row: any) => {
        const all = [
          ...(row.phrases?.zh || []),
          ...(row.phrases?.th || []),
          ...(row.phrases?.en || []),
        ].slice(0, 4)
        return all.length > 0
          ? <Space wrap>{all.map((item: string, index: number) => <Tag key={index}>{item}</Tag>)}</Space>
          : <span style={{ color: '#999' }}>{t('agentIntentManage.noPhrases')}</span>
      },
    },
    {
      title: t('agentIntentManage.colEnabled'),
      width: 80,
      render: (_: unknown, row: any) => (
        <Switch size="small" checked={row.enabled !== false} onChange={() => toggleEnabled(row)} />
      ),
    },
    {
      title: t('agentIntentManage.colActions'),
      width: 90,
      render: (_: unknown, row: any) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
          {t('agentIntentManage.editBtn')}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{t('agentIntentManage.pageTitle')}</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
          {t('agentIntentManage.newIntent')}
        </Button>
      </div>

      <Alert
        icon={<InfoCircleOutlined />}
        type="info"
        showIcon
        message={t('agentIntentManage.bannerTip')}
        description={`当前共 ${stats.total} 条意图，已启用 ${stats.enabled} 条，其中需确认 ${stats.confirm} 条、需支付 ${stats.pay} 条。`}
        style={{ marginBottom: 16 }}
      />

      <Table
        rowKey="intent_code"
        dataSource={data}
        columns={columns}
        loading={loading}
        scroll={{ x: 1300 }}
        pagination={{ pageSize: 15 }}
      />

      <Modal
        open={modalOpen}
        title={editing ? t('agentIntentManage.editTitle') : t('agentIntentManage.createTitle')}
        onCancel={() => setModalOpen(false)}
        onOk={onSave}
        okText={t('agentIntentManage.saveBtn')}
        cancelText={t('agentIntentManage.cancelBtn')}
        width={860}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label={t('agentIntentManage.formCode')} name="code" rules={[{ required: true }]}>
              <Input placeholder="例：platform_promotion_query" disabled={!!editing} />
            </Form.Item>
            <Form.Item label={t('agentIntentManage.formName')} name="name" rules={[{ required: true }]}>
              <Input placeholder="例：查询平台当前优惠" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item label="分发方式" name="dispatch_mode" rules={[{ required: true }]}>
              <Select options={DISPATCH_OPTIONS} />
            </Form.Item>
            <Form.Item label="工具" name="tool_name">
              <Select allowClear options={TOOL_OPTIONS} placeholder="无工具可留空" />
            </Form.Item>
            <Form.Item label="卡片模板" name="card_template_key">
              <Select allowClear options={CARD_TEMPLATE_OPTIONS} placeholder="无卡片可留空" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item label="意图范围" name="intent_scope" rules={[{ required: true }]}>
              <Select options={SCOPE_OPTIONS} />
            </Form.Item>
            <Form.Item label="命中阈值" name="similarity_threshold">
              <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="优先级" name="priority">
              <InputNumber min={1} max={999} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Form.Item label="启用" name="enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="需确认" name="requires_confirmation" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="需支付" name="requires_payment" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="兼容旧确认标记" name="need_confirm" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>

          <div style={{ fontWeight: 600, marginBottom: 8, color: '#333' }}>触发关键词</div>
          <Form.Item label={t('agentIntentManage.formPhrasesZh')} name="phrases_zh">
            <TextArea rows={3} placeholder={'今天有什么优惠\n平台活动\n现在有折扣吗'} />
          </Form.Item>
          <Form.Item label={t('agentIntentManage.formPhrasesTh')} name="phrases_th">
            <TextArea rows={2} placeholder={'มีโปรโมชันอะไรบ้าง\nมีส่วนลดไหม'} />
          </Form.Item>
          <Form.Item label={t('agentIntentManage.formPhrasesEn')} name="phrases_en">
            <TextArea rows={2} placeholder={'what promotions are available\nany offers today'} />
          </Form.Item>

          <div style={{ fontWeight: 600, marginBottom: 8, color: '#333', marginTop: 8 }}>命中时预设回复</div>
          <Form.Item label={t('agentIntentManage.formRespZh')} name="resp_zh">
            <TextArea rows={2} placeholder="（中文预设回复，为空则交给 LLM 或卡片链路）" />
          </Form.Item>
          <Form.Item label={t('agentIntentManage.formRespTh')} name="resp_th">
            <TextArea rows={2} placeholder="（泰文预设回复，选填）" />
          </Form.Item>
          <Form.Item label={t('agentIntentManage.formRespEn')} name="resp_en">
            <TextArea rows={2} placeholder="（英文预设回复，选填）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
