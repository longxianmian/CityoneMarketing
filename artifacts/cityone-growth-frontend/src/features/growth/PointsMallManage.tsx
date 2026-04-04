import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, InputNumber,
  Select, Switch, Tabs, message, Popconfirm, Descriptions, Tooltip
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ShareAltOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons'
import request from '../../api/request'
import MediaUploadField from '../../components/MediaUploadField'

const { TextArea } = Input

const typeOptions = [
  { label: '卡券', value: 'voucher' },
  { label: '数字人', value: 'ai' },
  { label: '实物', value: 'physical' },
  { label: '限时', value: 'flash' },
]

const modeOptions = [
  { label: '纯积分', value: 'points' },
  { label: '现金+积分', value: 'mix' },
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

const orderStatusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待使用', color: 'orange' },
  issued: { text: '已发放', color: 'blue' },
  used: { text: '已使用', color: 'green' },
  expired: { text: '已过期', color: 'default' },
}

export default function PointsMallManage() {
  const [items, setItems] = useState<any[]>([])
  const [itemTotal, setItemTotal] = useState(0)
  const [itemPage, setItemPage] = useState(1)
  const [shareItemId, setShareItemId] = useState<number | null>(null)
  const [shareItemName, setShareItemName] = useState('')
  const [shareCopied, setShareCopied] = useState(false)

  const getMallItemUrl = (id: number) => `${window.location.origin}/points-mall?item=${id}`

  const handleShareItem = (r: any) => {
    setShareItemId(r.id)
    setShareItemName(r.title)
    setShareCopied(false)
  }

  const handleCopyMallUrl = async () => {
    if (!shareItemId) return
    await navigator.clipboard.writeText(getMallItemUrl(shareItemId))
    setShareCopied(true)
    message.success('积分商品链接已复制')
    setTimeout(() => setShareCopied(false), 2500)
  }
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form] = Form.useForm()

  const [orders, setOrders] = useState<any[]>([])
  const [orderTotal, setOrderTotal] = useState(0)
  const [orderPage, setOrderPage] = useState(1)
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderStatus, setOrderStatus] = useState('')

  const loadItems = async (page = 1) => {
    setLoading(true)
    try {
      const { data } = await request.get('/growth/mall/items', { params: { pageNum: page, pageSize: 20 } })
      setItems(data.list || [])
      setItemTotal(data.total || 0)
    } catch {}
    setLoading(false)
  }

  const loadOrders = async (page = 1) => {
    setOrderLoading(true)
    try {
      const params: any = { pageNum: page, pageSize: 20 }
      if (orderStatus) params.status = orderStatus
      const { data } = await request.get('/growth/mall/orders', { params })
      setOrders(data.list || [])
      setOrderTotal(data.total || 0)
    } catch {}
    setOrderLoading(false)
  }

  useEffect(() => { loadItems() }, [])

  const handleAdd = () => {
    setEditItem(null)
    form.resetFields()
    form.setFieldsValue({ type: 'voucher', mode: 'points', thumbTone: 'slate', enabled: true, stock: 100, pricePoints: 1000, cash: 0, valueBaht: 0, heat: 0, sort_order: 0 })
    setModalOpen(true)
  }

  const handleEdit = (record: any) => {
    setEditItem(record)
    form.setFieldsValue({
      ...record,
      highlights: Array.isArray(record.highlights) ? record.highlights.join('\n') : '',
      rules: Array.isArray(record.rules) ? record.rules.join('\n') : '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    const payload = {
      ...values,
      highlights: values.highlights ? values.highlights.split('\n').filter((s: string) => s.trim()) : [],
      rules: values.rules ? values.rules.split('\n').filter((s: string) => s.trim()) : [],
    }
    if (editItem) {
      await request.post('/growth/mall/item/save', { ...payload, id: editItem.id })
      message.success('更新成功')
    } else {
      await request.post('/growth/mall/item/save', payload)
      message.success('添加成功')
    }
    setModalOpen(false)
    loadItems(itemPage)
  }

  const handleDelete = async (id: number) => {
    await request.post('/growth/mall/item/delete', { id })
    message.success('删除成功')
    loadItems(itemPage)
  }

  const handleToggle = async (id: number, enabled: boolean) => {
    await request.post('/growth/mall/item/toggle', { id, enabled })
    message.success(enabled ? '已上架' : '已下架')
    loadItems(itemPage)
  }

  const handleOrderStatus = async (id: number, status: string) => {
    await request.post('/growth/mall/order/status', { id, status })
    message.success('状态更新成功')
    loadOrders(orderPage)
  }

  const itemColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '商品名称', dataIndex: 'title', width: 160 },
    { title: '分类', dataIndex: 'type', width: 80, render: (v: string) => <Tag color={typeColor[v]}>{v}</Tag> },
    { title: '模式', dataIndex: 'mode', width: 90, render: (v: string) => <Tag>{v === 'mix' ? '现金+积分' : '纯积分'}</Tag> },
    { title: '积分价', dataIndex: 'pricePoints', width: 80 },
    { title: '现金(฿)', dataIndex: 'cash', width: 80, render: (v: number) => v > 0 ? `฿${v}` : '-' },
    { title: '库存', dataIndex: 'stock', width: 70 },
    { title: '价值(฿)', dataIndex: 'valueBaht', width: 80, render: (v: number) => `฿${v}` },
    { title: '热度', dataIndex: 'heat', width: 70 },
    { title: '标签', dataIndex: 'tag', width: 70, render: (v: string) => v ? <Tag>{v}</Tag> : '-' },
    {
      title: '状态', dataIndex: 'enabled', width: 80,
      render: (v: boolean, r: any) => <Switch checked={v} size="small" onChange={(c) => handleToggle(r.id, c)} />
    },
    {
      title: '操作', width: 170, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Tooltip title="复制推广链接">
            <Button type="link" size="small" icon={<ShareAltOutlined />} style={{ color: '#06C755' }} onClick={() => handleShareItem(r)}>推广</Button>
          </Tooltip>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const orderColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '订单号', dataIndex: 'order_sn', width: 180 },
    { title: '用户', width: 120, render: (_: any, r: any) => r.userNick || r.mobile || `UID:${r.user_id}` },
    { title: '商品', dataIndex: 'item_title', width: 160 },
    { title: '积分', dataIndex: 'points_cost', width: 80 },
    { title: '现金(฿)', dataIndex: 'cash_cost', width: 80, render: (v: number) => v > 0 ? `฿${v}` : '-' },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: string) => {
        const s = orderStatusMap[v] || { text: v, color: 'default' }
        return <Tag color={s.color}>{s.text}</Tag>
      },
    },
    {
      title: '时间', dataIndex: 'created_at', width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作', width: 160, fixed: 'right' as const,
      render: (_: any, r: any) => {
        if (r.status === 'pending') return (
          <Space>
            <Button size="small" type="primary" onClick={() => handleOrderStatus(r.id, 'issued')}>发放</Button>
            <Button size="small" onClick={() => handleOrderStatus(r.id, 'expired')}>过期</Button>
          </Space>
        )
        if (r.status === 'issued') return (
          <Button size="small" type="primary" onClick={() => handleOrderStatus(r.id, 'used')}>核销</Button>
        )
        return <span style={{ color: '#999' }}>-</span>
      },
    },
  ]

  return (
    <div>
      <Tabs
        defaultActiveKey="items"
        onChange={(k) => { if (k === 'orders') loadOrders() }}
        items={[
          {
            key: 'items',
            label: '商品管理',
            children: (
              <Card
                title="积分商城商品"
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加商品</Button>}
              >
                <Table
                  rowKey="id"
                  columns={itemColumns}
                  dataSource={items}
                  loading={loading}
                  scroll={{ x: 1200 }}
                  pagination={{
                    current: itemPage,
                    total: itemTotal,
                    pageSize: 20,
                    showTotal: (t) => `共 ${t} 件`,
                    onChange: (p) => { setItemPage(p); loadItems(p) },
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'orders',
            label: '兑换订单',
            children: (
              <Card
                title="兑换订单"
                extra={
                  <Select
                    allowClear
                    placeholder="状态筛选"
                    style={{ width: 140 }}
                    value={orderStatus || undefined}
                    onChange={(v) => { setOrderStatus(v || ''); setTimeout(() => loadOrders(), 0) }}
                    options={[
                      { label: '待使用', value: 'pending' },
                      { label: '已发放', value: 'issued' },
                      { label: '已使用', value: 'used' },
                      { label: '已过期', value: 'expired' },
                    ]}
                  />
                }
              >
                <Table
                  rowKey="id"
                  columns={orderColumns}
                  dataSource={orders}
                  loading={orderLoading}
                  scroll={{ x: 1100 }}
                  pagination={{
                    current: orderPage,
                    total: orderTotal,
                    pageSize: 20,
                    showTotal: (t) => `共 ${t} 条`,
                    onChange: (p) => { setOrderPage(p); loadOrders(p) },
                  }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* 商品推广弹窗 */}
      <Modal
        title={<Space><ShareAltOutlined style={{ color: '#06C755' }} /><span>推广商品 — {shareItemName}</span></Space>}
        open={shareItemId !== null}
        onCancel={() => setShareItemId(null)}
        footer={null}
        width={480}
      >
        <div style={{ marginBottom: 12, fontSize: 13, color: '#555' }}>
          将此链接分享到社交媒体，用户点击后直接进入积分商城并看到该商品：
        </div>
        <Input.Group compact style={{ display: 'flex', marginBottom: 16 }}>
          <Input
            value={shareItemId ? getMallItemUrl(shareItemId) : ''}
            readOnly
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, background: '#f8f8f8' }}
          />
          <Button
            type="primary"
            icon={shareCopied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={handleCopyMallUrl}
          >
            {shareCopied ? '已复制' : '复制'}
          </Button>
        </Input.Group>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { label: 'LINE', color: '#06C755', icon: '💬', url: (u: string) => `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(u)}` },
            { label: 'Facebook', color: '#1877F2', icon: '📘', url: (u: string) => `https://www.facebook.com/sharer.php?u=${encodeURIComponent(u)}` },
            { label: 'TikTok', color: '#010101', icon: '🎵', url: null },
            { label: 'IG', color: '#E1306C', icon: '📸', url: null },
          ].map(p => (
            <Button
              key={p.label}
              style={{ borderColor: p.color + '44', color: p.color }}
              icon={<span>{p.icon}</span>}
              onClick={async () => {
                const u = shareItemId ? getMallItemUrl(shareItemId) : ''
                if (p.url) { window.open(p.url(u), '_blank') }
                else { await navigator.clipboard.writeText(u); message.success(`链接已复制，请在 ${p.label} 中粘贴`) }
              }}
            >{p.label}</Button>
          ))}
        </div>
      </Modal>

      <Modal
        title={editItem ? '编辑商品' : '添加商品'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        width={640}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="商品名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sub" label="副标题/说明">
            <Input />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <Form.Item name="thumbUrl" label="商品封面图" style={{ flex: 1, marginBottom: 0 }}>
              <MediaUploadField type="image" placeholder="上传商品封面图（详情页Hero区展示）" />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="type" label="分类" style={{ flex: 1 }}>
              <Select options={typeOptions} />
            </Form.Item>
            <Form.Item name="mode" label="兑换模式" style={{ flex: 1 }}>
              <Select options={modeOptions} />
            </Form.Item>
            <Form.Item name="thumbTone" label="色调" style={{ flex: 1 }}>
              <Select options={toneOptions} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="pricePoints" label="积分价" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="cash" label="现金价(฿)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="stock" label="库存" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="valueBaht" label="参考价值(฿)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="heat" label="热度" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="sort_order" label="排序" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="tag" label="标签" style={{ flex: 1 }}>
              <Input placeholder="爆款/热/新品/限量/秒杀" />
            </Form.Item>
            <Form.Item name="badge" label="徽章" style={{ flex: 1 }}>
              <Input placeholder="纯积分/现金+积分" />
            </Form.Item>
          </div>
          <Form.Item name="detailTitle" label="详情标题">
            <Input />
          </Form.Item>
          <Form.Item name="highlights" label="亮点（每行一条）">
            <TextArea rows={3} placeholder="每行一条亮点" />
          </Form.Item>
          <Form.Item name="rules" label="规则（每行一条）">
            <TextArea rows={3} placeholder="每行一条规则" />
          </Form.Item>
          <Form.Item name="enabled" label="上架状态" valuePropName="checked">
            <Switch checkedChildren="上架" unCheckedChildren="下架" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
