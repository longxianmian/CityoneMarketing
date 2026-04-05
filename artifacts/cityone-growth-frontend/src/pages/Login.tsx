import React, { useState } from 'react'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/auth'
import { useI18n } from '../i18n'

export default function Login() {
  const nav = useNavigate()
  const [loading, setLoading] = useState(false)
  const { setToken, setUserInfo } = useAuthStore()
  const { t } = useI18n()

  const lk = (key: string) => t(`admin.login.${key}`)

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      setToken('local-preview-token')
      setUserInfo({
        userId: 1,
        userName: values.username || 'admin',
        nickName: values.username || 'admin',
        avatar: '',
        roles: ['super_admin', 'admin'],
        permissions: ['*:*:*'],
      })

      message.success(lk('loginSuccess'))
      nav('/', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 16,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        styles={{ body: { padding: '40px 32px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>CityOne</div>
          <div style={{ fontSize: 14, color: '#999', marginTop: 4 }}>{lk('subtitle')}</div>
          <div style={{ fontSize: 12, color: '#fa8c16', marginTop: 8 }}>
            {lk('previewMode')}
          </div>
        </div>

        <Form
          onFinish={onFinish}
          size="large"
          autoComplete="off"
          initialValues={{ username: 'admin', password: '123456' }}
        >
          <Form.Item name="username" rules={[{ required: true, message: lk('usernameRequired') }]}>
            <Input prefix={<UserOutlined />} placeholder={lk('username')} autoComplete="username" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: lk('passwordRequired') }]}>
            <Input.Password prefix={<LockOutlined />} placeholder={lk('password')} autoComplete="current-password" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 44, borderRadius: 8, fontWeight: 600 }}
            >
              {lk('loginBtn')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
