import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Switch, Button, Tabs, Select, InputNumber, message, Spin, Divider } from 'antd'
import { SaveOutlined, RobotOutlined } from '@ant-design/icons'
import { getAgentConfig, updateAgentConfig } from '../../api/agent-admin'

const { TextArea } = Input

const CAPABILITIES = [
  { value: 'borrow', label: '借还充电宝' },
  { value: 'coupon', label: '卡券查询与使用' },
  { value: 'points', label: '积分查询与兑换' },
  { value: 'invite', label: '邀请好友' },
  { value: 'order', label: '订单查询' },
  { value: 'activity', label: '活动参与' },
  { value: 'site', label: '站点查询' },
]

const MOCK_CONFIG = {
  enabled: true,
  maxHistoryMessages: 20,
  showSuggestions: true,
  allowContinuousAction: false,
  fileUploadEnabled: true,
  welcomeMessage: { zh: '你好！我是 CityOne AI 助理 👋', th: 'สวัสดี!', en: 'Hi! I\'m CityOne AI Assistant 👋' },
  quickPrompts: {
    zh: ['怎么借充电宝？', '卡券怎么使用？', '积分怎么兑换？', '分享福利给好友？'],
    th: ['ยืมพาวเวอร์แบงก์ยังไง?', 'ใช้คูปองยังไง?', 'แลกคะแนนยังไง?', 'ชวนเพื่อนยังไง?'],
    en: ['How to borrow power bank?', 'How to use coupons?', 'How to redeem points?', 'How to invite friends?'],
  },
  tierCapabilities: {
    guest: [],
    fan: ['borrow', 'coupon', 'site'],
    user: ['borrow', 'coupon', 'points', 'order', 'site', 'activity'],
    member: ['borrow', 'coupon', 'points', 'order', 'site', 'activity', 'invite'],
  },
}

export default function AgentConfigManage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await getAgentConfig()
        setConfig(res.data?.data || res.data || MOCK_CONFIG)
      } catch {
        setConfig(MOCK_CONFIG)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (config) {
      form.setFieldsValue({
        enabled: config.enabled,
        maxHistoryMessages: config.maxHistoryMessages,
        showSuggestions: config.showSuggestions,
        allowContinuousAction: config.allowContinuousAction,
        fileUploadEnabled: config.fileUploadEnabled,
        welcome_zh: config.welcomeMessage?.zh,
        welcome_th: config.welcomeMessage?.th,
        welcome_en: config.welcomeMessage?.en,
        prompts_zh: (config.quickPrompts?.zh || []).join('\n'),
        prompts_th: (config.quickPrompts?.th || []).join('\n'),
        prompts_en: (config.quickPrompts?.en || []).join('\n'),
        cap_guest: config.tierCapabilities?.guest || [],
        cap_fan: config.tierCapabilities?.fan || [],
        cap_user: config.tierCapabilities?.user || [],
        cap_member: config.tierCapabilities?.member || [],
      })
    }
  }, [config, form])

  const onSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = {
        enabled: values.enabled,
        maxHistoryMessages: values.maxHistoryMessages,
        showSuggestions: values.showSuggestions,
        allowContinuousAction: values.allowContinuousAction,
        fileUploadEnabled: values.fileUploadEnabled,
        welcomeMessage: { zh: values.welcome_zh, th: values.welcome_th, en: values.welcome_en },
        quickPrompts: {
          zh: (values.prompts_zh || '').split('\n').filter(Boolean),
          th: (values.prompts_th || '').split('\n').filter(Boolean),
          en: (values.prompts_en || '').split('\n').filter(Boolean),
        },
        tierCapabilities: {
          guest: values.cap_guest || [],
          fan: values.cap_fan || [],
          user: values.cap_user || [],
          member: values.cap_member || [],
        },
      }
      await updateAgentConfig(payload)
      message.success('配置已保存')
    } catch (e: any) {
      if (e?.errorFields) return
      message.error('保存失败，后端接口未就绪')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spin style={{ marginTop: 80, display: 'block' }} />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <RobotOutlined style={{ fontSize: 22, color: '#1677ff' }} />
        <div style={{ fontSize: 18, fontWeight: 700 }}>Agent 配置</div>
      </div>

      <Form form={form} layout="vertical">
        <Card title="基础配置" style={{ marginBottom: 16 }} extra={
          <Form.Item name="enabled" valuePropName="checked" noStyle>
            <Switch checkedChildren="启用" unCheckedChildren="关闭" />
          </Form.Item>
        }>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item label="最大历史消息数" name="maxHistoryMessages">
              <InputNumber min={5} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="显示建议按钮" name="showSuggestions" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="允许连续执行动作" name="allowContinuousAction" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="启用文件上传" name="fileUploadEnabled" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Card>

        <Card title="欢迎语配置" style={{ marginBottom: 16 }}>
          <Tabs items={[
            { key: 'zh', label: '中文', children: <Form.Item name="welcome_zh" label="中文欢迎语"><TextArea rows={3} placeholder="你好！我是 CityOne AI 助理..." /></Form.Item> },
            { key: 'th', label: 'ไทย', children: <Form.Item name="welcome_th" label="泰文欢迎语"><TextArea rows={3} /></Form.Item> },
            { key: 'en', label: 'English', children: <Form.Item name="welcome_en" label="英文欢迎语"><TextArea rows={3} /></Form.Item> },
          ]} />
        </Card>

        <Card title="快捷问题配置（每行一条）" style={{ marginBottom: 16 }}>
          <Tabs items={[
            { key: 'zh', label: '中文', children: <Form.Item name="prompts_zh"><TextArea rows={5} placeholder={'怎么借充电宝？\n卡券怎么使用？'} /></Form.Item> },
            { key: 'th', label: 'ไทย', children: <Form.Item name="prompts_th"><TextArea rows={5} /></Form.Item> },
            { key: 'en', label: 'English', children: <Form.Item name="prompts_en"><TextArea rows={5} /></Form.Item> },
          ]} />
        </Card>

        <Card title="身份分层能力配置" style={{ marginBottom: 24 }}>
          {[
            { key: 'cap_guest', label: '👤 访客可用能力' },
            { key: 'cap_fan', label: '⭐ OA 粉丝可用能力' },
            { key: 'cap_user', label: '🔵 认证用户可用能力' },
            { key: 'cap_member', label: '💎 会员可用能力' },
          ].map((tier) => (
            <Form.Item key={tier.key} label={tier.label} name={tier.key}>
              <Select mode="multiple" options={CAPABILITIES} placeholder="选择可用能力" />
            </Form.Item>
          ))}
        </Card>

        <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={saving} size="large">
          保存配置
        </Button>
      </Form>
    </div>
  )
}
