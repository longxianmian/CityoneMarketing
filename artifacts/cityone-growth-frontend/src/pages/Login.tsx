import React, { useState } from 'react'
import { Form, Input, Button, Card, Alert } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { App as AntdApp } from 'antd'
import useAuthStore from '../store/auth'
import { useI18n } from '../i18n'
import request from '../api/request'

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

export default function Login() {
  const nav = useNavigate()
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const { setToken, setUserInfo } = useAuthStore()
  const { t } = useI18n()
  const { message } = AntdApp.useApp()

  const lk = (key: string) => t(`login.${key}`)

  const onFinish = async (values: { username: string; password: string }) => {
    setErrorMsg('')
    setLoading(true)
    try {
      if (DEV_BYPASS) {
        // 仅在 VITE_DEV_BYPASS_AUTH=true 时可用（本地开发）
        setToken('dev-bypass-token')
        setUserInfo({
          userId: 0,
          userName: values.username || 'dev',
          nickName: 'Dev Mode',
          avatar: '',
          roles: ['super_admin'],
          permissions: ['*:*:*'],
        })
        message.success(lk('loginSuccess'))
        nav('/', { replace: true })
        return
      }

      const res = await request.post('/admin/login', {
        username: values.username,
        password: values.password,
      }) as any

      const data = res?.data || res
      const { token, admin } = data || {}

      if (!token) throw new Error('登录失败，服务器未返回 token')

      setToken(token)
      setUserInfo({
        userId: admin.id,
        userName: admin.username,
        nickName: admin.display_name || admin.username,
        avatar: '',
        roles: [admin.role],
        permissions: admin.role === 'super_admin' ? ['*:*:*'] : [admin.role],
      })

      message.success(lk('loginSuccess'))
      nav('/', { replace: true })
    } catch (err: any) {
      const msg = err?.response?.data?.msg || err?.message || '登录失败，请检查用户名和密码'
      setErrorMsg(msg)
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
          {DEV_BYPASS && (
            <div style={{ fontSize: 12, color: '#fa8c16', marginTop: 8 }}>
              {lk('previewMode')}
            </div>
          )}
        </div>

        {errorMsg && (
          <Alert
            message={errorMsg}
            type="error"
            showIcon
            style={{ marginBottom: 20, borderRadius: 8 }}
            closable
            onClose={() => setErrorMsg('')}
          />
        )}

        <Form
          onFinish={onFinish}
          size="large"
          autoComplete="off"
          initialValues={DEV_BYPASS ? { username: 'admin', password: '123456' } : {}}
        >
          <Form.Item name="username" rules={[{ required: true, message: lk('usernameRequired') }]}>
            <Input
              prefix={<UserOutlined />}
              placeholder={lk('username')}
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: lk('passwordRequired') }]}>
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={lk('password')}
              autoComplete="current-password"
            />
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
