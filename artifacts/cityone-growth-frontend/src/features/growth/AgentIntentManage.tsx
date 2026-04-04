import React, { useEffect, useState } from 'react'
import { Table, Button, Tag, Switch, Modal, Form, Input, Select, message, Space } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import { getAgentIntents, updateAgentIntent, createAgentIntent } from '../../api/agent-admin'

const { TextArea } = Input

const MODULES = [
  { value: 'borrow', label: '借还业务' },
  { value: 'coupon', label: '卡券业务' },
  { value: 'points', label: '积分业务' },
  { value: 'invite', label: '邀请裂变' },
  { value: 'order', label: '订单查询' },
  { value: 'site', label: '站点查询' },
  { value: 'activity', label: '活动参与' },
  { value: 'general', label: '通用对话' },
]

const TIERS = [
  { value: 'guest', label: '访客' },
  { value: 'fan', label: 'OA 粉丝' },
  { value: 'user', label: '认证用户' },
  { value: 'member', label: '会员' },
]

const MOCK_DATA = [
  { id: '1', code: 'borrow_guide', name: '借充电宝指引', module: 'borrow', enabled: true, requireConfirm: false, tiers: ['guest', 'fan', 'user', 'member'], hitCount: 1024, tool: 'site_search' },
  { id: '2', code: 'coupon_query', name: '查询可用卡券', module: 'coupon', enabled: true, requireConfirm: false, tiers: ['fan', 'user', 'member'], hitCount: 867, tool: 'coupon_list' },
  { id: '3', code: 'points_redeem', name: '积分兑换', module: 'points', enabled: true, requireConfirm: true, tiers: ['user', 'member'], hitCount: 456, tool: 'points_exchange' },
  { id: '4', code: 'invite_help', name: '分享福利给好友', module: 'invite', enabled: true, requireConfirm: false, tiers: ['member'], hitCount: 231, tool: 'share_welfare' },
  { id: '5', code: 'order_query', name: '订单查询', module: 'order', enabled: true, requireConfirm: false, tiers: ['user', 'member'], hitCount: 389, tool: 'order_search' },
]

export default function AgentIntentManage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAgentIntents()
      setData(res.data?.data || res.data?.list || MOCK_DATA)
    } catch {
      setData(MOCK_DATA)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (row: any) => {
    setEditing(row)
    form.setFieldsValue({
      ...row,
      alias_zh: row.alias?.zh,
      alias_th: row.alias?.th,
      alias_en: row.alias?.en,
      replyTemplate: row.replyTemplate,
      fallbackText: row.fallbackText,
    })
    setModalOpen(true)
  }

  const onSave = async () => {
    try {
      const values = await form.validateFields()
      const payload = { ...values, alias: { zh: values.alias_zh, th: values.alias_th, en: values.alias_en } }
      if (editing) {
        await updateAgentIntent({ ...payload, id: editing.id })
        message.success('意图已更新')
      } else {
        await createAgentIntent(payload)
        message.success('意图已创建')
      }
      setModalOpen(false)
      load()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error('保存失败，后端接口未就绪')
      setModalOpen(false)
      load()
    }
  }

  const toggleEnabled = async (row: any) => {
    try {
      await updateAgentIntent({ id: row.id, enabled: !row.enabled })
      load()
    } catch {
      message.error('切换失败')
    }
  }

  const columns = [
    { title: '意图编码', dataIndex: 'code', width: 160, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: '意图名称', dataIndex: 'name', width: 140 },
    { title: '归属模块', dataIndex: 'module', width: 110, render: (v: string) => <Tag>{MODULES.find((m) => m.value === v)?.label || v}</Tag> },
    { title: '支持身份', dataIndex: 'tiers', width: 200, render: (v: string[]) => (v || []).map((t) => <Tag key={t} color="blue">{TIERS.find((i) => i.value === t)?.label || t}</Tag>) },
    { title: '需确认', dataIndex: 'requireConfirm', width: 80, render: (v: boolean) => v ? <Tag color="orange">是</Tag> : <Tag color="default">否</Tag> },
    { title: '默认工具', dataIndex: 'tool', width: 140, render: (v: string) => v ? <code style={{ fontSize: 12 }}>{v}</code> : '-' },
    { title: '近期命中', dataIndex: 'hitCount', width: 90, align: 'right' as const },
    { title: '启用', dataIndex: 'enabled', width: 80, render: (_: any, row: any) => <Switch size="small" checked={row.enabled} onChange={() => toggleEnabled(row)} /> },
    { title: '操作', width: 80, render: (_: any, row: any) => <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button> },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>意图管理</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>新建意图</Button>
      </div>

      <Table
        rowKey="id"
        dataSource={data}
        columns={columns}
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 15 }}
      />

      <Modal
        open={modalOpen}
        title={editing ? '编辑意图' : '新建意图'}
        onCancel={() => setModalOpen(false)}
        onOk={onSave}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="意图编码" name="code" rules={[{ required: true }]}>
              <Input placeholder="如：borrow_guide" disabled={!!editing} />
            </Form.Item>
            <Form.Item label="意图名称" name="name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="归属模块" name="module" rules={[{ required: true }]}>
              <Select options={MODULES} />
            </Form.Item>
            <Form.Item label="默认工具" name="tool">
              <Input placeholder="如：site_search" />
            </Form.Item>
            <Form.Item label="支持身份" name="tiers">
              <Select mode="multiple" options={TIERS} />
            </Form.Item>
            <Form.Item label="是否需确认" name="requireConfirm" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Form.Item label="中文别名" name="alias_zh"><Input /></Form.Item>
          <Form.Item label="泰文别名" name="alias_th"><Input /></Form.Item>
          <Form.Item label="英文别名" name="alias_en"><Input /></Form.Item>
          <Form.Item label="默认回复模板" name="replyTemplate"><TextArea rows={2} /></Form.Item>
          <Form.Item label="失败兜底话术" name="fallbackText"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
