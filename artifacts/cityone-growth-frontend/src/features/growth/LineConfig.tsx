import React, { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Alert, Divider, Switch, Tag, message, Typography, Space } from 'antd'
import { CheckCircleOutlined, WarningOutlined, SettingOutlined, LockOutlined } from '@ant-design/icons'
import request from '../../api/request'
import { useI18n } from '../../i18n'

const { Text } = Typography

export default function LineConfig() {
  const { t } = useI18n()
  const lt = (key: string) => t(`admin.line.${key}`)

  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [requireFollow, setRequireFollow] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await request.get('/growth/line/config')
      const cfg = res?.data || null
      setConfig(cfg)

      if (cfg) {
        form.setFieldsValue({
          channelId: cfg.channelId || '',
          officialAccountId: cfg.officialAccountId || '',
          liffId: cfg.liffId || '',
          lineLoginRedirectPath: cfg.lineLoginRedirectPath || '/welfare',
          channelSecret: '',
          channelAccessToken: '',
        })
        setRequireFollow(!!cfg.requireFollow)
      } else {
        form.resetFields()
        setRequireFollow(false)
      }
    } catch (e) {
      message.error(lt('loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSave = async () => {
    try {
      const vals = await form.validateFields()
      if (requireFollow) {
        if (!vals.officialAccountId?.trim()) {
          message.error(lt('officialAccountIdRequiredWhenFollow'))
          return
        }
        if (!vals.liffId?.trim()) {
          message.error(lt('liffIdRequiredWhenFollow'))
          return
        }
      }
      setSaving(true)

      const payload: Record<string, any> = {
        channelId: vals.channelId?.trim(),
        officialAccountId: vals.officialAccountId?.trim() || '',
        liffId: vals.liffId?.trim() || '',
        lineLoginRedirectPath: vals.lineLoginRedirectPath?.trim() || '/welfare',
        requireFollow,
      }

      if (vals.channelSecret && vals.channelSecret.trim()) {
        payload.channelSecret = vals.channelSecret.trim()
      }
      if (vals.channelAccessToken && vals.channelAccessToken.trim()) {
        payload.channelAccessToken = vals.channelAccessToken.trim()
      }

      await request.post('/growth/line/config/save', payload)
      message.success(lt('saveSuccess'))
      await load()
    } catch (e: any) {
      const msg =
        e?.response?.data?.msg ||
        e?.message ||
        lt('saveError')
      message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const isConfigured = !!config?.channelId
  const isProdReady = !!config?.channelId && !!config?.officialAccountId && !!config?.liffId

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <Card title={<span><SettingOutlined /> {lt('title')}</span>} loading={loading}>
        {isConfigured ? (
          <Alert
            type={isProdReady ? 'success' : 'warning'}
            icon={<CheckCircleOutlined />}
            showIcon
            message={isProdReady ? lt('configured') : lt('configuredIncomplete')}
            description={
              isProdReady
                ? `${lt('configuredDescPrefix')}: ${config?.channelId || '--'} · ${lt('configuredDescMiddle')}: ${config?.officialAccountId || '--'}`
                : lt('configuredIncompleteDesc')
            }
            style={{ marginBottom: 20 }}
          />
        ) : (
          <Alert
            type="warning"
            icon={<WarningOutlined />}
            showIcon
            message={lt('notConfigured')}
            description={lt('notConfiguredDesc')}
            style={{ marginBottom: 20 }}
          />
        )}

        <Form form={form} layout="vertical">
          <Form.Item
            name="channelId"
            label={lt('channelId')}
            rules={[{ required: true, message: lt('channelIdRequired') }]}
          >
            <Input placeholder={lt('channelIdPlaceholder')} />
          </Form.Item>

          <Form.Item name="channelSecret" label={lt('channelSecret')}>
            <Input.Password placeholder={lt('channelSecretPlaceholder')} />
          </Form.Item>

          <Form.Item name="channelAccessToken" label={lt('channelAccessToken')}>
            <Input.Password placeholder={lt('tokenPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="officialAccountId"
            label={lt('officialAccountId')}
            rules={requireFollow ? [{ required: true, message: lt('officialAccountIdRequiredWhenFollow') }] : undefined}
          >
            <Input placeholder={lt('officialAccountIdPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="liffId"
            label={lt('liffId')}
            rules={requireFollow ? [{ required: true, message: lt('liffIdRequiredWhenFollow') }] : undefined}
          >
            <Input placeholder={lt('liffIdPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="lineLoginRedirectPath"
            label={lt('lineLoginRedirectPath')}
          >
            <Input placeholder={lt('lineLoginRedirectPathPlaceholder')} />
          </Form.Item>

          <Divider />

          <div
            style={{
              background: '#F0F9FF',
              border: '1px solid #BAE6FD',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <LockOutlined style={{ color: '#0284C7' }} />
                  {lt('followGate')}
                  {requireFollow && (
                    <Tag color="green" style={{ marginLeft: 4 }}>
                      {lt('followGateEnabled')}
                    </Tag>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                  {lt('followGateDesc')}
                </div>
                {requireFollow && (
                  <Space style={{ marginTop: 8 }} size={6}>
                    <Tag color="blue" style={{ fontSize: 12 }}>
                      {lt('exemptPages')}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {lt('exemptPagesList')}
                    </Text>
                  </Space>
                )}
              </div>
              <Switch
                checked={requireFollow}
                onChange={setRequireFollow}
                checkedChildren={lt('switchOn')}
                unCheckedChildren={lt('switchOff')}
                style={{ flexShrink: 0, marginTop: 2 }}
              />
            </div>
          </div>

          <div
            style={{
              marginBottom: 16,
              padding: 16,
              background: '#F6FFED',
              border: '1px solid #B7EB8F',
              borderRadius: 8,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{lt('envTitle')}</div>
            <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: 13, color: '#555' }}>
              <li>{lt('env1')}</li>
              <li>
                {lt('env2Prefix')}
                <Text code>{lt('env2Code')}</Text>
              </li>
              <li>{lt('env3')}</li>
              <li>{lt('env4')}</li>
              <li>{lt('env5')}</li>
            </ul>
          </div>

          <Button type="primary" onClick={handleSave} loading={saving} size="large">
            {lt('saveButton')}
          </Button>
        </Form>
      </Card>
    </div>
  )
}
