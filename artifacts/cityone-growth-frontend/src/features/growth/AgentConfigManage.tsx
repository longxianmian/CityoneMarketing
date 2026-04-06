import React, { useEffect, useState } from 'react'
import { Card, Form, Switch, Button, Select, InputNumber, message, Spin, Typography } from 'antd'
import { SaveOutlined, RobotOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { getAgentConfig, updateAgentConfig } from '../../api/agent-admin'
import { useI18n } from '../../i18n'
import MultiLangInput from '../../components/MultiLangInput'

const { Text } = Typography

const MOCK_CONFIG = {
  enabled: true,
  maxHistoryMessages: 20,
  showSuggestions: true,
  allowContinuousAction: false,
  fileUploadEnabled: true,
  welcomeMessage: { zh: '你好！我是 CityOne AI 助理 👋', th: 'สวัสดี! ฉันคือ CityOne AI 👋', en: "Hi! I'm CityOne AI Assistant 👋" },
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
  const { t } = useI18n()
  const ac = (key: string) => t(`agentConfig.${key}`)

  const CAPABILITIES = [
    { value: 'borrow', label: ac('capBorrow') },
    { value: 'coupon', label: ac('capCoupon') },
    { value: 'points', label: ac('capPoints') },
    { value: 'invite', label: ac('capInvite') },
    { value: 'order', label: ac('capOrder') },
    { value: 'activity', label: ac('capActivity') },
    { value: 'site', label: ac('capSite') },
  ]

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
        welcomeMessage: config.welcomeMessage || { zh: '', th: '', en: '' },
        quickPrompts: {
          zh: (config.quickPrompts?.zh || []).join('\n'),
          th: (config.quickPrompts?.th || []).join('\n'),
          en: (config.quickPrompts?.en || []).join('\n'),
        },
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
      const qp = values.quickPrompts || {}
      const payload = {
        enabled: values.enabled,
        maxHistoryMessages: values.maxHistoryMessages,
        showSuggestions: values.showSuggestions,
        allowContinuousAction: values.allowContinuousAction,
        fileUploadEnabled: values.fileUploadEnabled,
        welcomeMessage: values.welcomeMessage || { zh: '', th: '', en: '' },
        quickPrompts: {
          zh: (qp.zh || '').split('\n').filter(Boolean),
          th: (qp.th || '').split('\n').filter(Boolean),
          en: (qp.en || '').split('\n').filter(Boolean),
        },
        tierCapabilities: {
          guest: values.cap_guest || [],
          fan: values.cap_fan || [],
          user: values.cap_user || [],
          member: values.cap_member || [],
        },
      }
      await updateAgentConfig(payload)
      message.success(ac('saveSuccess'))
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(ac('saveFail'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spin style={{ marginTop: 80, display: 'block' }} />

  const tierItems = [
    { key: 'cap_guest', label: ac('tierGuest') },
    { key: 'cap_fan', label: ac('tierFan') },
    { key: 'cap_user', label: ac('tierUser') },
    { key: 'cap_member', label: ac('tierMember') },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <RobotOutlined style={{ fontSize: 22, color: '#1677ff' }} />
        <div style={{ fontSize: 18, fontWeight: 700 }}>{ac('pageTitle')}</div>
      </div>
      <Form form={form} layout="vertical">
        <Card
          title={ac('cardBasic')}
          style={{ marginBottom: 16 }}
          extra={
            <Form.Item name="enabled" valuePropName="checked" noStyle>
              <Switch checkedChildren={ac('switchOn')} unCheckedChildren={ac('switchOff')} />
            </Form.Item>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item label={ac('labelMaxHistory')} name="maxHistoryMessages">
              <InputNumber min={5} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={ac('labelShowSuggestions')} name="showSuggestions" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label={ac('labelContinuousAction')} name="allowContinuousAction" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label={ac('labelFileUpload')} name="fileUploadEnabled" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Card>

        <Card
          title={ac('cardWelcome')}
          style={{ marginBottom: 16 }}
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              <InfoCircleOutlined style={{ marginRight: 4 }} />
              输入主语言内容，点击"AI 自动翻译"补齐其他语言
            </Text>
          }
        >
          <Form.Item name="welcomeMessage" style={{ marginBottom: 0 }}>
            <MultiLangInput
              textarea
              rows={3}
              fieldKey="welcomeMessage"
              placeholder="你好！我是 CityOne AI 助理，有什么可以帮你？"
            />
          </Form.Item>
        </Card>

        <Card
          title={ac('cardPrompts')}
          style={{ marginBottom: 16 }}
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              <InfoCircleOutlined style={{ marginRight: 4 }} />
              每行一条快捷提示，翻译后将分发到各语言版本
            </Text>
          }
        >
          <Form.Item name="quickPrompts" style={{ marginBottom: 0 }}>
            <MultiLangInput
              textarea
              rows={5}
              fieldKey="quickPrompts"
              placeholder={'怎么借充电宝？\n卡券怎么使用？\n积分怎么兑换？'}
            />
          </Form.Item>
        </Card>

        <Card title={ac('cardTierCap')} style={{ marginBottom: 24 }}>
          {tierItems.map((tier) => (
            <Form.Item key={tier.key} label={tier.label} name={tier.key}>
              <Select mode="multiple" options={CAPABILITIES} placeholder={ac('capSelectPlaceholder')} />
            </Form.Item>
          ))}
        </Card>

        <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={saving} size="large">
          {ac('btnSave')}
        </Button>
      </Form>
    </div>
  )
}
