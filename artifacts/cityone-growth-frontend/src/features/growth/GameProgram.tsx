import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select,
  message, Typography, DatePicker, InputNumber, Divider, Row, Col, Empty,
} from 'antd'
import {
  EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined,
  MinusCircleOutlined, ClockCircleOutlined, TrophyOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import request from '../../api/request'
import { useI18n } from '../../i18n'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

// ── 游戏类型元数据 ──────────────────────────────────────────────────────────

const GAME_TYPES = [
  { type: 'lucky_wheel',       icon: '🎡', color: '#fa8c16', bg: 'linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%)', border: '#ffd591' },
  { type: 'scratch_card',      icon: '🎴', color: '#1677ff', bg: 'linear-gradient(135deg, #e6f4ff 0%, #bae0ff 100%)', border: '#91caff' },
  { type: 'thai_fortune_draw', icon: '🏮', color: '#722ed1', bg: 'linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%)', border: '#d3adf7' },
]

const WHEEL_SLOT_OPTIONS = [4, 6, 8, 10, 12, 16]

// ── 奖品选择器子组件 ─────────────────────────────────────────────────────────

interface PrizePickerProps {
  prizeType: string
  value?: string
  onChange?: (v: string) => void
  coupons: any[]
  mallItems: any[]
}
function PrizePicker({ prizeType, value, onChange, coupons, mallItems }: PrizePickerProps) {
  if (prizeType === 'none' || !prizeType) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
  const opts =
    prizeType === 'coupon'
      ? coupons.map(c => ({ value: c.id, label: (c.name && typeof c.name === 'object') ? (c.name.zh || c.name.en || c.name.th || c.id) : (c.name || c.id) }))
      : mallItems.map(m => ({ value: m.id, label: m.name && typeof m.name === 'object' ? (m.name.zh || m.name.th || m.name.en || m.id) : (m.name || m.id) }))
  return (
    <Select
      size="small"
      style={{ width: '100%' }}
      placeholder="选择奖品"
      value={value}
      onChange={onChange}
      options={opts}
      showSearch
      optionFilterProp="label"
    />
  )
}

// ── 大转盘表单 ───────────────────────────────────────────────────────────────

interface WheelFormProps {
  form: any
  coupons: any[]
  mallItems: any[]
}
function WheelForm({ form, coupons, mallItems }: WheelFormProps) {
  const [slotCount, setSlotCount] = useState<number>(form.getFieldValue('slot_count') || 8)
  const [slotTypes, setSlotTypes] = useState<Record<number, string>>({})

  // 实时监听所有格位值，用于计算概率
  const watchedSlots: any[] = Form.useWatch('slots', form) || []
  const totalWeight = watchedSlots.reduce((sum: number, s: any) => sum + (Number(s?.weight) || 10), 0)
  const slotProb = (idx: number) => {
    const w = Number(watchedSlots[idx]?.weight) || 10
    return totalWeight > 0 ? `${((w / totalWeight) * 100).toFixed(1)}%` : '—'
  }

  useEffect(() => {
    const sc = form.getFieldValue('slot_count') || 8
    setSlotCount(sc)
    const slots: any[] = form.getFieldValue('slots') || []
    const types: Record<number, string> = {}
    slots.forEach((s: any, i: number) => { if (s?.prize_type) types[i] = s.prize_type })
    setSlotTypes(types)
  }, [form])

  const handleSlotCountChange = (v: number | null) => {
    if (!v) return
    setSlotCount(v)
    const current: any[] = form.getFieldValue('slots') || []
    const next = Array.from({ length: v }, (_, i) => current[i] || { prize_type: 'none', prize_id: undefined, qty: 1, weight: 10 })
    form.setFieldValue('slots', next)
    const types: Record<number, string> = {}
    next.forEach((s: any, i: number) => { types[i] = s.prize_type || 'none' })
    setSlotTypes(types)
  }

  const handleTypeChange = (idx: number, val: string) => {
    setSlotTypes(prev => ({ ...prev, [idx]: val }))
    const slots = [...(form.getFieldValue('slots') || [])]
    if (slots[idx]) slots[idx] = { ...slots[idx], prize_type: val, prize_id: undefined }
    form.setFieldValue('slots', slots)
  }

  return (
    <>
      <Row gutter={12}>
        <Col span={14}>
          <Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请填写名称' }]}>
            <Input placeholder="如：标准8格大转盘" />
          </Form.Item>
        </Col>
        <Col span={10}>
          <Form.Item name="code" label="编号">
            <Input placeholder="如：gp_wheel_001（选填）" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="time_range" label="有效期">
        <RangePicker showTime style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="slot_count" label="格数" initialValue={8}>
        <Select
          options={WHEEL_SLOT_OPTIONS.map(n => ({ value: n, label: `${n} 格` }))}
          onChange={handleSlotCountChange}
          style={{ width: 120 }}
        />
      </Form.Item>

      <Divider style={{ margin: '8px 0 4px' }}>奖品格位配置</Divider>
      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
        权重越大中奖概率越高，概率 = 该格权重 ÷ 所有格权重之和
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
        <Form.List name="slots">
          {(fields) => (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #f0f0f0', width: 44 }}>格位</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #f0f0f0', width: 96 }}>品类</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #f0f0f0' }}>奖品</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #f0f0f0', width: 52 }}>数量</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #f0f0f0', width: 56 }}>权重</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #f0f0f0', width: 60, color: '#389e0d' }}>概率</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: slotCount }, (_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '5px 8px', border: '1px solid #f0f0f0', color: '#667085', fontWeight: 600 }}>
                      #{i + 1}
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #f0f0f0' }}>
                      <Form.Item name={[i, 'prize_type']} noStyle initialValue="none">
                        <Select
                          size="small"
                          style={{ width: '100%' }}
                          onChange={(v) => handleTypeChange(i, v)}
                          options={[
                            { value: 'none', label: '谢谢参与' },
                            { value: 'coupon', label: '卡券' },
                            { value: 'mall_item', label: '商品' },
                          ]}
                        />
                      </Form.Item>
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #f0f0f0' }}>
                      <Form.Item name={[i, 'prize_id']} noStyle>
                        <PrizePicker
                          prizeType={slotTypes[i] || (form.getFieldValue(['slots', i, 'prize_type']) || 'none')}
                          coupons={coupons}
                          mallItems={mallItems}
                        />
                      </Form.Item>
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #f0f0f0' }}>
                      <Form.Item name={[i, 'qty']} noStyle initialValue={1}>
                        <InputNumber size="small" min={0} max={9999} style={{ width: '100%' }} />
                      </Form.Item>
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #f0f0f0' }}>
                      <Form.Item name={[i, 'weight']} noStyle initialValue={10}>
                        <InputNumber size="small" min={1} max={9999} style={{ width: '100%' }} />
                      </Form.Item>
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #f0f0f0', textAlign: 'center', fontWeight: 600, color: '#389e0d', fontSize: 12 }}>
                      {slotProb(i)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Form.List>
      </div>

      <Form.Item name="description" label="备注" style={{ marginTop: 12 }}>
        <Input.TextArea rows={2} />
      </Form.Item>
    </>
  )
}

// ── 刮刮卡表单 ───────────────────────────────────────────────────────────────

interface ScratchFormProps {
  form: any
  coupons: any[]
  mallItems: any[]
}
function ScratchForm({ form, coupons, mallItems }: ScratchFormProps) {
  const [prizeTypes, setPrizeTypes] = useState<Record<number, string>>({})

  // 实时监听奖项列表，用于计算概率
  const watchedPrizes: any[] = Form.useWatch('prizes', form) || []
  const totalWeight = watchedPrizes.reduce((sum: number, p: any) => sum + (Number(p?.weight) || 10), 0)
  const prizeProb = (idx: number) => {
    const w = Number(watchedPrizes[idx]?.weight) || 10
    return totalWeight > 0 ? `${((w / totalWeight) * 100).toFixed(1)}%` : '—'
  }

  useEffect(() => {
    const prizes: any[] = form.getFieldValue('prizes') || []
    const types: Record<number, string> = {}
    prizes.forEach((p: any, i: number) => { if (p?.prize_type) types[i] = p.prize_type })
    setPrizeTypes(types)
  }, [form])

  const handleTypeChange = (idx: number, val: string) => {
    setPrizeTypes(prev => ({ ...prev, [idx]: val }))
    const prizes = [...(form.getFieldValue('prizes') || [])]
    if (prizes[idx]) prizes[idx] = { ...prizes[idx], prize_type: val, prize_id: undefined }
    form.setFieldValue('prizes', prizes)
  }

  return (
    <>
      <Row gutter={12}>
        <Col span={14}>
          <Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请填写名称' }]}>
            <Input placeholder="如：节日刮刮卡" />
          </Form.Item>
        </Col>
        <Col span={10}>
          <Form.Item name="code" label="编号">
            <Input placeholder="如：gp_scratch_001（选填）" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="time_range" label="有效期">
        <RangePicker showTime style={{ width: '100%' }} />
      </Form.Item>

      <Divider style={{ margin: '8px 0 4px' }}>奖项设置</Divider>
      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
        权重越大中奖概率越高，概率 = 该奖权重 ÷ 所有奖权重之和
      </div>
      <Form.List name="prizes" initialValue={[{ prize_type: 'none', qty: 1, weight: 10 }]}>
        {(fields, { add, remove }) => (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #f0f0f0' }}>奖项名称</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #f0f0f0', width: 88 }}>品类</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #f0f0f0' }}>奖品</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #f0f0f0', width: 52 }}>数量</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #f0f0f0', width: 56 }}>权重</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #f0f0f0', width: 60, color: '#389e0d' }}>概率</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #f0f0f0', width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {fields.map(({ key, name }) => (
                  <tr key={key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '5px 8px', border: '1px solid #f0f0f0' }}>
                      <Form.Item name={[name, 'label']} noStyle>
                        <Input size="small" placeholder="奖项名称" />
                      </Form.Item>
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #f0f0f0' }}>
                      <Form.Item name={[name, 'prize_type']} noStyle initialValue="none">
                        <Select
                          size="small"
                          style={{ width: '100%' }}
                          onChange={(v) => handleTypeChange(name, v)}
                          options={[
                            { value: 'none', label: '谢谢参与' },
                            { value: 'coupon', label: '卡券' },
                            { value: 'mall_item', label: '商品' },
                          ]}
                        />
                      </Form.Item>
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #f0f0f0' }}>
                      <Form.Item name={[name, 'prize_id']} noStyle>
                        <PrizePicker
                          prizeType={prizeTypes[name] || (form.getFieldValue(['prizes', name, 'prize_type']) || 'none')}
                          coupons={coupons}
                          mallItems={mallItems}
                        />
                      </Form.Item>
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #f0f0f0' }}>
                      <Form.Item name={[name, 'qty']} noStyle initialValue={1}>
                        <InputNumber size="small" min={0} max={9999} style={{ width: '100%' }} />
                      </Form.Item>
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #f0f0f0' }}>
                      <Form.Item name={[name, 'weight']} noStyle initialValue={10}>
                        <InputNumber size="small" min={1} max={9999} style={{ width: '100%' }} />
                      </Form.Item>
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #f0f0f0', textAlign: 'center', fontWeight: 600, color: '#389e0d', fontSize: 12 }}>
                      {prizeProb(name)}
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                      {fields.length > 1 && (
                        <MinusCircleOutlined
                          style={{ color: '#ff4d4f', cursor: 'pointer' }}
                          onClick={() => remove(name)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => add({ prize_type: 'none', qty: 1, weight: 10 })}
              size="small"
              style={{ marginTop: 8, width: '100%' }}
            >
              添加奖项
            </Button>
          </>
        )}
      </Form.List>

      <Form.Item name="description" label="备注" style={{ marginTop: 12 }}>
        <Input.TextArea rows={2} />
      </Form.Item>
    </>
  )
}

// ── 祈福求签占位 ─────────────────────────────────────────────────────────────

function FortuneDrawPlaceholder() {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🏮</div>
      <Title level={4} style={{ color: '#722ed1', marginBottom: 8 }}>祈福求签</Title>
      <Text type="secondary" style={{ fontSize: 14 }}>
        应用程序暂未接入，源码接入后将开放配置。
      </Text>
      <br />
      <Tag color="purple" style={{ marginTop: 16, padding: '4px 14px', fontSize: 13 }}>
        源码待接入 · 占位中
      </Tag>
    </div>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

export default function GameProgram() {
  const { t } = useI18n()
  const gp = (key: string) => t(`gameProgram.${key}`)
  const navigate = useNavigate()

  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [programs, setPrograms] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [formVisible, setFormVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [coupons, setCoupons] = useState<any[]>([])
  const [mallItems, setMallItems] = useState<any[]>([])

  // 拉取奖品数据源
  useEffect(() => {
    ;(request.get('/growth/coupon/list', { params: { pageNum: 1, pageSize: 100 } }) as any)
      .then((res: any) => setCoupons((res.data as any)?.rows || (res.data as any)?.list || []))
      .catch(() => {})
    ;(request.get('/growth/mall/items', { params: { pageSize: 100 } }) as any)
      .then((res: any) => setMallItems((res.data as any)?.list || []))
      .catch(() => {})
  }, [])

  const fetchPrograms = useCallback(async (type: string) => {
    setLoading(true)
    try {
      const res: any = await request.get('/game-programs', { params: { type } })
      setPrograms((res.data as any[]) || [])
    } catch { setPrograms([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (selectedType && selectedType !== 'thai_fortune_draw') fetchPrograms(selectedType)
  }, [selectedType, fetchPrograms])

  const handleBack = () => { setSelectedType(null); setPrograms([]) }

  const handleAdd = () => {
    setIsEdit(false); setEditingId(null)
    form.resetFields()
    if (selectedType === 'lucky_wheel') {
      form.setFieldsValue({ slot_count: 8, slots: Array.from({ length: 8 }, () => ({ prize_type: 'none', prize_id: undefined, qty: 1, weight: 10 })) })
    } else if (selectedType === 'scratch_card') {
      form.setFieldsValue({ prizes: [{ label: '', prize_type: 'none', prize_id: undefined, qty: 1, weight: 10 }] })
    }
    setFormVisible(true)
  }

  const handleEdit = (record: any) => {
    setIsEdit(true); setEditingId(record.id)
    const base: any = {
      name: record.name,
      code: record.code,
      description: record.description,
    }
    if (record.start_time && record.end_time) {
      base.time_range = [dayjs(record.start_time), dayjs(record.end_time)]
    }
    if (selectedType === 'lucky_wheel') {
      base.slot_count = record.slot_count || 8
      const rawSlots = record.slots || Array.from({ length: base.slot_count }, () => ({ prize_type: 'none', qty: 1, weight: 10 }))
      base.slots = rawSlots.map((s: any) => ({ weight: 10, ...s }))
    } else if (selectedType === 'scratch_card') {
      const rawPrizes = record.prizes || [{ label: '', prize_type: 'none', qty: 1, weight: 10 }]
      base.prizes = rawPrizes.map((p: any) => ({ weight: 10, ...p }))
    }
    form.setFieldsValue(base)
    setFormVisible(true)
  }

  const handleDelete = (record: any) => {
    Modal.confirm({
      title: gp('btnDelete'),
      content: gp('confirmDelete'),
      okType: 'danger',
      onOk: async () => {
        try {
          await request.delete(`/game-programs/${record.id}`)
          message.success(gp('deleteSuccess'))
          if (selectedType) fetchPrograms(selectedType)
        } catch { message.error(gp('deleteFail')) }
      },
    })
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const payload: any = {
        type: selectedType,
        name: values.name,
        code: values.code || undefined,
        description: values.description,
        status: 'active',
      }
      if (values.time_range?.length === 2) {
        payload.start_time = values.time_range[0].toISOString()
        payload.end_time = values.time_range[1].toISOString()
      }
      if (selectedType === 'lucky_wheel') {
        payload.slot_count = values.slot_count || 8
        payload.slots = (values.slots || []).slice(0, payload.slot_count)
      } else if (selectedType === 'scratch_card') {
        payload.prizes = values.prizes || []
      }
      if (isEdit && editingId) {
        await request.put(`/game-programs/${editingId}`, payload)
      } else {
        await request.post('/game-programs', payload)
      }
      message.success(gp('saveSuccess'))
      setFormVisible(false)
      if (selectedType) fetchPrograms(selectedType)
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(gp('saveFail'))
    }
  }

  const selectedMeta = GAME_TYPES.find(g => g.type === selectedType)
  const typeLabel = selectedType === 'lucky_wheel' ? gp('typeWheel') : selectedType === 'scratch_card' ? gp('typeScratch') : gp('typeFortune')

  const formatTime = (t?: string) => t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '—'

  const columns = [
    {
      title: gp('colNo'), dataIndex: 'id', key: 'id', width: 130,
      render: (v: string, r: any) => (
        <div>
          <Text code style={{ fontSize: 12 }}>{r.code || v}</Text>
        </div>
      ),
    },
    { title: gp('colName'), dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    {
      title: '有效期', key: 'time', width: 200,
      render: (_: any, r: any) => r.start_time
        ? <Text style={{ fontSize: 12 }}><ClockCircleOutlined style={{ marginRight: 4, color: '#667085' }} />{formatTime(r.start_time)} ~ {formatTime(r.end_time)}</Text>
        : <Text type="secondary" style={{ fontSize: 12 }}>未设置</Text>,
    },
    {
      title: selectedType === 'lucky_wheel' ? '格数' : '奖项数', key: 'slots', width: 70,
      render: (_: any, r: any) => {
        if (selectedType === 'lucky_wheel') return <Tag color="orange">{r.slot_count || '—'} 格</Tag>
        if (selectedType === 'scratch_card') return <Tag color="blue">{(r.prizes || []).length} 项</Tag>
        return '—'
      },
    },
    {
      title: gp('colStatus'), dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? gp('statusOn') : gp('statusOff')}</Tag>,
    },
    {
      title: gp('colAction'), key: 'action', width: 200,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="link" size="small" icon={<TrophyOutlined />}
            onClick={() => navigate(`/admin/growth/prize-pool?gameProgramId=${record.id}`)}
          >配置奖池</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>{gp('btnEdit')}</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>{gp('btnDelete')}</Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '16px 20px' }}>
      {!selectedType ? (
        <>
          <div style={{ marginBottom: 20 }}>
            <Title level={4} style={{ margin: 0 }}>{gp('title')}</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>{gp('subtitle')}</Text>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {GAME_TYPES.map(gt => (
              <Card
                key={gt.type}
                hoverable
                onClick={() => setSelectedType(gt.type)}
                style={{ background: gt.bg, border: `1.5px solid ${gt.border}`, borderRadius: 16, cursor: 'pointer' }}
                styles={{ body: { padding: '24px 20px' } }}
              >
                <div style={{ fontSize: 48, marginBottom: 12, textAlign: 'center' }}>{gt.icon}</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: gt.color, marginBottom: 6 }}>
                    {gt.type === 'lucky_wheel' ? gp('typeWheel') : gt.type === 'scratch_card' ? gp('typeScratch') : gp('typeFortune')}
                  </div>
                  <div style={{ fontSize: 13, color: '#667085' }}>
                    {gt.type === 'lucky_wheel' ? gp('descWheel') : gt.type === 'scratch_card' ? gp('descScratch') : gp('descFortune')}
                  </div>
                </div>
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  {gt.type === 'thai_fortune_draw'
                    ? <Tag color="purple" style={{ fontSize: 12 }}>源码待接入</Tag>
                    : <Button type="primary" size="small" style={{ background: gt.color, borderColor: gt.color }}>{gp('selectType')} →</Button>
                  }
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : selectedType === 'thai_fortune_draw' ? (
        <>
          <div style={{ marginBottom: 16 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>{gp('backToTypes')}</Button>
          </div>
          <Card><FortuneDrawPlaceholder /></Card>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>{gp('backToTypes')}</Button>
            <span style={{ fontSize: 16, fontWeight: 700, color: selectedMeta?.color }}>
              {selectedMeta?.icon} {typeLabel} {gp('programsOf')}
            </span>
          </div>
          <Card>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{gp('btnAdd')}</Button>
            </div>
            <Table
              rowKey="id"
              dataSource={programs}
              columns={columns}
              loading={loading}
              pagination={false}
              locale={{ emptyText: gp('emptyText') }}
              size="middle"
            />
          </Card>

          <Modal
            open={formVisible}
            title={isEdit ? gp('modalEdit') : gp('modalAdd')}
            onOk={handleOk}
            onCancel={() => setFormVisible(false)}
            destroyOnClose
            width={680}
            styles={{ body: { maxHeight: '72vh', overflowY: 'auto' } }}
          >
            <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
              {selectedType === 'lucky_wheel' && (
                <WheelForm form={form} coupons={coupons} mallItems={mallItems} />
              )}
              {selectedType === 'scratch_card' && (
                <ScratchForm form={form} coupons={coupons} mallItems={mallItems} />
              )}
            </Form>
          </Modal>
        </>
      )}
    </div>
  )
}
