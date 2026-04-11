/**
 * 用户积分 — 积分账户列表，展开行查看流水，行内手动调账
 */
import React, { useState, useCallback, useMemo } from 'react'
import {
  Card, Table, Input, Button, Space, Tag, Row, Col,
  Modal, Form, InputNumber, Select, message, Popconfirm,
  Statistic, Descriptions, Spin,
} from 'antd'
import {
  SearchOutlined, ReloadOutlined, PlusOutlined, MinusOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'

/* ─── 工具 ──────────────────────────────────────────────────────────────── */
const REF_TYPE_MAP: Record<string, string> = {
  activity:     '活动奖励',
  invite:       '邀请好友',
  sign_in:      '每日签到',
  exchange:     '积分兑换',
  admin_adjust: '手动调账',
  manual_adjust:'手动调账',
  order:        '订单奖励',
  share:        '分享奖励',
  coupon:       '卡券兑换',
}

function fmtTime(v: string) { return v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—' }

/* ─── 展开行：该用户最近流水 ─────────────────────────────────────────────── */
function UserLedger({ userId }: { userId: string }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  React.useEffect(() => {
    ;(request.get('/growth/user/points/ledger', { params: { user_id: userId, page: 1, page_size: 10 } }) as any)
      .then((res: any) => setRows(res.data?.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div style={{ padding: '12px 0', textAlign: 'center' }}><Spin size="small" /></div>
  if (!rows.length) return <div style={{ padding: '10px 0', color: '#aaa', fontSize: 13 }}>暂无流水记录</div>

  return (
    <div style={{ padding: '6px 0 12px 32px' }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>最近 10 条流水：</div>
      <div style={{ display: 'grid', gap: 4 }}>
        {rows.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#555' }}>
            <Tag color={r.type === 'credit' ? 'green' : 'red'} style={{ minWidth: 36, textAlign: 'center', margin: 0 }}>
              {r.type === 'credit' ? '+' : '-'}{r.points}
            </Tag>
            <Tag style={{ margin: 0, fontSize: 11 }}>{REF_TYPE_MAP[r.ref_type] || r.ref_type || '—'}</Tag>
            <span style={{ flex: 1, color: '#888' }}>{r.reason || '—'}</span>
            <span style={{ color: '#aaa', whiteSpace: 'nowrap' }}>{fmtTime(r.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── 调账弹窗 ──────────────────────────────────────────────────────────── */
function AdjustModal({
  open, userId, available, onClose, onSuccess,
}: { open: boolean; userId: string; available: number; onClose: () => void; onSuccess: () => void }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  React.useEffect(() => {
    if (open) { form.resetFields(); form.setFieldsValue({ user_id: userId }) }
  }, [open, userId])

  const handleOk = async () => {
    const vals = await form.validateFields()
    setSaving(true)
    try {
      await request.post('/growth/points/adjust', {
        user_id: vals.user_id,
        type: vals.type,
        points: Number(vals.points),
        reason: vals.reason,
        operator_id: 'admin',
      })
      message.success('调账成功')
      onSuccess()
      onClose()
    } catch (e: any) {
      message.error(e?.response?.data?.msg || '调账失败')
    }
    setSaving(false)
  }

  return (
    <Modal title="手动调账" open={open} onOk={handleOk} onCancel={onClose}
      okText="确认调账" cancelText="取消" confirmLoading={saving} destroyOnHidden width={440}>
      <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
        当前可用积分：<strong style={{ color: '#1677ff', fontSize: 16 }}>{available}</strong>
      </div>
      <Form form={form} layout="vertical">
        <Form.Item name="user_id" label="用户ID" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="type" label="调账类型" rules={[{ required: true, message: '请选择类型' }]}>
              <Select options={[
                { value: 'credit', label: '➕ 加积分' },
                { value: 'debit',  label: '➖ 扣积分' },
              ]} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="points" label="积分数量" rules={[{ required: true }, { type: 'number', min: 1 }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="reason" label="调账原因" rules={[{ required: true, message: '请填写原因' }]}>
          <Input.TextArea rows={2} placeholder="必填，用于审计记录" />
        </Form.Item>
        <div style={{ color: '#999', fontSize: 12 }}>操作人：admin（当前登录账号）</div>
      </Form>
    </Modal>
  )
}

/* ─── 主页面 ─────────────────────────────────────────────────────────────── */
export default function PointsAccounts() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [expandedRows, setExpandedRows] = useState<string[]>([])

  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState<any>(null)

  const kwRef = React.useRef(keyword)
  kwRef.current = keyword

  const fetchData = useCallback(async (p: number, ps: number) => {
    setLoading(true)
    try {
      const res: any = await request.get('/growth/admin/points/accounts', {
        params: { page: p, page_size: ps, keyword: kwRef.current || undefined },
      })
      setData(res.data?.items || [])
      setTotal(res.data?.total || 0)
      setPage(p)
    } catch { setData([]); setTotal(0) }
    setLoading(false)
  }, [])

  React.useEffect(() => { fetchData(1, pageSize) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openAdjust = (record: any) => {
    setAdjustTarget(record)
    setAdjustOpen(true)
  }

  const columns = useMemo(() => [
    {
      title: '用户ID',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 180,
      ellipsis: true,
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: '总积分',
      dataIndex: 'total_points',
      key: 'total_points',
      width: 100,
      sorter: (a: any, b: any) => a.total_points - b.total_points,
      render: (v: number) => <span style={{ fontWeight: 800, fontSize: 16, color: '#1677ff' }}>{v ?? 0}</span>,
    },
    {
      title: '可用',
      dataIndex: 'available_points',
      key: 'available_points',
      width: 90,
      render: (v: number) => <Tag color="green" style={{ fontWeight: 700 }}>{v ?? 0}</Tag>,
    },
    {
      title: '待结算',
      dataIndex: 'pending_points',
      key: 'pending_points',
      width: 90,
      render: (v: number) => v > 0 ? <Tag color="orange">{v}</Tag> : <span style={{ color: '#ccc' }}>0</span>,
    },
    {
      title: '已消耗',
      dataIndex: 'consumed_points',
      key: 'consumed_points',
      width: 90,
      render: (v: number) => <span style={{ color: '#cf1322' }}>{v ?? 0}</span>,
    },
    {
      title: '已撤销',
      dataIndex: 'revoked_points',
      key: 'revoked_points',
      width: 90,
      render: (v: number) => <span style={{ color: '#999' }}>{v ?? 0}</span>,
    },
    {
      title: '最后更新',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 150,
      render: (v: string) => fmtTime(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Button size="small" type="primary" icon={<WalletOutlined />} onClick={() => openAdjust(r)}>调账</Button>
      ),
    },
  ], [openAdjust])

  const totalAvailable = data.reduce((s, r) => s + (r.available_points || 0), 0)
  const totalAll = data.reduce((s, r) => s + (r.total_points || 0), 0)

  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>用户积分</div>
        <div style={{ color: '#888', fontSize: 13 }}>查看用户积分余额，展开行可查看该用户最近流水，可手动调账</div>
      </div>

      {/* 汇总 */}
      <Row gutter={12} style={{ marginBottom: 20 }}>
        <Col xs={8}><Card size="small"><Statistic title="账户总数" value={total} /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="当页总积分" value={totalAll} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="当页可用积分" value={totalAvailable} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>

      {/* 搜索栏 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input.Search
          placeholder="搜索用户ID / LINE ID"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onSearch={() => fetchData(1, pageSize)}
          style={{ width: 280 }}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={() => fetchData(1, pageSize)}>刷新</Button>
      </div>

      <Card>
        <Table
          rowKey="user_id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 900 }}
          size="middle"
          expandable={{
            expandedRowRender: (r) => <UserLedger userId={r.user_id} />,
            expandedRowKeys: expandedRows,
            onExpand: (expanded, r) => {
              setExpandedRows(expanded
                ? [...expandedRows, r.user_id]
                : expandedRows.filter(k => k !== r.user_id))
            },
          }}
          pagination={{
            current: page, pageSize, total, showSizeChanger: true,
            showTotal: (t) => `共 ${t} 个用户`,
            pageSizeOptions: ['20', '50', '100'],
            onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
          }}
        />
      </Card>

      {adjustTarget && (
        <AdjustModal
          open={adjustOpen}
          userId={adjustTarget.user_id}
          available={adjustTarget.available_points || 0}
          onClose={() => { setAdjustOpen(false); setAdjustTarget(null) }}
          onSuccess={() => fetchData(page, pageSize)}
        />
      )}
    </div>
  )
}
