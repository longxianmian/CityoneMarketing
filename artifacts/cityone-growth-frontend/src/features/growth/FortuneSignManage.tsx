import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Divider, Tabs } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined, ReloadOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import request from '../../api/request'

const FORTUNE_TYPES = [
  { value: 'great', label: '大吉', color: '#f5222d' },
  { value: 'good', label: '吉', color: '#fa8c16' },
  { value: 'medium', label: '中吉', color: '#1677ff' },
  { value: 'small', label: '小吉', color: '#52c41a' },
  { value: 'bad', label: '凶', color: '#8c8c8c' },
]

export default function FortuneSignManage() {
  const [searchParams] = useSearchParams()
  const activityId = searchParams.get('activityId')
  const [activeTab, setActiveTab] = useState('themes')
  const [themes, setThemes] = useState<any[]>([])
  const [signs, setSigns] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [formVisible, setFormVisible] = useState(false)
  const [formType, setFormType] = useState<'theme' | 'sign'>('theme')
  const [isEdit, setIsEdit] = useState(false)
  const [editingId, setEditingId] = useState<any>(null)
  const [form] = Form.useForm()

  const fetchData = async () => {
    if (!activityId) return
    setLoading(true)
    try {
      const [tRes, sRes]: any = await Promise.all([
        request.get(`/api/activities/${activityId}/fortune-themes`),
        request.get(`/api/activities/${activityId}/signs`),
      ])
      setThemes(tRes.data || [])
      setSigns(sRes.data || [])
    } catch { setThemes([]); setSigns([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [activityId])

  const openAdd = (type: 'theme' | 'sign') => {
    setFormType(type); setIsEdit(false); setEditingId(null)
    form.resetFields(); setFormVisible(true)
  }

  const openEdit = (type: 'theme' | 'sign', r: any) => {
    setFormType(type); setIsEdit(true); setEditingId(r.id)
    form.setFieldsValue(r); setFormVisible(true)
  }

  const handleDelete = (type: 'theme' | 'sign', r: any) => {
    Modal.confirm({
      title: `确认删除该${type === 'theme' ? '主题' : '签文'}？`,
      onOk: async () => {
        const url = type === 'theme'
          ? `/api/activities/${activityId}/fortune-themes/${r.id}`
          : `/api/activities/${activityId}/signs/${r.id}`
        try {
          await request.delete(url)
          message.success('删除成功'); fetchData()
        } catch { message.error('删除失败') }
      },
    })
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      if (formType === 'theme') {
        if (isEdit) await request.put(`/api/activities/${activityId}/fortune-themes/${editingId}`, values)
        else await request.post(`/api/activities/${activityId}/fortune-themes`, values)
      } else {
        if (isEdit) await request.put(`/api/activities/${activityId}/signs/${editingId}`, values)
        else await request.post(`/api/activities/${activityId}/signs`, values)
      }
      message.success(isEdit ? '更新成功' : '添加成功')
      setFormVisible(false); fetchData()
    } catch {}
  }

  const themeColumns = [
    { title: '主题名称', dataIndex: 'name', key: 'name', width: 160 },
    { title: '主题描述', dataIndex: 'description', key: 'description' },
    { title: '背景色', dataIndex: 'bgColor', key: 'bgColor', width: 100,
      render: (v: string) => v ? <span style={{ display: 'inline-block', width: 24, height: 24, background: v, borderRadius: 4, border: '1px solid #f0f0f0' }} /> : '—' },
    { title: '状态', dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '禁用'}</Tag> },
    { title: '操作', key: 'action', width: 120,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit('theme', r)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete('theme', r)}>删除</Button>
        </Space>
      ) },
  ]

  const signColumns = [
    { title: '签号', dataIndex: 'signNo', key: 'signNo', width: 80 },
    { title: '签名', dataIndex: 'name', key: 'name', width: 120 },
    { title: '签类', dataIndex: 'fortuneType', key: 'fortuneType', width: 100,
      render: (v: string) => {
        const t = FORTUNE_TYPES.find(x => x.value === v)
        return t ? <Tag color={t.color}>{t.label}</Tag> : v
      } },
    { title: '签诗（中文）', dataIndex: 'poem_zh', key: 'poem_zh' },
    { title: '签诗（泰文）', dataIndex: 'poem_th', key: 'poem_th' },
    { title: '操作', key: 'action', width: 120,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit('sign', r)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete('sign', r)}>删除</Button>
        </Space>
      ) },
  ]

  return (
    <Card
      title={<Space><StarOutlined />签池管理{activityId ? ` — 活动 #${activityId}` : ''}</Space>}
      extra={<Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openAdd(activeTab === 'themes' ? 'theme' : 'sign')} disabled={!activityId}>
            添加{activeTab === 'themes' ? '主题' : '签文'}
          </Button>
        }
        items={[
          {
            key: 'themes', label: '祈福主题',
            children: (
              <Table columns={themeColumns} dataSource={themes} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 10 }} />
            ),
          },
          {
            key: 'signs', label: '签文库',
            children: (
              <Table columns={signColumns} dataSource={signs} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 20 }} />
            ),
          },
        ]}
      />

      <Modal
        title={isEdit ? `编辑${formType === 'theme' ? '主题' : '签文'}` : `添加${formType === 'theme' ? '主题' : '签文'}`}
        open={formVisible}
        onOk={handleOk}
        onCancel={() => setFormVisible(false)}
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {formType === 'theme' ? (
            <>
              <Form.Item name="name" label="主题名称" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="description" label="主题描述"><Input.TextArea rows={2} /></Form.Item>
              <Form.Item name="bgColor" label="背景主色（十六进制）"><Input placeholder="#c62828" /></Form.Item>
              <Form.Item name="iconUrl" label="主题图标 URL（可选）"><Input /></Form.Item>
              <Form.Item name="enabled" label="启用状态" initialValue={true}>
                <Select options={[{ value: true, label: '启用' }, { value: false, label: '禁用' }]} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="signNo" label="签号（如：1、36）" rules={[{ required: true }]}>
                <Input placeholder="1" />
              </Form.Item>
              <Form.Item name="name" label="签名（如：第一签）" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="fortuneType" label="签类" rules={[{ required: true }]}>
                <Select options={FORTUNE_TYPES} />
              </Form.Item>
              <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>签诗内容</Divider>
              <Form.Item name="poem_zh" label="中文签诗"><Input.TextArea rows={3} /></Form.Item>
              <Form.Item name="poem_th" label="泰文签诗"><Input.TextArea rows={3} /></Form.Item>
              <Form.Item name="poem_en" label="英文签诗"><Input.TextArea rows={3} /></Form.Item>
              <Form.Item name="interpretation_zh" label="签意（中文）"><Input.TextArea rows={2} /></Form.Item>
              <Form.Item name="interpretation_th" label="签意（泰文）"><Input.TextArea rows={2} /></Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </Card>
  )
}
