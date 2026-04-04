import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Row, Col, Tag } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { getAdminPointsAccounts } from '../../api/growth'
import dayjs from 'dayjs'

export default function PointsAccounts() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')

  const fetchData = useCallback(async (p = page, ps = pageSize, kw = keyword) => {
    setLoading(true)
    try {
      const res: any = await getAdminPointsAccounts({ page: p, page_size: ps, keyword: kw || undefined })
      const payload = res?.data || {}
      setData(payload.items || [])
      setTotal(payload.total || 0)
    } catch (e) {}
    setLoading(false)
  }, [page, pageSize, keyword])

  React.useEffect(() => { fetchData() }, [])

  const handleSearch = () => { setPage(1); fetchData(1, pageSize, keyword) }
  const handleReset = () => { setKeyword(''); setPage(1); fetchData(1, pageSize, '') }

  const columns = [
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 160, ellipsis: true },
    { title: 'LINE用户ID', dataIndex: 'line_user_id', key: 'line_user_id', width: 160, ellipsis: true, responsive: ['md' as const] },
    {
      title: '总积分', dataIndex: 'total_points', key: 'total_points', width: 100,
      render: (v: number) => <span style={{ color: '#1677ff', fontWeight: 700 }}>{v ?? 0}</span>,
    },
    {
      title: '可用积分', dataIndex: 'available_points', key: 'available_points', width: 100,
      render: (v: number) => <Tag color="green">{v ?? 0}</Tag>,
    },
    {
      title: '待结算', dataIndex: 'pending_points', key: 'pending_points', width: 100,
      render: (v: number) => <Tag color="orange">{v ?? 0}</Tag>,
    },
    {
      title: '已消费', dataIndex: 'consumed_points', key: 'consumed_points', width: 100,
      render: (v: number) => <Tag color="red">{v ?? 0}</Tag>,
    },
    {
      title: '已撤销', dataIndex: 'revoked_points', key: 'revoked_points', width: 100,
      responsive: ['lg' as const],
      render: (v: number) => <Tag color="default">{v ?? 0}</Tag>,
    },
    {
      title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 180,
      responsive: ['lg' as const],
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--',
    },
  ]

  return (
    <div>
      <Card styles={{ body: { paddingBottom: 0 } }} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="搜索用户ID / LINE ID / 手机号"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
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

      <Card title="积分账户列表">
        <Table
          rowKey={(r) => r.user_id || r.line_user_id || Math.random()}
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 900 }}
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
