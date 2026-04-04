import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Select, Row, Col, Tag } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { getAdminConsumeRelations } from '../../api/growth'
import dayjs from 'dayjs'

const POINTS_STATUS_OPTIONS = [
  { value: 'pending', label: '待结算' },
  { value: 'settled', label: '已结算' },
  { value: 'revoked', label: '已撤销' },
  { value: 'failed', label: '失败' },
]

const POINTS_STATUS_COLOR: Record<string, string> = {
  pending: 'orange',
  settled: 'green',
  revoked: 'default',
  failed: 'red',
}

const POINTS_STATUS_LABEL: Record<string, string> = {
  pending: '待结算',
  settled: '已结算',
  revoked: '已撤销',
  failed: '失败',
}

export default function ConsumeRelations() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [userId, setUserId] = useState('')
  const [pointsStatus, setPointsStatus] = useState<string | undefined>(undefined)

  const fetchData = useCallback(async (p = page, ps = pageSize) => {
    setLoading(true)
    try {
      const res: any = await getAdminConsumeRelations({
        page: p,
        page_size: ps,
        user_id: userId || undefined,
        points_status: pointsStatus,
      })
      const payload = res?.data || {}
      setData(payload.items || [])
      setTotal(payload.total || 0)
    } catch (e) {}
    setLoading(false)
  }, [page, pageSize, userId, pointsStatus])

  React.useEffect(() => { fetchData() }, [])

  const handleSearch = () => { setPage(1); fetchData(1, pageSize) }
  const handleReset = () => {
    setUserId(''); setPointsStatus(undefined); setPage(1)
    setTimeout(() => fetchData(1, pageSize), 0)
  }

  const columns = [
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 160, ellipsis: true },
    { title: '订单ID', dataIndex: 'order_id', key: 'order_id', width: 160, ellipsis: true, responsive: ['md' as const] },
    { title: '消费金额(THB)', dataIndex: 'amount', key: 'amount', width: 130, render: (v: number) => v != null ? `฿${v}` : '--' },
    { title: '获得积分', dataIndex: 'points', key: 'points', width: 100, render: (v: number) => <span style={{ color: '#1677ff', fontWeight: 700 }}>+{v ?? 0}</span> },
    {
      title: '积分状态', dataIndex: 'points_status', key: 'points_status', width: 100,
      render: (v: string) => <Tag color={POINTS_STATUS_COLOR[v] || 'default'}>{POINTS_STATUS_LABEL[v] || v || '--'}</Tag>,
    },
    { title: '规则标识', dataIndex: 'rule_key', key: 'rule_key', width: 160, responsive: ['lg' as const], render: (v: string) => <Tag>{v || '--'}</Tag> },
    {
      title: '消费时间', dataIndex: 'order_time', key: 'order_time', width: 180, responsive: ['lg' as const],
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--',
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, responsive: ['lg' as const],
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--',
    },
  ]

  return (
    <div>
      <Card styles={{ body: { paddingBottom: 0 } }} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="用户ID"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              placeholder="积分状态"
              value={pointsStatus}
              onChange={v => setPointsStatus(v)}
              allowClear
              style={{ width: '100%' }}
              options={POINTS_STATUS_OPTIONS}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title="消费归因列表">
        <Table
          rowKey={(r, i) => r.id || `${r.user_id}-${i}`}
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
          }}
        />
      </Card>
    </div>
  )
}
