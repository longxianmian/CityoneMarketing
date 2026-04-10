import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, InputNumber,
  Select, Switch, Tabs, message, Descriptions, Tooltip, Popconfirm
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ShareAltOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons'
import request from '../../api/request'
import MediaUploadField from '../../components/MediaUploadField'
import OssImage from '../../components/OssImage'
import { useI18n } from '../../i18n'

const LANG_OPTIONS = [{ value: 'zh', label: '中文' }, { value: 'th', label: 'ภาษาไทย' }, { value: 'en', label: 'English' }]

function pickText(v: any, lang = 'zh'): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.join('\n')
  return v[lang] || v.zh || v.th || v.en || ''
}

export default function PointsMallManage() {
  const { t, language } = useI18n()
  const pm = (key: string) => t(`pointsMall.${key}`)

  const typeOptions = [
    { label: pm('typeDigital'), value: 'digital' },
    { label: pm('typePhysical'), value: 'physical' },
  ]

  const subTypeOptions = [
    { label: pm('subTypeCoupon'),      value: 'coupon_code' },
    { label: pm('subTypeMembership'),  value: 'membership' },
    { label: pm('subTypeMedia'),       value: 'media' },
    { label: pm('subTypePlatformCard'),value: 'platform_card' },
    { label: pm('subTypeAiBenefit'),   value: 'ai_benefit' },
    { label: pm('subTypeOther'),       value: 'other' },
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
    digital: 'blue', physical: 'green',
    voucher: 'blue', ai: 'blue', flash: 'blue',
  }

  const [itemType, setItemType] = useState<string>('digital')

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
  const [saving, setSaving] = useState(false)
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
    form.setFieldsValue({ item_type: 'digital', sub_type: 'coupon_code', is_flash_sale: false, exchange_mode: 'points', thumbTone: 'slate', on_shelf: true, stock: 100, points_required: 1000, price_thb: 0, valueBaht: 0, heat: 0, sort_order: 0, _sourceLang: language || 'zh' })
    setItemType('digital')
    setCoverImage('')
    setModalOpen(true)
  }

  const handleEdit = (record: any) => {
    setEditItem(record)
    const sl = (language === 'zh' || language === 'th' || language === 'en') ? language : 'zh'
    const resolvedType = ['digital','physical'].includes(record.item_type) ? record.item_type : 'digital'
    setItemType(resolvedType)
    form.setFieldsValue({
      ...record,
      item_type: resolvedType,
      sub_type: record.sub_type || undefined,
      is_flash_sale: !!record.is_flash_sale,
      _sourceLang: sl,
      name: pickText(record.name, sl),
      highlights: pickText(record.highlights, sl),
      rules: pickText(record.rules, sl),
    })
    setCoverImage(record.cover_image || '')
    setModalOpen(true)
  }

  const handleSave = async () => {
    let values: any
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setSaving(true)
    try {
      const sourceLang = values._sourceLang || 'zh'
      const mlFields = ['name', 'highlights', 'rules'] as const
      const mlValues: Record<string, any> = {}
      mlFields.forEach(f => {
        const raw = values[f]
        mlValues[f] = typeof raw === 'string'
          ? { zh: '', th: '', en: '', [sourceLang]: raw }
          : (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { zh: '', th: '', en: '', [sourceLang]: String(raw || '') })
      })
      const textsToTranslate: Record<string, string> = {}
      mlFields.forEach(f => {
        const v = mlValues[f]
        const src = v[sourceLang]?.trim()
        if (src && ['zh', 'th', 'en'].some(l => l !== sourceLang && !v[l]?.trim())) textsToTranslate[f] = src
      })
      if (Object.keys(textsToTranslate).length > 0) {
        try {
          const res: any = await request.post('/translate', { texts: textsToTranslate, sourceLang }, { timeout: 8000, silentError: true } as any)
          const result = res.data?.result ?? {}
          mlFields.forEach(f => { if (result[f]) mlValues[f] = { ...mlValues[f], ...result[f] } })
        } catch {
          // 翻译失败静默降级
        }
      }
      const payload = {
        ...values,
        cover_image: coverImage,
        name: mlValues.name,
        highlights: mlValues.highlights,
        rules: mlValues.rules,
      }
      delete payload._sourceLang
      if (editItem) {
        await request.put(`/growth/mall/items/${editItem.id}`, payload)
        message.success(pm('updateSuccess'))
      } else {
        await request.post('/growth/mall/items', payload)
        message.success(pm('addSuccess'))
      }
      setModalOpen(false)
      loadItems(itemPage)
    } catch (err: any) {
      message.error(err?.message || '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (record: any) => {
    try {
      await request.delete(`/growth/mall/items/${record.id}`)
      message.success(pm('deleteSuccess'))
      setItems(prev => prev.filter(i => i.id !== record.id))
      setItemTotal(prev => Math.max(0, prev - 1))
    } catch {
      message.error(pm('deleteFail'))
    }
  }

  const itemColumns = [
    {
      title: pm('colThumb'), dataIndex: 'cover_image', key: 'thumb', width: 70,
      render: (v: string) => v
        ? <OssImage src={v} alt="cover" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} fallback={<div style={{ width: 48, height: 48, background: '#f0f0f0', borderRadius: 6 }} />} />
        : <div style={{ width: 48, height: 48, background: '#f0f0f0', borderRadius: 6 }} />,
    },
    {
      title: pm('colTitle'), dataIndex: 'name', key: 'name', width: 180,
      render: (v: any, r: any) => {
        const displayName = v && typeof v === 'object' ? (v.zh || v.th || v.en || '') : (v || '')
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{displayName}</div>
            {r.tag && <Tag style={{ marginTop: 4, fontSize: 11 }}>{r.tag}</Tag>}
          </div>
        )
      },
    },
    {
      title: pm('colType'), key: 'item_type', width: 130,
      render: (_: any, r: any) => {
        const typeLabel = typeOptions.find(x => x.value === r.item_type)?.label || r.item_type
        const subLabel  = r.sub_type ? subTypeOptions.find(x => x.value === r.sub_type)?.label : null
        return (
          <Space direction="vertical" size={2}>
            <Tag color={typeColor[r.item_type] || 'default'} style={{ marginBottom: 0 }}>{typeLabel}</Tag>
            {subLabel && <Tag color="default" style={{ fontSize: 11, marginTop: 2 }}>{subLabel}</Tag>}
            {r.is_flash_sale && <Tag color="red" style={{ fontSize: 11, marginTop: 2 }}>限时促销</Tag>}
          </Space>
        )
      },
    },
    {
      title: pm('colMode'), dataIndex: 'exchange_mode', key: 'exchange_mode', width: 100,
      render: (v: string) => modeOptions.find(x => x.value === v)?.label || '--',
    },
    {
      title: pm('colPrice'), key: 'price', width: 140,
      render: (_: any, r: any) => (
        <div>
          <span style={{ color: '#1677ff', fontWeight: 600 }}>{r.points_required}{pm('unitPoints')}</span>
          {r.exchange_mode === 'mix' && r.price_thb > 0 && <span style={{ color: '#888', fontSize: 12 }}> + ฿{r.price_thb}</span>}
        </div>
      ),
    },
    { title: pm('colStock'), dataIndex: 'stock', key: 'stock', width: 80 },
    {
      title: pm('colEnabled'), dataIndex: 'on_shelf', key: 'on_shelf', width: 80,
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
          <Popconfirm title={pm('confirmDelete')} onConfirm={() => handleDelete(r)} okText="确定" cancelText="取消">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
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
                  open={modalOpen} onOk={handleSave} onCancel={() => { if (!saving) setModalOpen(false) }} confirmLoading={saving} width={700} destroyOnHidden
                >
                  <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <Form.Item name="item_type" label={pm('formType')} style={{ flex: 1 }} rules={[{ required: true }]}>
                        <Select
                          options={typeOptions}
                          onChange={(v: string) => {
                            setItemType(v)
                            if (v === 'physical') form.setFieldsValue({ sub_type: undefined })
                          }}
                        />
                      </Form.Item>
                      <Form.Item name="exchange_mode" label={pm('formMode')} style={{ flex: 1 }}>
                        <Select options={modeOptions} />
                      </Form.Item>
                    </div>
                    {itemType === 'digital' && (
                      <Form.Item name="sub_type" label={pm('formSubType')}>
                        <Select options={subTypeOptions} allowClear placeholder="选择数字商品小类（可选）" />
                      </Form.Item>
                    )}
                    {itemType === 'physical' && (
                      <Form.Item name="delivery_type" label="配送方式 / Delivery Type" initialValue="courier">
                        <Select options={[
                          { value: 'courier', label: '快递配送 / Courier' },
                          { value: 'pickup',  label: '站点自取 / Station Pickup' },
                          { value: 'both',    label: '快递/自取均可 / Both' },
                        ]} />
                      </Form.Item>
                    )}
                    <Form.Item name="is_flash_sale" label={pm('formIsFlashSale')} valuePropName="checked" initialValue={false}>
                      <Switch checkedChildren="限时促销" unCheckedChildren="普通" />
                    </Form.Item>
                    <Form.Item name="name" label={pm('formTitle')} rules={[{ required: true }]}>
                      <Input placeholder="商品名称 / ชื่อสินค้า / Product name" />
                    </Form.Item>
                    <Form.Item name="_sourceLang" label="输入语言 / Input Language" initialValue="zh">
                      <Select options={LANG_OPTIONS} style={{ width: 160 }} />
                    </Form.Item>
                    <Form.Item label={pm('formCoverImage')}>
                      <MediaUploadField type="image" value={coverImage} onChange={setCoverImage} placeholder={pm('formCoverImageHint')} />
                    </Form.Item>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <Form.Item name="thumbTone" label={pm('formTone')} style={{ flex: 1 }}>
                        <Select options={toneOptions} />
                      </Form.Item>
                      <Form.Item name="points_required" label={pm('formPricePoints')} style={{ flex: 1 }}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="price_thb" label={pm('formCash')} style={{ flex: 1 }}>
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
                      <Input.TextArea rows={3} placeholder="每行一条，保存时自动翻译" />
                    </Form.Item>
                    <Form.Item name="rules" label={pm('formRules')}>
                      <Input.TextArea rows={3} placeholder="每行一条规则" />
                    </Form.Item>
                    <Form.Item name="on_shelf" label={pm('formEnabled')} valuePropName="checked">
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
