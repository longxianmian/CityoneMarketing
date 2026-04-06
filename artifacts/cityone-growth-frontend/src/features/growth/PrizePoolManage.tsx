import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, message, Switch, Divider, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, TrophyOutlined, ReloadOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import request from '../../api/request'
import MediaUploadField from '../../components/MediaUploadField'
import { useI18n } from '../../i18n'

const API_BASE = '/api/activity-prizes'

const PRIZE_TYPES = [
  { value: 'thanks',          labelKey: 'typeEmpty' },
  { value: 'digital_product', labelKey: 'typeCoupon' },
  { value: 'coupon',          labelKey: 'typeCoupon' },
  { value: 'points',          labelKey: 'typePoints' },
  { value: 'qualification',   labelKey: 'typePhysical' },
]

export default function PrizePoolManage() {
  const { t } = useI18n()
  const pp = (key: string) => t(`prizePool.${key}`)

  const prizeTypeOptions = PRIZE_TYPES.map(p => ({ value: p.value, label: `${p.value} · ${pp(p.labelKey)}` }))

  const [searchParams] = useSearchParams()
  const activityId = searchParams.get('activityId')
  const [prizes, setPrizes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [formVisible, setFormVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [displayColor, setDisplayColor] = useState('#FF6B35')

  const fetchPrizes = async () => {
    if (!activityId) { setPrizes([]); return }
    setLoading(true)
    try {
      const res: any = await request.get(`${API_BASE}?activityId=${activityId}`)
      setPrizes(res.data || [])
    } catch { setPrizes([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPrizes() }, [activityId])

  const handleAdd = () => {
    setIsEdit(false)
    setEditingId(null)
    form.resetFields()
    form.setFieldsValue({ prize_type: 'thanks', probability_weight: 10, stock_qty: -1, sort_no: 0, status: 'enabled' })
    setDisplayColor('#FF6B35')
    setFormVisible(true)
  }

  const handleEdit = (r: any) => {
    setIsEdit(true)
    setEditingId(r.prize_id)
    form.setFieldsValue({
      prize_name: r.prize_name,
      prize_type: r.prize_type,
      display_text: r.display_text,
      reward_product_id: r.reward_product_id,
      probability_weight: r.probability_weight,
      stock_qty: r.stock_qty,
      sort_no: r.sort_no,
      status: r.status === 'enabled',
    })
    setDisplayColor(r.display_color || '#FF6B35')
    setFormVisible(true)
  }

  const handleDelete = (r: any) => {
    Modal.confirm({
      title: pp('deleteConfirm'),
      onOk: async () => {
        try {
          await request.delete(`${API_BASE}/${r.prize_id}`)
          message.success(pp('deleteSuccess'))
          fetchPrizes()
        } catch { message.error(pp('deleteError')) }
      },
    })
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const payload: any = {
        activity_id: activityId,
        prize_name: values.prize_name,
        prize_type: values.prize_type,
        display_text: values.display_text || values.prize_name,
        display_color: displayColor,
        reward_product_id: values.reward_product_id || '',
        probability_weight: Number(values.probability_weight ?? 10),
        stock_qty: Number(values.stock_qty ?? -1),
        sort_no: Number(values.sort_no ?? 0),
        status: values.status ? 'enabled' : 'disabled',
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
  const probOk = Math.abs(totalProb - 100) < 0.5

  const prizeTypeLabel = (type: string) => {
    const found = PRIZE_TYPES.find(p => p.value === type)
    return found ? pp(found.labelKey) : type
  }

  const columns = [
    { title: pp('colName'), dataIndex: 'prize_name', key: 'prize_name', width: 160 },
    { title: pp('colType'), dataIndex: 'prize_type', key: 'prize_type', width: 120, render: (v: string) => prizeTypeLabel(v) },
    { title: '展示文字', dataIndex: 'display_text', key: 'display_text', width: 120, render: (v: string, r: any) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 14, height: 14, borderRadius: 3, background: r.display_color || '#ccc', display: 'inline-block', flexShrink: 0 }} />
        {v}
      </span>
    )},
    { title: pp('colProb'), dataIndex: 'probability_weight', key: 'probability_weight', width: 120, render: (v: number) => <span style={{ color: '#1677ff', fontWeight: 500 }}>{v}</span> },
    { title: pp('colStock'), dataIndex: 'stock_qty', key: 'stock_qty', width: 100, render: (v: any) => v === -1 ? pp('stockUnlimited') : v },
    { title: pp('colEnabled'), dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={v === 'enabled' ? 'green' : 'default'}>{v === 'enabled' ? pp('statusEnabled') : pp('statusDisabled')}</Tag> },
    {
      title: pp('colAction'), key: 'action', width: 140,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>{pp('actionEdit')}</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)}>{pp('actionDelete')}</Button>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title={<Space><TrophyOutlined />{pp('pageTitle')}{activityId ? ` — #${activityId}` : ` (${pp('enterFromList')})`}</Space>}
      extra={
        <Space>
          <Tooltip title={`${pp('probTotal')}：${totalProb.toFixed(1)}`}>
            <Tag color={probOk ? 'green' : 'orange'}>{pp('probTotal')} {totalProb.toFixed(1)}</Tag>
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={fetchPrizes}>{pp('refreshBtn')}</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={!activityId}>{pp('addBtn')}</Button>
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
        locale={{ emptyText: activityId ? '暂无奖项，点击右上角添加' : pp('enterFromList') }}
      />

      <Modal
        title={isEdit ? pp('modalEdit') : pp('modalAdd')}
        open={formVisible}
        onOk={handleOk}
        onCancel={() => setFormVisible(false)}
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="prize_name" label={pp('formName')} rules={[{ required: true, message: '请填写奖项名称' }]}>
            <Input placeholder={pp('formNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="prize_type" label={pp('formType')} rules={[{ required: true }]}>
            <Select options={prizeTypeOptions} placeholder={pp('formTypePlaceholder')} />
          </Form.Item>
          <Form.Item name="display_text" label="转盘/刮刮卡展示文字">
            <Input placeholder="留空则与奖项名称相同" />
          </Form.Item>
          <Form.Item label="展示颜色">
            <Space>
              <input type="color" value={displayColor} onChange={e => setDisplayColor(e.target.value)} style={{ width: 40, height: 32, border: 'none', cursor: 'pointer' }} />
              <span style={{ color: '#999', fontSize: 13 }}>{displayColor}</span>
            </Space>
          </Form.Item>
          <Form.Item name="reward_product_id" label="绑定数字商品 ID（可选）">
            <Input placeholder="digital_product 类型时填写商品ID，其余留空" />
          </Form.Item>
          <Form.Item name="probability_weight" label={pp('formProb')} rules={[{ required: true, message: pp('formProbRequired') }]}>
            <InputNumber min={0} max={10000} step={1} style={{ width: '100%' }} addonAfter="（权重值，所有奖项合计不限于100）" />
          </Form.Item>
          <Form.Item name="stock_qty" label={pp('formStock')}>
            <InputNumber min={-1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sort_no" label={pp('formSort')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label={pp('formEnabled')} valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
