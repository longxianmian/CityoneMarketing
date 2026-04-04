import React, { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, message, Card, Space } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons'
import request from '../../api/request'

const SOURCE_TYPES = [
  { value: 'device', label: '设备扫码' },
  { value: 'shop', label: '门店入口' },
  { value: 'poster', label: '海报二维码' },
  { value: 'online', label: '线上投放' },
  { value: 'social', label: '社交媒体' },
]

interface Props {
  embedded?: boolean
}

export default function SourceManage({ embedded = false }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [src, camp] = await Promise.all([
        request.get('/growth/source/list'),
        request.get('/growth/activity/list'),
      ])
      setRows(src.data.data || [])
      setCampaigns(
        (camp.data.data?.rows || camp.data.data || []).filter(
          (c: any) => c.status === 'active' || c.status === 'draft'
        )
      )
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleSave = async () => {
    try {
      const vals = await form.validateFields()
      await request.post('/growth/source/bind', { ...vals, id: editing?.id })
      message.success('保存成功')
      setOpen(false)
      load()
    } catch (e: any) {
      if (e?.response?.data?.msg) message.error(e.response.data.msg)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await request.post('/growth/source/delete', { id })
      message.success('删除成功')
      load()
    } catch (e) {
      message.error('删除失败')
    }
  }

  const openEdit = (row?: any) => {
    setEditing(row || null)
    form.setFieldsValue(
      row
        ? {
            sourceType: row.source_type,
            sourceId: row.source_id,
            campaignId: row.campaign_id,
          }
        : {}
    )
    setOpen(true)
  }

  const cols = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '来源类型',
      dataIndex: 'source_type',
      render: (v: string) => {
        const st = SOURCE_TYPES.find((s) => s.value === v)
        return <Tag color="blue">{st?.label || v}</Tag>
      },
    },
    { title: '来源 ID / 编码', dataIndex: 'source_id' },
    { title: '绑定活动', dataIndex: 'campaign_name', render: (v: string) => v || '--' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: number) => <Tag color={v === 1 ? 'green' : 'default'}>{v === 1 ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={embedded ? {} : { padding: 24 }}>
      <Card
        title={<span><LinkOutlined /> 来源归因管理</span>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>新增来源绑定</Button>}
      >
        <div style={{ marginBottom: 12, color: '#888', fontSize: 13 }}>
          将设备码、门店码、海报码等来源与活动绑定，用于区分流量来源和转化归因统计。
        </div>
        <Table dataSource={rows} columns={cols} rowKey="id" loading={loading} size="small" pagination={false} />
      </Card>

      <Modal
        title={editing ? '编辑来源绑定' : '新增来源绑定'}
        open={open}
        onOk={handleSave}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="sourceType" label="来源类型" rules={[{ required: true }]}>
            <Select options={SOURCE_TYPES} />
          </Form.Item>
          <Form.Item
            name="sourceId"
            label="来源 ID / 编码"
            rules={[{ required: true }]}
            help="设备 SN、门店 ID、海报编码等，用于在二维码中唯一识别来源"
          >
            <Input placeholder="如：DEV001、SHOP_A、POSTER_2024_03" />
          </Form.Item>
          <Form.Item name="campaignId" label="绑定活动" rules={[{ required: true }]}>
            <Select
              options={campaigns.map((c: any) => ({
                value: c.id,
                label: `[${c.campaign_type || 'activity'}] ${c.name}`,
              }))}
              placeholder="选择要绑定的活动"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
