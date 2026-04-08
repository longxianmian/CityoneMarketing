import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  Tabs, Tooltip, Badge, Popconfirm, Checkbox, App as AntdApp,
  Typography, Row, Col, Card, Collapse, Alert,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined,
  UserOutlined, StopOutlined, CheckCircleOutlined, LockOutlined,
} from '@ant-design/icons'
import request from '../../api/request'
import useAuthStore from '../../store/auth'

const { Title, Text } = Typography
const { Option } = Select

interface Account {
  id: number
  username: string
  display_name: string
  role: string
  role_label: string
  role_color: string
  permissions: string[]
  department: string
  status: 'active' | 'disabled'
  created_by: number
  created_at: string
  last_login_at: string | null
  note: string
}

interface RoleTemplate {
  key: string
  label: string
  description: string
  group: string
  default_permissions: string[]
}

const PERMISSION_LABELS: Record<string, string> = {
  'growth:content:write': '推广内容创建',
  'growth:data:read': '推广数据浏览',
  'ops:activity:write': '运营活动创建',
  'ops:data:read': '运营数据浏览',
  'admin:accounts:manage': '账户管理',
}

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS)

const ROLE_TABS_SUPER = [
  { key: '', label: '全部账号' },
  { key: 'admin', label: '系统管理员' },
  { key: 'growth_content', label: '推广内容操作员' },
  { key: 'growth_data', label: '推广数据操作员' },
  { key: 'ops_activity', label: '运营活动操作员' },
  { key: 'ops_data', label: '运营数据操作员' },
]

const ROLE_TABS_ADMIN = [
  { key: '', label: '全部操作员' },
  { key: 'growth_content', label: '推广内容操作员' },
  { key: 'growth_data', label: '推广数据操作员' },
  { key: 'ops_activity', label: '运营活动操作员' },
  { key: 'ops_data', label: '运营数据操作员' },
]

interface Props {
  mode: 'super' | 'my'
}

export default function AccountManage({ mode }: Props) {
  const { message } = AntdApp.useApp()
  const { userInfo } = useAuthStore()
  const isSuperMode = mode === 'super'
  const apiBase = isSuperMode ? '/admin/accounts' : '/admin/my-accounts'

  const [accounts, setAccounts] = useState<Account[]>([])
  const [templates, setTemplates] = useState<RoleTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [activeRole, setActiveRole] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [current, setCurrent] = useState<Account | null>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [resetForm] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<RoleTemplate | null>(null)

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const params = activeRole ? `?role=${activeRole}` : ''
      const res = await request.get(`${apiBase}${params}`) as any
      setAccounts((res as any).data || [])
    } catch {
      message.error('加载账号列表失败')
    } finally {
      setLoading(false)
    }
  }, [apiBase, activeRole])

  const loadTemplates = useCallback(async () => {
    try {
      const res = await request.get('/admin/role-templates') as any
      setTemplates((res as any).data || [])
    } catch {}
  }, [])

  useEffect(() => { loadAccounts() }, [loadAccounts])
  useEffect(() => { loadTemplates() }, [loadTemplates])

  const handleTemplateChange = (key: string) => {
    const tpl = templates.find((t) => t.key === key)
    setSelectedTemplate(tpl || null)
    if (tpl) createForm.setFieldValue('permissions', tpl.default_permissions)
  }

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    setSubmitting(true)
    try {
      await request.post(apiBase, values)
      message.success('账号创建成功')
      setCreateOpen(false)
      createForm.resetFields()
      setSelectedTemplate(null)
      loadAccounts()
    } catch (e: any) {
      message.error(e?.response?.data?.msg || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!current) return
    const values = await editForm.validateFields()
    // 如果新密码字段有值，做二次确认校验
    if (values.new_password && values.new_password !== values.confirm_password) {
      message.error('两次输入的密码不一致')
      return
    }
    setSubmitting(true)
    try {
      const payload: any = { ...values }
      delete payload.confirm_password
      // 如果没填新密码则不传 new_password 字段
      if (!payload.new_password) delete payload.new_password
      await request.post(`${apiBase}/${current.id}/update`, payload)
      message.success(values.new_password ? '账号信息及密码已更新' : '更新成功')
      setEditOpen(false)
      loadAccounts()
    } catch (e: any) {
      message.error(e?.response?.data?.msg || '更新失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await request.post(`${apiBase}/${id}/delete`, {})
      message.success('已删除')
      loadAccounts()
    } catch (e: any) {
      message.error(e?.response?.data?.msg || '删除失败')
    }
  }

  const handleToggleStatus = async (record: Account) => {
    const newStatus = record.status === 'active' ? 'disabled' : 'active'
    try {
      await request.post(`${apiBase}/${record.id}/update`, { status: newStatus })
      message.success(newStatus === 'active' ? '已启用' : '已禁用')
      loadAccounts()
    } catch (e: any) {
      message.error(e?.response?.data?.msg || '操作失败')
    }
  }

  const handleResetPwd = async () => {
    if (!current) return
    const values = await resetForm.validateFields()
    setSubmitting(true)
    try {
      await request.post(`${apiBase}/${current.id}/reset-password`, values)
      message.success('密码已重置')
      setResetOpen(false)
      resetForm.resetFields()
    } catch (e: any) {
      message.error(e?.response?.data?.msg || '重置失败')
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (record: Account) => {
    setCurrent(record)
    editForm.setFieldsValue({
      display_name: record.display_name,
      role: record.role,
      department: record.department,
      permissions: record.permissions,
      note: record.note,
      new_password: '',
      confirm_password: '',
    })
    setEditOpen(true)
  }

  const openReset = (record: Account) => {
    setCurrent(record)
    resetForm.resetFields()
    setResetOpen(true)
  }

  const tabs = isSuperMode ? ROLE_TABS_SUPER : ROLE_TABS_ADMIN

  const filteredTemplates = isSuperMode
    ? templates
    : templates.filter((t) => ['growth_content', 'growth_data', 'ops_activity', 'ops_data'].includes(t.key))

  const editableRoles = isSuperMode
    ? filteredTemplates
    : filteredTemplates

  const columns = [
    {
      title: '显示名 / 用户名',
      render: (_: any, r: Account) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.display_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>@{r.username}</Text>
          {r.department && <Text type="secondary" style={{ fontSize: 12 }}>{r.department}</Text>}
        </Space>
      ),
    },
    {
      title: '角色',
      render: (_: any, r: Account) => (
        <Tag color={r.role_color}>{r.role_label}</Tag>
      ),
    },
    {
      title: '权限',
      render: (_: any, r: Account) => (
        <Space wrap size={4}>
          {(r.permissions || []).map((p) => (
            <Tag key={p} style={{ fontSize: 11, margin: 0 }}>{PERMISSION_LABELS[p] || p}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      render: (_: any, r: Account) => (
        <Badge
          status={r.status === 'active' ? 'success' : 'default'}
          text={r.status === 'active' ? '正常' : '已禁用'}
        />
      ),
    },
    {
      title: '最后登录',
      render: (_: any, r: Account) => r.last_login_at
        ? new Date(r.last_login_at).toLocaleString('zh-CN', { hour12: false })
        : '未登录过',
    },
    {
      title: '操作',
      render: (_: any, r: Account) => (
        <Space>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="重置密码">
            <Button size="small" icon={<KeyOutlined />} onClick={() => openReset(r)} />
          </Tooltip>
          <Tooltip title={r.status === 'active' ? '禁用' : '启用'}>
            <Button
              size="small"
              icon={r.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />}
              onClick={() => handleToggleStatus(r)}
              danger={r.status === 'active'}
            />
          </Tooltip>
          <Popconfirm title="确认删除此账号？" onConfirm={() => handleDelete(r.id)} okText="删除" cancelText="取消">
            <Tooltip title="删除">
              <Button size="small" icon={<DeleteOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            {isSuperMode ? '账户管理' : '操作员管理'}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {isSuperMode
              ? '管理所有系统管理员及操作员账号'
              : '管理你创建的操作员账号'}
          </Text>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateOpen(true); createForm.resetFields(); setSelectedTemplate(null) }}>
            {isSuperMode ? '新建账号' : '新建操作员'}
          </Button>
        </Col>
      </Row>

      <Card bodyStyle={{ padding: 0 }}>
        <Tabs
          activeKey={activeRole}
          onChange={setActiveRole}
          style={{ padding: '0 16px' }}
          items={tabs.map((t) => ({ key: t.key, label: t.label }))}
        />
        <Table
          columns={columns}
          dataSource={accounts}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          style={{ padding: '0 8px 8px' }}
        />
      </Card>

      {/* 新建账号弹窗 */}
      <Modal
        title={isSuperMode ? '新建账号' : '新建操作员'}
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        okText="创建"
        cancelText="取消"
        confirmLoading={submitting}
        width={560}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="display_name" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
                <Input placeholder="如：张三" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="username" label="登录用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input placeholder="仅限字母数字下划线" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="password" label="初始密码" rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '至少 8 位' }]}>
                <Input.Password placeholder="至少 8 位" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="所属部门">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="role" label="角色模板" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="选择角色模板（自动带入权限）" onChange={handleTemplateChange}>
              {isSuperMode && (
                <Option value="admin">
                  <Space>
                    <Tag color="purple">系统管理员</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>拥有推广/运营全部权限，可管理操作员</Text>
                  </Space>
                </Option>
              )}
              {filteredTemplates.map((t) => (
                <Option key={t.key} value={t.key}>
                  <Space>
                    <Tag>{t.label}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t.description}</Text>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>
          {selectedTemplate && (
            <Form.Item name="permissions" label="权限配置">
              <Checkbox.Group>
                <Row gutter={[8, 8]}>
                  {ALL_PERMISSIONS.map((p) => (
                    <Col span={12} key={p}>
                      <Checkbox value={p}>{PERMISSION_LABELS[p]}</Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
            </Form.Item>
          )}
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑账号弹窗 */}
      <Modal
        title={`编辑账号：${current?.display_name}`}
        open={editOpen}
        onOk={handleEdit}
        onCancel={() => setEditOpen(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={submitting}
        width={560}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="display_name" label="显示名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="所属部门">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="role" label="角色">
            <Select>
              {editableRoles.map((t) => (
                <Option key={t.key} value={t.key}><Tag>{t.label}</Tag></Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="permissions" label="权限配置">
            <Checkbox.Group>
              <Row gutter={[8, 8]}>
                {ALL_PERMISSIONS.map((p) => (
                  <Col span={12} key={p}>
                    <Checkbox value={p}>{PERMISSION_LABELS[p]}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Collapse
            ghost
            style={{ marginTop: 4 }}
            items={[{
              key: 'pwd',
              label: (
                <span style={{ color: '#1677ff', fontWeight: 600 }}>
                  <LockOutlined style={{ marginRight: 6 }} />重置密码（选填，不填则不修改）
                </span>
              ),
              children: (
                <>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12, fontSize: 12 }}
                    message="密码采用不可逆加密存储，系统无法显示原始密码。如需让账号使用新密码，在此处设置后保存即可。"
                  />
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="new_password"
                        label="新密码"
                        rules={[{ min: 8, message: '至少 8 位' }]}
                      >
                        <Input.Password placeholder="至少 8 位，不填则不修改" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="confirm_password"
                        label="确认新密码"
                        dependencies={['new_password']}
                        rules={[
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              const np = getFieldValue('new_password')
                              if (!np || !value || np === value) return Promise.resolve()
                              return Promise.reject(new Error('两次密码不一致'))
                            },
                          }),
                        ]}
                      >
                        <Input.Password placeholder="再次输入新密码" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ),
            }]}
          />
        </Form>
      </Modal>

      {/* 重置密码弹窗 */}
      <Modal
        title={`重置密码：${current?.display_name}`}
        open={resetOpen}
        onOk={handleResetPwd}
        onCancel={() => setResetOpen(false)}
        okText="重置"
        cancelText="取消"
        confirmLoading={submitting}
        width={400}
      >
        <Form form={resetForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }, { min: 8, message: '至少 8 位' }]}
          >
            <Input.Password placeholder="至少 8 位" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
