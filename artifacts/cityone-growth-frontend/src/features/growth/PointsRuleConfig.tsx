/**
 * 积分规则管理 — 统一展示所有积分获取/消耗规则（消费/邀请/关注OA等并列）
 * 支持新建、编辑积分值、开/关、删除
 */
import React, { useState, useEffect } from 'react'
import {
  Card, Table, Tag, Switch, Button, Modal, Form, Select,
  InputNumber, Input, message, Tooltip, Space, Badge, Popconfirm,
} from 'antd'
import {
  EditOutlined, PlusOutlined, DeleteOutlined,
  InfoCircleOutlined, ReloadOutlined,
} from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'

/* ─── 预置规则类型（新建时下拉可选）─────────────────────────────────────── */
const RULE_OPTIONS = [
  { value: 'charge_consumption',   label: '消费充电积分',   desc: '用户充电实付金额获得积分（1 THB = N 积分）' },
  { value: 'invite_friend',        label: '邀请好友积分',   desc: '邀请者成功带来新用户，邀请者获得积分奖励' },
  { value: 'share_follow',         label: '好友关注OA积分', desc: '被分享用户关注 LINE OA 后，邀请者获得积分' },
  { value: 'follow_oa',            label: '关注OA积分',     desc: '用户首次关注 LINE OA 获得积分奖励' },
  { value: 'daily_checkin',        label: '每日签到积分',   desc: '用户每日签到获得积分（每天限 1 次）' },
  { value: 'activity_participate', label: '参与活动积分',   desc: '用户参与指定营销活动获得积分' },
  { value: 'order_complete',       label: '完成订单积分',   desc: '用户完成共享充电宝租借订单后获得积分' },
  { value: 'mall_exchange',        label: '积分兑换（消耗）', desc: '用户兑换商城商品时消耗的积分' },
  { value: 'coupon_exchange',      label: '兑换卡券（消耗）', desc: '用户使用积分兑换卡券时消耗的积分' },
]

const RULE_MAP = Object.fromEntries(RULE_OPTIONS.map(r => [r.value, r]))

const TYPE_COLORS: Record<string, string> = {
  charge_consumption:   'green',
  invite_friend:        'volcano',
  share_follow:         'geekblue',
  follow_oa:            'cyan',
  daily_checkin:        'cyan',
  activity_participate: 'purple',
  order_complete:       'lime',
  mall_exchange:        'red',
  coupon_exchange:      'magenta',
}

function getRuleMeta(ruleType: string) {
  return RULE_MAP[ruleType] || { label: ruleType, desc: ruleType }
}
function getRuleColor(ruleType: string) {
  return TYPE_COLORS[ruleType] || 'default'
}

export default function PointsRuleConfig() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 编辑
  const [editRecord, setEditRecord] = useState<any>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm] = Form.useForm()

  // 新建
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm] = Form.useForm()

  // 开关
  const [toggling, setToggling] = useState<string | null>(null)

  const fetchRules = async () => {
    setLoading(true)
    try {
      const res: any = await request.get('/growth/points/rules')
      setRules(res.data?.rules || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { fetchRules() }, [])

  /* ── 开关 ── */
  const handleToggle = async (rule: any, enabled: boolean) => {
    setToggling(rule.rule_id)
    try {
      await request.post('/growth/points/rules/toggle', { rule_id: rule.rule_id, enabled })
      setRules(prev => prev.map(r => r.rule_id === rule.rule_id ? { ...r, enabled } : r))
      message.success(enabled ? '规则已启用' : '规则已禁用')
    } catch { message.error('操作失败') }
    setToggling(null)
  }

  /* ── 编辑 ── */
  const openEdit = (rule: any) => {
    setEditRecord(rule)
    editForm.setFieldsValue({ points_value: rule.points_value, description: rule.description || '' })
    setEditOpen(true)
  }
  const handleSave = async () => {
    const vals = await editForm.validateFields()
    setSaving(true)
    try {
      await request.post('/growth/points/rules/update', {
        rule_id: editRecord.rule_id,
        points_value: vals.points_value,
        description: vals.description || '',
      })
      message.success('已保存')
      setEditOpen(false)
      fetchRules()
    } catch { message.error('保存失败') }
    setSaving(false)
  }

  /* ── 新建 ── */
  const handleCreate = async () => {
    const vals = await createForm.validateFields()
    setCreating(true)
    try {
      await request.post('/growth/points/rules/create', {
        rule_type:    vals.rule_type,
        points_value: vals.points_value,
        description:  vals.description || '',
        enabled:      true,
      })
      message.success('规则已创建')
      setCreateOpen(false)
      createForm.resetFields()
      fetchRules()
    } catch (e: any) {
      message.error(e?.message || '创建失败')
    }
    setCreating(false)
  }

  /* ── 删除 ── */
  const handleDelete = async (rule_id: string) => {
    try {
      await request.post('/growth/points/rules/delete', { rule_id })
      message.success('已删除')
      setRules(prev => prev.filter(r => r.rule_id !== rule_id))
    } catch { message.error('删除失败') }
  }

  /* ── 已用 rule_type 集合（新建时排除已有类型）── */
  const usedTypes = new Set(rules.map(r => r.rule_type))

  const columns = [
    {
      title: '规则类型',
      dataIndex: 'rule_type',
      key: 'rule_type',
      width: 160,
      render: (v: string) => {
        const m = getRuleMeta(v)
        return (
          <Space>
            <Tag color={getRuleColor(v)} style={{ borderRadius: 6, fontWeight: 600 }}>{m.label}</Tag>
            <Tooltip title={m.desc}><InfoCircleOutlined style={{ color: '#bbb', fontSize: 12 }} /></Tooltip>
          </Space>
        )
      },
    },
    {
      title: '积分值',
      dataIndex: 'points_value',
      key: 'points_value',
      width: 110,
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: '#1677ff', fontSize: 16 }}>
          {v ?? 0}
          <span style={{ fontSize: 11, color: '#999', fontWeight: 400, marginLeft: 4 }}>分/次</span>
        </span>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      render: (v: string) => v ? dayjs(v).format('MM-DD HH:mm') : '—',
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 90,
      render: (v: boolean, r: any) => (
        <Switch
          checked={!!v}
          loading={toggling === r.rule_id}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          onChange={(checked) => handleToggle(r, checked)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 110,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm
            title="确认删除这条规则？"
            onConfirm={() => handleDelete(r.rule_id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const enabledCount = rules.filter(r => r.enabled).length

  return (
    <div style={{ padding: '24px 20px' }}>
      {/* 页头 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>积分规则</div>
          <div style={{ color: '#888', fontSize: 13 }}>
            配置所有积分获取与消耗规则，包括消费充电、邀请好友、关注OA等
            <span style={{ marginLeft: 12 }}>
              <Badge status="success" text={`${enabledCount} 条启用`} />
              <span style={{ marginLeft: 8 }}><Badge status="default" text={`${rules.length - enabledCount} 条禁用`} /></span>
            </span>
          </div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchRules}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true) }}>
            新建规则
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          rowKey="rule_id"
          columns={columns}
          dataSource={rules}
          loading={loading}
          scroll={{ x: 820 }}
          pagination={false}
          size="middle"
        />
      </Card>

      {/* ── 编辑弹窗 ── */}
      <Modal
        open={editOpen}
        title={`编辑规则 — ${getRuleMeta(editRecord?.rule_type).label}`}
        onCancel={() => setEditOpen(false)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnHidden
        width={460}
      >
        <div style={{ background: '#f6f9ff', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#555' }}>
          {getRuleMeta(editRecord?.rule_type).desc}
        </div>
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="points_value"
            label="积分值（分/次）"
            rules={[{ required: true, message: '请输入积分值' }, { type: 'number', min: 0, message: '须 ≥ 0' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} size="large" addonAfter="分/次" />
          </Form.Item>
          <Form.Item name="description" label="说明（内部备注）">
            <Input.TextArea rows={2} placeholder="可选，说明规则用途" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── 新建弹窗 ── */}
      <Modal
        open={createOpen}
        title="新建积分规则"
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        destroyOnHidden
        width={460}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="rule_type"
            label="规则类型"
            rules={[{ required: true, message: '请选择规则类型' }]}
          >
            <Select
              placeholder="选择规则类型"
              showSearch
              optionFilterProp="label"
              options={RULE_OPTIONS.filter(o => !usedTypes.has(o.value)).map(o => ({
                value: o.value,
                label: o.label,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="points_value"
            label="积分值（分/次）"
            rules={[{ required: true, message: '请输入积分值' }, { type: 'number', min: 0, message: '须 ≥ 0' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} addonAfter="分/次" />
          </Form.Item>
          <Form.Item name="description" label="说明（内部备注）">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
