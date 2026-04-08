import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, InputNumber,
  Select, message, Switch, Tooltip, Radio, Typography, Popconfirm,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, TrophyOutlined, ReloadOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import request from '../../api/request'
import { useI18n } from '../../i18n'

const { Text } = Typography
const API_BASE = '/activity-prizes'

function resolveQueryParam(gameProgramId: string | null, activityId: string | null) {
  if (gameProgramId) return { label: `游戏玩法 #${gameProgramId}`, param: `gameProgramId=${gameProgramId}`, idField: 'game_program_id', idValue: gameProgramId }
  if (activityId)    return { label: `活动 #${activityId}`,        param: `activityId=${activityId}`,        idField: 'activity_id',    idValue: activityId }
  return null
}

function getName(obj: any): string {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj.zh || obj.en || obj.th || ''
}

const CATEGORY_OPTIONS = [
  { value: 'coupon',  label: '🎫 卡券（体验券 / 折扣券 / 积分券）' },
  { value: 'product', label: '🛍️ 商品（数字商品 / 实物商品）' },
  { value: 'thanks',  label: '🤍 谢谢参与（未中奖）' },
]

const DEFAULT_COLORS: Record<string, string> = {
  coupon:  '#1677ff',
  product: '#52c41a',
  thanks:  '#d9d9d9',
}

export default function PrizePoolManage() {
  const { t } = useI18n()
  const pp = (key: string) => t(`prizePool.${key}`)

  const [searchParams] = useSearchParams()
  const activityId    = searchParams.get('activityId')
  const gameProgramId = searchParams.get('gameProgramId')
  const resolved      = resolveQueryParam(gameProgramId, activityId)

  const [prizes, setPrizes]           = useState<any[]>([])
  const [loading, setLoading]         = useState(false)
  const [formVisible, setFormVisible] = useState(false)
  const [isEdit, setIsEdit]           = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [form]                        = Form.useForm()
  const [displayColor, setDisplayColor] = useState('#FF6B35')

  const [category, setCategory]   = useState<string>('coupon')
  const [coupons, setCoupons]     = useState<any[]>([])
  const [products, setProducts]   = useState<any[]>([])
  const [catLoading, setCatLoading] = useState(false)

  const fetchCatalog = async () => {
    setCatLoading(true)
    try {
      const [cr, mr] = await Promise.all([
        request.get('/growth/coupon/list', { params: { pageNum: 1, pageSize: 200 } }) as any,
        request.get('/growth/mall/items', { params: { pageSize: 200 } }) as any,
      ])
      setCoupons(cr.data?.rows || cr.data?.list || [])
      setProducts(mr.data?.list || [])
    } catch {}
    finally { setCatLoading(false) }
  }

  const fetchPrizes = async () => {
    setLoading(true)
    try {
      const url = resolved ? `${API_BASE}?${resolved.param}` : API_BASE
      const res: any = await request.get(url)
      setPrizes(res.data || [])
    } catch { setPrizes([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchCatalog() }, [])
  useEffect(() => { fetchPrizes() }, [activityId, gameProgramId])

  const handleAdd = () => {
    setIsEdit(false)
    setEditingId(null)
    form.resetFields()
    form.setFieldsValue({ category: 'coupon', probability_weight: 10, stock_qty: -1, sort_no: 0, status: true })
    setCategory('coupon')
    setDisplayColor(DEFAULT_COLORS['coupon'])
    fetchCatalog()
    setFormVisible(true)
  }

  const handleEdit = (r: any) => {
    setIsEdit(true)
    setEditingId(r.prize_id)
    const cat = r.prize_type === 'thanks' ? 'thanks'
              : r.prize_type === 'coupon'  ? 'coupon'
              : 'product'
    setCategory(cat)
    form.setFieldsValue({
      category:           cat,
      reward_id:          r.reward_product_id || undefined,
      display_text:       r.display_text,
      probability_weight: r.probability_weight,
      stock_qty:          r.stock_qty,
      sort_no:            r.sort_no,
      status:             r.status === 'enabled',
    })
    setDisplayColor(r.display_color || DEFAULT_COLORS[cat] || '#FF6B35')
    fetchCatalog()
    setFormVisible(true)
  }

  const handleDelete = async (r: any) => {
    try {
      await request.delete(`${API_BASE}/${r.prize_id}`)
      message.success('删除成功')
      fetchPrizes()
    } catch {
      message.error('删除失败，请重试')
    }
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const cat = values.category as string

      let prizeName = '谢谢参与'
      let prizeType = 'thanks'
      let rewardId  = ''

      if (cat === 'coupon') {
        const found = coupons.find(c => c.id === values.reward_id)
        prizeName = found ? getName(found.name) : values.reward_id
        prizeType = 'coupon'
        rewardId  = values.reward_id || ''
      } else if (cat === 'product') {
        const found = products.find(p => p.id === values.reward_id)
        prizeName = found ? getName(found.name) : values.reward_id
        prizeType = found?.item_type === 'physical' ? 'qualification' : 'digital_product'
        rewardId  = values.reward_id || ''
      }

      const payload: any = {
        ...(resolved ? { [resolved.idField]: resolved.idValue } : {}),
        prize_name:         prizeName,
        prize_type:         prizeType,
        display_text:       values.display_text || prizeName,
        display_color:      displayColor,
        reward_product_id:  rewardId,
        probability_weight: Number(values.probability_weight ?? 10),
        stock_qty:          Number(values.stock_qty ?? -1),
        sort_no:            Number(values.sort_no ?? 0),
        status:             values.status ? 'enabled' : 'disabled',
      }

      if (isEdit && editingId) {
        await request.put(`${API_BASE}/${editingId}`, payload)
        message.success(pp('updateSuccess'))
      } else {
        await request.post(API_BASE, payload)
        message.success(pp('addSuccess'))
      }
      setFormVisible(false)
      fetchPrizes()
    } catch {}
  }

  const totalProb = prizes.reduce((s, p) => s + (p.probability_weight || 0), 0)
  const probOk    = Math.abs(totalProb - 100) < 0.5

  const prizeTypeTag = (type: string) => {
    if (type === 'coupon')          return <Tag color="blue">卡券</Tag>
    if (type === 'digital_product') return <Tag color="green">数字商品</Tag>
    if (type === 'qualification')   return <Tag color="purple">实物商品</Tag>
    return <Tag color="default">谢谢参与</Tag>
  }

  const rewardLabel = (r: any) => {
    if (!r.reward_product_id) return <Text type="secondary">—</Text>
    if (r.prize_type === 'coupon') {
      const c = coupons.find(x => x.id === r.reward_product_id)
      return c ? getName(c.name) : <Text code style={{ fontSize: 11 }}>{r.reward_product_id}</Text>
    }
    const p = products.find(x => x.id === r.reward_product_id)
    return p ? getName(p.name) : <Text code style={{ fontSize: 11 }}>{r.reward_product_id}</Text>
  }

  const couponOpts  = coupons.map(c => ({ value: c.id, label: `${getName(c.name)}` }))
  const productOpts = products.map(p => ({
    value: p.id,
    label: `${getName(p.name)} [${p.item_type === 'physical' ? '实物' : '数字'}]`,
  }))

  const columns = [
    {
      title: '奖品', key: 'prize', width: 220,
      render: (_: any, r: any) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: 13 }}>{r.prize_name}</Text>
          {r.reward_product_id && <Text type="secondary" style={{ fontSize: 11 }}>{r.reward_product_id}</Text>}
        </Space>
      ),
    },
    ...(!resolved ? [{
      title: '所属玩法', key: 'gp', width: 110,
      render: (_: any, r: any) => (
        <Tag color="geekblue" style={{ fontSize: 11 }}>{r.game_program_id || r.activity_id || '—'}</Tag>
      ),
    }] : []),
    { title: '类型', dataIndex: 'prize_type', key: 'prize_type', width: 100, render: prizeTypeTag },
    {
      title: '展示', key: 'display', width: 140,
      render: (_: any, r: any) => (
        <Space>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: r.display_color || '#ccc', display: 'inline-block', flexShrink: 0 }} />
          <Text style={{ fontSize: 12 }}>{r.display_text || r.prize_name}</Text>
        </Space>
      ),
    },
    {
      title: '概率权重', dataIndex: 'probability_weight', key: 'probability_weight', width: 90,
      render: (v: number) => {
        const pct = totalProb > 0 ? ((v / totalProb) * 100).toFixed(1) : '0.0'
        return <span style={{ color: '#1677ff', fontWeight: 600 }}>{v} <Text type="secondary" style={{ fontSize: 11 }}>≈{pct}%</Text></span>
      },
    },
    {
      title: '库存', dataIndex: 'stock_qty', key: 'stock_qty', width: 70,
      render: (v: any) => v === -1 ? <Tag>∞</Tag> : <Tag color="orange">{v}</Tag>,
    },
    {
      title: '启用', dataIndex: 'status', key: 'status', width: 70,
      render: (v: string) => <Tag color={v === 'enabled' ? 'green' : 'default'}>{v === 'enabled' ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Popconfirm
            title="确认删除该奖项？"
            okText="确认"
            cancelText="取消"
            onConfirm={() => handleDelete(r)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title={<Space><TrophyOutlined />{pp('pageTitle')}{resolved ? ` — ${resolved.label}` : ' — 全部奖品'}</Space>}
      extra={
        <Space>
          <Tooltip title={`概率权重合计：${totalProb.toFixed(1)}`}>
            <Tag color={probOk ? 'green' : 'orange'}>权重合计 {totalProb.toFixed(1)}</Tag>
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={fetchPrizes}>刷新</Button>
          <Tooltip title={!resolved ? '请从游戏玩法或活动列表进入后再添加奖项' : ''}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={!resolved}>添加奖项</Button>
          </Tooltip>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={prizes}
        rowKey="prize_id"
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: '暂无奖项' }}
      />

      <Modal
        title={isEdit ? '编辑奖项' : '添加奖项'}
        open={formVisible}
        onOk={handleOk}
        onCancel={() => setFormVisible(false)}
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>

          {/* 奖品类别 */}
          <Form.Item name="category" label="奖品类别" rules={[{ required: true }]}>
            <Radio.Group
              options={CATEGORY_OPTIONS}
              optionType="button"
              buttonStyle="solid"
              onChange={e => {
                const cat = e.target.value as string
                setCategory(cat)
                setDisplayColor(DEFAULT_COLORS[cat] || '#FF6B35')
                form.setFieldsValue({ reward_id: undefined, display_text: '' })
              }}
            />
          </Form.Item>

          {/* 选卡券 */}
          {category === 'coupon' && (
            <Form.Item name="reward_id" label="选择卡券" rules={[{ required: true, message: '请选择卡券' }]}>
              <Select
                showSearch
                loading={catLoading}
                placeholder="搜索卡券名称"
                options={couponOpts}
                optionFilterProp="label"
                onChange={id => {
                  const c = coupons.find(x => x.id === id)
                  if (c) form.setFieldsValue({ display_text: getName(c.name) })
                }}
              />
            </Form.Item>
          )}

          {/* 选商品 */}
          {category === 'product' && (
            <Form.Item name="reward_id" label="选择商品" rules={[{ required: true, message: '请选择商品' }]}>
              <Select
                showSearch
                loading={catLoading}
                placeholder="搜索商品名称"
                options={productOpts}
                optionFilterProp="label"
                onChange={id => {
                  const p = products.find(x => x.id === id)
                  if (p) form.setFieldsValue({ display_text: getName(p.name) })
                }}
              />
            </Form.Item>
          )}

          {/* 转盘/刮刮卡展示文字 */}
          <Form.Item name="display_text" label="转盘 / 刮刮卡展示文字">
            <Input placeholder="留空则自动用奖品名称" />
          </Form.Item>

          {/* 展示颜色 */}
          <Form.Item label="展示颜色">
            <Space>
              <input
                type="color"
                value={displayColor}
                onChange={e => setDisplayColor(e.target.value)}
                style={{ width: 40, height: 32, border: 'none', cursor: 'pointer', borderRadius: 4 }}
              />
              <Text type="secondary" style={{ fontSize: 13 }}>{displayColor}</Text>
            </Space>
          </Form.Item>

          {/* 概率权重 */}
          <Form.Item
            name="probability_weight"
            label="中奖概率（权重值）"
            extra="各奖项权重之比即为中奖比例，例：充电券30、谢谢参与70 → 各占30%、70%"
            rules={[{ required: true, message: '请填写权重' }]}
          >
            <InputNumber min={0} max={10000} step={1} style={{ width: '60%' }} />
          </Form.Item>

          {/* 库存 */}
          <Form.Item name="stock_qty" label="库存（-1 = 不限量）">
            <InputNumber min={-1} style={{ width: '60%' }} />
          </Form.Item>

          {/* 排列顺序 */}
          <Form.Item name="sort_no" label="排列顺序（数字越小越靠前）">
            <InputNumber min={0} style={{ width: '60%' }} />
          </Form.Item>

          {/* 是否启用 */}
          <Form.Item name="status" label="是否启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
