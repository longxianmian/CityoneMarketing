import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, InputNumber,
  Select, Switch, Tabs, message, Descriptions, Tooltip
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ShareAltOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons'
import request from '../../api/request'
import MediaUploadField from '../../components/MediaUploadField'
import { useI18n } from '../../i18n'

const { TextArea } = Input

export default function PointsMallManage() {
  const { t } = useI18n()
  const pm = (key: string) => t(`admin.pointsMall.${key}`)

  const typeOptions = [
    { label: pm('typeCoupon'), value: 'voucher' },
    { label: pm('typeAI'), value: 'ai' },
    { label: pm('typePhysical'), value: 'physical' },
    { label: pm('typeFlash'), value: 'flash' },
  ]

  const modeOptions = [
    { label: pm('modePoints'), value: 'points' },
    { label: pm('modeMix'), value: 'mix' },
  ]

  const toneOptions = [
    { label: 'Slate', value: 'slate' },
    { label: 'Violet', value: 'violet' },
    { label: 'Amber', value: 'amber' },
    { label: 'Emerald', value: 'emerald' },
    { label: 'Sky', value: 'sky' },
  ]

  const typeColor: Record<string, string> = {
    voucher: 'orange', ai: 'blue', physical: 'green', flash: 'red',
  }

  const getOrderStatusInfo = (status: string): { text: string; color: string } => ({
    pending: { text: pm('orderPending'), color: 'orange' },
    issued: { text: pm('orderIssued'), color: 'blue' },
    used: { text: pm('orderUsed'), color: 'green' },
    expired: { text: pm('orderExpired'), color: 'default' },
  }[status] || { text: status, color: 'default' })

  const [items, setItems] = useState<any[]>([])
  const [itemTotal, setItemTotal] = useState(0)
  const [itemPage, setItemPage] = useState(1)
  const [shareItemId, setShareItemId] = useState<number | null>(null)
  const [shareItemName, setShareItemName] = useState('')
  const [shareCopied, setShareCopied] = useState(false)

  const getMallItemUrl = (id: number) => `${window.location.origin}/points-mall?item=${id}`

  const handleShareItem = (r: any) => {
    setShareItemId(r.id); setShareItemName(r.title); setShareCopied(false)
  }

  const handleCopyMallUrl = async () => {
    if (!shareItemId) return
    await navigator.clipboard.writeText(getMallItemUrl(shareItemId))
    setShareCopied(true)
    message.success(pm('linkCopied'))
    setTimeout(() => setShareCopied(false), 2500)
  }

  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form] = Form.useForm()
  const [coverImage, setCoverImage] = useState('')

  const [orders, setOrders] = useState<any[]>([])
  const [orderTotal, setOrderTotal] = useState(0)
  const [orderPage, setOrderPage] = useState(1)
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderStatus, setOrderStatus] = useState('')

  const loadItems = async (page = 1) => {
    setLoading(true)
    try {
      const { data } = await request.get('/growth/mall/items', { params: { pageNum: page, pageSize: 20 } })
      setItems(data.list || []); setItemTotal(data.total || 0)
    } catch {}
    setLoading(false)
  }

  const loadOrders = async (page = 1) => {
    setOrderLoading(true)
    try {
      const params: any = { pageNum: page, pageSize: 20 }
      if (orderStatus) params.status = orderStatus
      const { data } = await request.get('/growth/mall/orders', { params })
      setOrders(data.list || []); setOrderTotal(data.total || 0)
    } catch {}
    setOrderLoading(false)
  }

  useEffect(() => { loadItems() }, [])

  const handleAdd = () => {
    setEditItem(null)
    form.resetFields()
    form.setFieldsValue({ type: 'voucher', mode: 'points', thumbTone: 'slate', enabled: true, stock: 100, pricePoints: 1000, cash: 0, valueBaht: 0, heat: 0, sort_order: 0 })
    setCoverImage('')
    setModalOpen(true)
  }

  const handleEdit = (record: any) => {
    setEditItem(record)
    form.setFieldsValue({
      ...record,
      highlights: Array.isArray(record.highlights) ? record.highlights.join('\n') : '',
      rules: Array.isArray(record.rules) ? record.rules.join('\n') : '',
    })
    setCoverImage(record.coverImage || '')
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        coverImage,
        highlights: (values.highlights || '').split('\n').filter(Boolean),
        rules: (values.rules || '').split('\n').filter(Boolean),
      }
      if (editItem) {
        await request.put(`/growth/mall/items/${editItem.id}`, payload)
        message.success(pm('updateSuccess'))
      } else {
        await request.post('/growth/mall/items', payload)
        message.success(pm('addSuccess'))
      }
      setModalOpen(false); loadItems(itemPage)
    } catch {}
  }

  const handleDelete = async (record: any) => {
    Modal.confirm({
      title: pm('confirmDelete'),
      onOk: async () => {
        try {
          await request.delete(`/growth/mall/items/${record.id}`)
          message.success(pm('deleteSuccess')); loadItems(1)
        } catch { message.error(pm('deleteFail')) }
      },
    })
  }

  const itemColumns = [
    {
      title: pm('colThumb'), dataIndex: 'coverImage', key: 'thumb', width: 70,
      render: (v: string) => v ? <img src={v} alt="cover" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} /> : <div style={{ width: 48, height: 48, background: '#f0f0f0', borderRadius: 6 }} />,
    },
    {
      title: pm('colTitle'), dataIndex: 'title', key: 'title', width: 180,
      render: (v: string, r: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          {r.tag && <Tag style={{ marginTop: 4, fontSize: 11 }}>{r.tag}</Tag>}
        </div>
      ),
    },
    {
      title: pm('colType'), dataIndex: 'type', key: 'type', width: 90,
      render: (v: string) => <Tag color={typeColor[v] || 'default'}>{typeOptions.find(x => x.value === v)?.label || v}</Tag>,
    },
    {
      title: pm('colMode'), dataIndex: 'mode', key: 'mode', width: 100,
      render: (v: string) => modeOptions.find(x => x.value === v)?.label || '--',
    },
    {
      title: pm('colPrice'), key: 'price', width: 140,
      render: (_: any, r: any) => (
        <div>
          <span style={{ color: '#1677ff', fontWeight: 600 }}>{r.pricePoints}{pm('unitPoints')}</span>
          {r.mode === 'mix' && r.cash > 0 && <span style={{ color: '#888', fontSize: 12 }}> + ฿{r.cash}</span>}
        </div>
      ),
    },
    { title: pm('colStock'), dataIndex: 'stock', key: 'stock', width: 80 },
    {
      title: pm('colEnabled'), dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? pm('statusOn') : pm('statusOff')}</Tag>,
    },
    {
      title: pm('colAction'), key: 'action', width: 160,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>{pm('btnEdit')}</Button>
          <Tooltip title={pm('btnShare')}>
            <Button size="small" icon={<ShareAltOutlined />} onClick={() => handleShareItem(r)} />
          </Tooltip>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)} />
        </Space>
      ),
    },
  ]

  const orderColumns = [
    { title: pm('colOrderId'), dataIndex: 'id', key: 'id', width: 80 },
    { title: pm('colOrderUser'), dataIndex: 'userId', key: 'userId', width: 130 },
    { title: pm('colOrderItem'), dataIndex: 'itemTitle', key: 'itemTitle', width: 180 },
    {
      title: pm('colOrderPoints'), dataIndex: 'pointsSpent', key: 'pointsSpent', width: 100,
      render: (v: number) => <span style={{ color: '#1677ff' }}>{v}</span>,
    },
    {
      title: pm('colOrderStatus'), dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => { const s = getOrderStatusInfo(v); return <Tag color={s.color}>{s.text}</Tag> },
    },
    { title: pm('colOrderTime'), dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  ]

  return (
    <div>
      <Tabs
        items={[
          {
            key: 'items', label: pm('tabItems'),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{pm('btnAdd')}</Button>
                </div>
                <Table
                  columns={itemColumns} dataSource={items} rowKey="id" loading={loading} size="small"
                  pagination={{ current: itemPage, pageSize: 20, total: itemTotal, onChange: p => { setItemPage(p); loadItems(p) } }}
                />
                <Modal
                  title={editItem ? pm('modalEdit') : pm('modalAdd')}
                  open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={700} destroyOnHidden
                >
                  <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <Form.Item name="title" label={pm('formTitle')} style={{ flex: 2 }} rules={[{ required: true }]}><Input /></Form.Item>
                      <Form.Item name="type" label={pm('formType')} style={{ flex: 1 }} rules={[{ required: true }]}>
                        <Select options={typeOptions} />
                      </Form.Item>
                      <Form.Item name="mode" label={pm('formMode')} style={{ flex: 1 }}>
                        <Select options={modeOptions} />
                      </Form.Item>
                    </div>
                    <Form.Item label={pm('formCoverImage')}>
                      <MediaUploadField type="image" value={coverImage} onChange={setCoverImage} placeholder={pm('formCoverImageHint')} />
                    </Form.Item>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <Form.Item name="thumbTone" label={pm('formTone')} style={{ flex: 1 }}>
                        <Select options={toneOptions} />
                      </Form.Item>
                      <Form.Item name="pricePoints" label={pm('formPricePoints')} style={{ flex: 1 }}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="cash" label={pm('formCash')} style={{ flex: 1 }}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="stock" label={pm('formStock')} style={{ flex: 1 }}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <Form.Item name="valueBaht" label={pm('formValueBaht')} style={{ flex: 1 }}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="heat" label={pm('formHeat')} style={{ flex: 1 }}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="sort_order" label={pm('formSortOrder')} style={{ flex: 1 }}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <Form.Item name="tag" label={pm('formTag')} style={{ flex: 1 }}>
                        <Input placeholder={pm('formTagHint')} />
                      </Form.Item>
                      <Form.Item name="badge" label={pm('formBadge')} style={{ flex: 1 }}>
                        <Input placeholder={pm('formBadgeHint')} />
                      </Form.Item>
                    </div>
                    <Form.Item name="detailTitle" label={pm('formDetailTitle')}><Input /></Form.Item>
                    <Form.Item name="highlights" label={pm('formHighlights')}>
                      <TextArea rows={3} placeholder={pm('formHighlightsHint')} />
                    </Form.Item>
                    <Form.Item name="rules" label={pm('formRules')}>
                      <TextArea rows={3} placeholder={pm('formRulesHint')} />
                    </Form.Item>
                    <Form.Item name="enabled" label={pm('formEnabled')} valuePropName="checked">
                      <Switch checkedChildren={pm('statusOn')} unCheckedChildren={pm('statusOff')} />
                    </Form.Item>
                  </Form>
                </Modal>
                <Modal
                  title={pm('shareTitle')}
                  open={!!shareItemId}
                  onCancel={() => setShareItemId(null)}
                  footer={<Button onClick={() => setShareItemId(null)}>{pm('btnClose')}</Button>}
                >
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label={pm('shareItemName')}>{shareItemName}</Descriptions.Item>
                    <Descriptions.Item label={pm('shareLink')}>{shareItemId ? getMallItemUrl(shareItemId) : '--'}</Descriptions.Item>
                  </Descriptions>
                  <Button
                    style={{ marginTop: 16 }} type="primary" block
                    icon={shareCopied ? <CheckOutlined /> : <CopyOutlined />}
                    onClick={handleCopyMallUrl}
                  >
                    {shareCopied ? pm('copied') : pm('copyLink')}
                  </Button>
                </Modal>
              </div>
            ),
          },
          {
            key: 'orders', label: pm('tabOrders'),
            children: (
              <div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <Select
                    style={{ width: 160 }} placeholder={pm('filterOrderStatus')}
                    value={orderStatus || undefined} onChange={v => setOrderStatus(v || '')} allowClear
                    options={[
                      { value: 'pending', label: pm('orderPending') },
                      { value: 'issued', label: pm('orderIssued') },
                      { value: 'used', label: pm('orderUsed') },
                      { value: 'expired', label: pm('orderExpired') },
                    ]}
                  />
                  <Button type="primary" onClick={() => { setOrderPage(1); loadOrders(1) }}>{pm('btnSearch')}</Button>
                </div>
                <Table
                  columns={orderColumns} dataSource={orders} rowKey="id" loading={orderLoading} size="small"
                  pagination={{ current: orderPage, pageSize: 20, total: orderTotal, onChange: p => { setOrderPage(p); loadOrders(p) } }}
                />
              </div>
            ),
          },
        ]}
        onChange={key => { if (key === 'orders') loadOrders(1) }}
      />
    </div>
  )
}
