/**
 * 积分规则管理 — 可编辑积分值、备注，可开/关每条规则
 */
import React, { useState, useEffect } from 'react'
import {
  Card, Table, Tag, Switch, Button, Modal, Form,
  InputNumber, Input, message, Tooltip, Space, Badge,
} from 'antd'
import { EditOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'

/* ─── 规则名称映射（中文硬编码）──────────────────────────────────────────── */
const RULE_LABELS: Record<string, { label: string; color: string; desc: string; unit: string }> = {
  EARN_ORDER_COMPLETE:  { label: '完成订单',   color: 'green',    desc: '用户完成共享充电宝租借订单后获得积分', unit: '积分/次' },
  EARN_SHARE_REGISTER:  { label: '分享注册',   color: 'blue',     desc: '被邀请用户通过分享链接注册后，邀请者获得积分', unit: '积分/次' },
  EARN_DAILY_CHECKIN:   { label: '每日签到',   color: 'cyan',     desc: '用户每日签到获得积分（每天限1次）', unit: '积分/次' },
  EARN_ACTIVITY:        { label: '参与活动',   color: 'purple',   desc: '用户参与指定营销活动获得积分', unit: '积分/次' },
  EARN_SHARE_FOLLOW:    { label: '分享关注',   color: 'geekblue', desc: '被邀请用户关注LINE OA后，邀请者获得积分', unit: '积分/次' },
  EARN_INVITE:          { label: '邀请好友',   color: 'volcano',  desc: '成功邀请新用户注册后获得积分', unit: '积分/次' },
  SPEND_EXCHANGE:       { label: '积分兑换',   color: 'red',      desc: '用户兑换商城商品时消耗的积分', unit: '积分/次' },
  SPEND_COUPON:         { label: '兑换卡券',   color: 'magenta',  desc: '用户使用积分兑换卡券时消耗的积分', unit: '积分/次' },
}

function getRuleMeta(ruleKey: string) {
  return RULE_LABELS[ruleKey] || { label: ruleKey, color: 'default', desc: ruleKey, unit: '积分/次' }
}

export default function PointsRuleConfig() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [editForm] = Form.useForm()

  const fetchRules = async () => {
    setLoading(true)
    try {
      const res: any = await request.get('/growth/points/rules')
      setRules(res.data?.rules || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { fetchRules() }, [])

  const handleToggle = async (rule: any, enabled: boolean) => {
    setToggling(rule.rule_id)
    try {
      await request.post('/growth/points/rules/toggle', { rule_id: rule.rule_id, enabled })
      setRules(prev => prev.map(r => r.rule_id === rule.rule_id ? { ...r, enabled } : r))
      message.success(enabled ? '规则已启用' : '规则已禁用')
    } catch { message.error('操作失败') }
    setToggling(null)
  }

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

  const columns = [
    {
      title: '规则',
      dataIndex: 'rule_type',
      key: 'rule_type',
      width: 140,
      render: (v: string) => {
        const m = getRuleMeta(v)
        return (
          <Space>
            <Tag color={m.color} style={{ borderRadius: 6, fontWeight: 600 }}>{m.label}</Tag>
            <Tooltip title={m.desc}><InfoCircleOutlined style={{ color: '#aaa', fontSize: 12 }} /></Tooltip>
          </Space>
        )
      },
    },
    {
      title: '规则ID',
      dataIndex: 'rule_id',
      key: 'rule_id',
      width: 200,
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{v}</span>,
    },
    {
      title: '积分值',
      dataIndex: 'points_value',
      key: 'points_value',
      width: 120,
      render: (v: number, r: any) => {
        const m = getRuleMeta(r.rule_type)
        return <span style={{ fontWeight: 700, color: '#1677ff', fontSize: 16 }}>{v ?? 0} <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>{m.unit}</span></span>
      },
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
      width: 155,
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
      width: 80,
      render: (_: any, r: any) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
      ),
    },
  ]

  const enabledCount = rules.filter(r => r.enabled).length

  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>积分规则</div>
          <div style={{ color: '#888', fontSize: 13 }}>
            配置用户获得/消耗积分的触发条件和积分值
            <span style={{ marginLeft: 12 }}>
              <Badge status="success" text={`${enabledCount} 条启用`} />
              <span style={{ marginLeft: 8 }}><Badge status="default" text={`${rules.length - enabledCount} 条禁用`} /></span>
            </span>
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchRules}>刷新</Button>
      </div>

      <Card>
        <Table
          rowKey="rule_id"
          columns={columns}
          dataSource={rules}
          loading={loading}
          scroll={{ x: 900 }}
          pagination={false}
          size="middle"
          rowClassName={(r) => r.enabled ? '' : 'ant-table-row-disabled'}
          style={{ opacity: 1 }}
        />
      </Card>

      <Modal
        open={editOpen}
        title={`编辑规则 — ${getRuleMeta(editRecord?.rule_type).label}`}
        onCancel={() => setEditOpen(false)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnHidden
        width={480}
      >
        <div style={{ background: '#f6f9ff', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#555' }}>
          {getRuleMeta(editRecord?.rule_type).desc}
        </div>
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="points_value"
            label="积分值"
            rules={[{ required: true, message: '请输入积分值' }, { type: 'number', min: 0, message: '积分值须 ≥ 0' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} size="large"
              addonAfter={getRuleMeta(editRecord?.rule_type).unit} />
          </Form.Item>
          <Form.Item name="description" label="说明（内部描述）">
            <Input.TextArea rows={2} placeholder="可选，用于描述规则用途" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
