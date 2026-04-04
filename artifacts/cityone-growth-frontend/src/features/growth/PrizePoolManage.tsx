import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, message, Switch, Divider, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, TrophyOutlined, ReloadOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import request from '../../api/request'
import MediaUploadField from '../../components/MediaUploadField'

const PRIZE_TYPES = [
  { value: 'coupon', label: '卡券' },
  { value: 'points', label: '积分' },
  { value: 'cash', label: '现金红包' },
  { value: 'physical', label: '实物奖品' },
  { value: 'empty', label: '未中奖' },
]

export default function PrizePoolManage() {
  const [searchParams] = useSearchParams()
  const activityId = searchParams.get('activityId')
  const [prizes, setPrizes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [formVisible, setFormVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [editingId, setEditingId] = useState<any>(null)
  const [form] = Form.useForm()
  const [coverImage, setCoverImage] = useState('')

  const fetchPrizes = async () => {
    if (!activityId) { setPrizes([]); return }
    setLoading(true)
    try {
      const res: any = await request.get(`/api/activities/${activityId}/prizes`)
      setPrizes(res.data || [])
    } catch {
      setPrizes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPrizes() }, [activityId])

  const handleAdd = () => {
    setIsEdit(false); setEditingId(null)
    form.resetFields(); setCoverImage('')
    setFormVisible(true)
  }

  const handleEdit = (r: any) => {
    setIsEdit(true); setEditingId(r.id)
    form.setFieldsValue(r); setCoverImage(r.coverImage || '')
    setFormVisible(true)
  }

  const handleDelete = (r: any) => {
    Modal.confirm({
      title: '确认删除该奖项？',
      onOk: async () => {
        try {
          await request.delete(`/api/activities/${activityId}/prizes/${r.id}`)
          message.success('删除成功'); fetchPrizes()
        } catch { message.error('删除失败') }
      },
    })
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const payload = { ...values, coverImage }
      if (isEdit) {
        await request.put(`/api/activities/${activityId}/prizes/${editingId}`, payload)
        message.success('更新成功')
      } else {
        await request.post(`/api/activities/${activityId}/prizes`, payload)
        message.success('添加成功')
      }
      setFormVisible(false); fetchPrizes()
    } catch {}
  }

  const totalProb = prizes.reduce((s, p) => s + (p.probability || 0), 0)

  const columns = [
    { title: '奖项名称', dataIndex: 'name', key: 'name', width: 160 },
    { title: '奖励类型', dataIndex: 'prizeType', key: 'prizeType', width: 100,
      render: (v: string) => PRIZE_TYPES.find(t => t.value === v)?.label || v },
    { title: '奖励值', dataIndex: 'prizeValue', key: 'prizeValue', width: 120,
      render: (v: any, r: any) => r.prizeType === 'empty' ? '—' : v },
    { title: '中奖概率 (%)', dataIndex: 'probability', key: 'probability', width: 120,
      render: (v: number) => <span style={{ color: '#1677ff', fontWeight: 500 }}>{v}%</span> },
    { title: '库存', dataIndex: 'stock', key: 'stock', width: 100,
      render: (v: any) => v === -1 ? '不限' : v },
    { title: '启用', dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '禁用'}</Tag> },
    { title: '操作', key: 'action', width: 120,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)}>删除</Button>
        </Space>
      ) },
  ]

  return (
    <Card
      title={<Space><TrophyOutlined />奖池管理{activityId ? ` — 活动 #${activityId}` : '（请从活动列表进入）'}</Space>}
      extra={
        <Space>
          <Tooltip title={`概率合计：${totalProb.toFixed(1)}%`}>
            <Tag color={Math.abs(totalProb - 100) < 0.1 ? 'green' : 'orange'}>概率合计 {totalProb.toFixed(1)}%</Tag>
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={fetchPrizes}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={!activityId}>添加奖项</Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={prizes}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: activityId ? '暂无奖项' : '请通过活动列表进入奖池管理' }}
      />

      <Modal
        title={isEdit ? '编辑奖项' : '添加奖项'}
        open={formVisible}
        onOk={handleOk}
        onCancel={() => setFormVisible(false)}
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="奖项名称" rules={[{ required: true }]}>
            <Input placeholder="如：一等奖·5分钟免费时长" />
          </Form.Item>
          <Form.Item name="prizeType" label="奖励类型" rules={[{ required: true }]}>
            <Select options={PRIZE_TYPES} placeholder="选择奖励类型" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.prizeType !== c.prizeType}>
            {({ getFieldValue }) => getFieldValue('prizeType') !== 'empty' && (
              <Form.Item name="prizeValue" label="奖励值（积分填数字，卡券填券ID，现金填金额）" rules={[{ required: true }]}>
                <Input placeholder="填写对应奖励标识" />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="probability" label="中奖概率（%）" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stock" label="库存（-1 = 不限量）">
            <InputNumber min={-1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排列顺序（数字越小越靠前）">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>展示素材（可选）</Divider>
          <Form.Item label="奖项图片">
            <MediaUploadField type="image" value={coverImage} onChange={setCoverImage} placeholder="上传奖项图片（转盘展示用）" />
          </Form.Item>
          <Form.Item name="enabled" label="是否启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
