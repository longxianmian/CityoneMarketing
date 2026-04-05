import React, { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, message, Card, Space } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons'
import request from '../../api/request'
import { useI18n } from '../../i18n'

interface Props {
  embedded?: boolean
}

export default function SourceManage({ embedded = false }: Props) {
  const { t } = useI18n()
  const sm = (key: string) => t(`admin.source.${key}`)

  const SOURCE_TYPES = [
    { value: 'device', label: sm('typeDevice') },
    { value: 'shop', label: sm('typeShop') },
    { value: 'poster', label: sm('typePoster') },
    { value: 'online', label: sm('typeOnline') },
    { value: 'social', label: sm('typeSocial') },
  ]

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
      setCampaigns((camp.data.data?.rows || camp.data.data || []).filter((c: any) => c.status === 'active' || c.status === 'draft'))
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    try {
      const vals = await form.validateFields()
      await request.post('/growth/source/bind', { ...vals, id: editing?.id })
      message.success(sm('saveSuccess'))
      setOpen(false)
      load()
    } catch (e: any) {
      if (e?.response?.data?.msg) message.error(e.response.data.msg)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await request.post('/growth/source/delete', { id })
      message.success(sm('deleteSuccess'))
      load()
    } catch (e) { message.error(sm('deleteFail')) }
  }

  const openEdit = (row?: any) => {
    setEditing(row || null)
    form.setFieldsValue(row ? { sourceType: row.source_type, sourceId: row.source_id, campaignId: row.campaign_id } : {})
    setOpen(true)
  }

  const cols = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: sm('colSourceType'), dataIndex: 'source_type',
      render: (v: string) => {
        const st = SOURCE_TYPES.find((s) => s.value === v)
        return <Tag color="blue">{st?.label || v}</Tag>
      },
    },
    { title: sm('colSourceId'), dataIndex: 'source_id' },
    { title: sm('colCampaign'), dataIndex: 'campaign_name', render: (v: string) => v || '--' },
    {
      title: sm('colStatus'), dataIndex: 'status',
      render: (v: number) => <Tag color={v === 1 ? 'green' : 'default'}>{v === 1 ? sm('statusOn') : sm('statusOff')}</Tag>,
    },
    {
      title: sm('colAction'),
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>{sm('btnEdit')}</Button>
          <Popconfirm title={sm('confirmDelete')} onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>{sm('btnDelete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={embedded ? {} : { padding: 24 }}>
      <Card
        title={<span><LinkOutlined /> {sm('pageTitle')}</span>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>{sm('btnAdd')}</Button>}
      >
        <div style={{ marginBottom: 12, color: '#888', fontSize: 13 }}>{sm('description')}</div>
        <Table dataSource={rows} columns={cols} rowKey="id" loading={loading} size="small" pagination={false} />
      </Card>
      <Modal title={editing ? sm('modalEdit') : sm('modalAdd')} open={open} onOk={handleSave} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="sourceType" label={sm('formSourceType')} rules={[{ required: true }]}>
            <Select options={SOURCE_TYPES} />
          </Form.Item>
          <Form.Item name="sourceId" label={sm('formSourceId')} rules={[{ required: true }]} help={sm('formSourceIdHelp')}>
            <Input placeholder={sm('formSourceIdPlaceholder')} />
          </Form.Item>
          <Form.Item name="campaignId" label={sm('formCampaign')} rules={[{ required: true }]}>
            <Select options={campaigns.map((c: any) => ({ value: c.id, label: `[${c.campaign_type || 'activity'}] ${c.name}` }))} placeholder={sm('formCampaignPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
