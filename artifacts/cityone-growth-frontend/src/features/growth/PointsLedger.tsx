/**
 * 积分流水 — 全量流水总览（所有用户），可按用户/类型/来源/日期过滤，支持手动调账
 */
import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Tag, Row, Col, Modal, Form, message, InputNumber, Select, DatePicker, Statistic } from 'antd'
import { SearchOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'

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

const REF_TYPE_OPTIONS = Object.entries(REF_TYPE_MAP).map(([k, v]) => ({ value: k, label: v }))

export default function PointsLedger() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [userId, setUserId] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [refTypeFilter, setRefTypeFilter] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<any>(null)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustForm] = Form.useForm()
  const [adjustSaving, setAdjustSaving] = useState(false)

  const filtersRef = React.useRef({ userId, typeFilter, refTypeFilter, dateRange })
  filtersRef.current = { userId, typeFilter, refTypeFilter, dateRange }

  const fetchData = useCallback(async (p: number, ps: number) => {
    setLoading(true)
    try {
      const { userId: uid, typeFilter: tf, refTypeFilter: rf, dateRange: dr } = filtersRef.current
      const params: any = { page: p, page_size: ps }
      if (uid) params.user_id = uid
      if (tf) params.type = tf
      if (rf) params.ref_type = rf
      if (dr?.[0]) params.start_date = dr[0].toISOString()
      if (dr?.[1]) params.end_date = dr[1].toISOString()
      const res: any = await request.get('/growth/user/points/ledger', { params })
      setData(res.data?.items || [])
      setTotal(res.data?.total || 0)
      setPage(p)
    } catch { setData([]); setTotal(0) }
    setLoading(false)
  }, [])

  React.useEffect(() => { fetchData(1, pageSize) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = useCallback(() => {
    setUserId(''); setTypeFilter(undefined); setRefTypeFilter(undefined); setDateRange(null)
    filtersRef.current = { userId: '', typeFilter: undefined, refTypeFilter: undefined, dateRange: null }
    fetchData(1, pageSize)
  }, [fetchData, pageSize])

  const handleAdjustOk = async () => {
    const vals = await adjustForm.validateFields()
    setAdjustSaving(true)
    try {
      await request.post('/growth/points/adjust', {
        user_id: vals.user_id,
        type: vals.type,
        points: Number(vals.points),
        reason: vals.reason,
        operator_id: 'admin',
      })
      message.success('调账成功')
      setAdjustOpen(false)
      fetchData()
    } catch (e: any) { message.error(e?.response?.data?.msg || '调账失败') }
    setAdjustSaving(false)
  }

  // 当页统计
  const pageCredit = data.filter(r => r.type === 'credit').reduce((s, r) => s + (r.points || 0), 0)
  const pageDebit  = data.filter(r => r.type === 'debit' ).reduce((s, r) => s + (r.points || 0), 0)

  const columns = [
    {
      title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 155, ellipsis: true,
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 80,
      render: (v: string) => v === 'credit'
        ? <Tag color="green">收入</Tag>
        : <Tag color="red">支出</Tag>,
    },
    {
      title: '积分', dataIndex: 'points', key: 'points', width: 90,
      render: (v: number, r: any) => (
        <span style={{ fontWeight: 700, color: r.type === 'credit' ? '#52c41a' : '#cf1322', fontSize: 15 }}>
          {r.type === 'credit' ? '+' : '-'}{v}
        </span>
      ),
    },
    {
      title: '来源', dataIndex: 'ref_type', key: 'ref_type', width: 110,
      render: (v: string) => <Tag>{REF_TYPE_MAP[v] || v || '—'}</Tag>,
    },
    {
      title: '原因/备注', dataIndex: 'reason', key: 'reason', ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: '操作人', dataIndex: 'operator_id', key: 'operator_id', width: 100,
      render: (v: string) => v || <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: '时间', dataIndex: 'created_at', key: 'created_at', width: 150,
      render: (v: string) => v ? dayjs(v).format('MM-DD HH:mm:ss') : '—',
    },
  ]

  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>积分流水</div>
          <div style={{ color: '#888', fontSize: 13 }}>全量积分收支明细，可按用户/类型/来源/时间筛选</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { adjustForm.resetFields(); setAdjustOpen(true) }}>
          手动调账
        </Button>
      </div>

      {/* 当页汇总 */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={8}><Card size="small"><Statistic title="总记录数" value={total} /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="当页收入" value={pageCredit} valueStyle={{ color: '#52c41a' }} prefix="+" /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="当页支出" value={pageDebit} valueStyle={{ color: '#cf1322' }} prefix="-" /></Card></Col>
      </Row>

      {/* 筛选 */}
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '14px 16px' } }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            placeholder="搜索用户ID"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            onPressEnter={() => fetchData(1, pageSize)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="收支类型"
            value={typeFilter}
            onChange={v => setTypeFilter(v)}
            allowClear style={{ width: 120 }}
            options={[{ value: 'credit', label: '收入' }, { value: 'debit', label: '支出' }]}
          />
          <Select
            placeholder="积分来源"
            value={refTypeFilter}
            onChange={v => setRefTypeFilter(v)}
            allowClear style={{ width: 140 }}
            options={REF_TYPE_OPTIONS}
          />
          <DatePicker.RangePicker value={dateRange} onChange={v => setDateRange(v)} style={{ width: 240 }} />
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchData(1, pageSize)}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          </Space>
        </div>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 900 }}
          size="middle"
          pagination={{
            current: page, pageSize, total,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
          }}
        />
      </Card>

      <Modal title="手动调账" open={adjustOpen} onOk={handleAdjustOk}
        onCancel={() => setAdjustOpen(false)} confirmLoading={adjustSaving}
        okText="确认调账" cancelText="取消" destroyOnHidden width={440}>
        <Form form={adjustForm} layout="vertical" style={{ paddingTop: 8 }}>
          <Form.Item name="user_id" label="用户ID" rules={[{ required: true, message: '请填写用户ID' }]}>
            <Input placeholder="输入要调账的用户ID" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="type" label="调账类型" rules={[{ required: true }]}>
                <Select options={[{ value: 'credit', label: '➕ 加积分' }, { value: 'debit', label: '➖ 扣积分' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="points" label="积分数量" rules={[{ required: true }, { type: 'number', min: 1 }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="调账原因" rules={[{ required: true, message: '请填写原因（用于审计）' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ color: '#999', fontSize: 12 }}>操作人：admin（当前登录账号）</div>
        </Form>
      </Modal>
    </div>
  )
}
