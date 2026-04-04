import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Select, Row, Col, Tag } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { getAdminShareRelations } from '../../api/growth'
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

export default function ShareRelations() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [campaignId, setCampaignId] = useState('')
  const [pointsStatus, setPointsStatus] = useState<string | undefined>(undefined)

  const fetchData = useCallback(async (p = page, ps = pageSize) => {
    setLoading(true)
    try {
      const res: any = await getAdminShareRelations({
        page: p,
        page_size: ps,
        campaign_id: campaignId || undefined,
        points_status: pointsStatus,
      })
      const payload = res?.data || {}
      setData(payload.items || [])
      setTotal(payload.total || 0)
    } catch (e) {}
    setLoading(false)
  }, [page, pageSize, campaignId, pointsStatus])

  React.useEffect(() => { fetchData() }, [])

  const handleSearch = () => { setPage(1); fetchData(1, pageSize) }
  const handleReset = () => {
    setCampaignId(''); setPointsStatus(undefined); setPage(1)
    setTimeout(() => fetchData(1, pageSize), 0)
  }

  const columns = [
    { title: '分享人ID', dataIndex: 'sharer_user_id', key: 'sharer_user_id', width: 150, ellipsis: true },
    { title: '被分享人ID', dataIndex: 'invitee_user_id', key: 'invitee_user_id', width: 150, ellipsis: true, responsive: ['md' as const] },
    { title: '活动ID', dataIndex: 'campaign_id', key: 'campaign_id', width: 140, ellipsis: true, responsive: ['md' as const] },
    { title: '内容类型', dataIndex: 'share_content_type', key: 'share_content_type', width: 100, render: (v: string) => <Tag>{v || '--'}</Tag> },
    { title: '内容ID', dataIndex: 'share_content_id', key: 'share_content_id', width: 120, responsive: ['lg' as const] },
    { title: '渠道', dataIndex: 'channel', key: 'channel', width: 90, responsive: ['lg' as const], render: (v: string) => <Tag color="blue">{v || '--'}</Tag> },
    {
      title: '积分状态', dataIndex: 'points_status', key: 'points_status', width: 100,
      render: (v: string) => <Tag color={POINTS_STATUS_COLOR[v] || 'default'}>{POINTS_STATUS_LABEL[v] || v || '--'}</Tag>,
    },
    { title: '积分数', dataIndex: 'points', key: 'points', width: 80 },
    {
      title: '关注时间', dataIndex: 'followed_at', key: 'followed_at', width: 180, responsive: ['lg' as const],
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
              placeholder="活动ID (campaign_id)"
              value={campaignId}
              onChange={e => setCampaignId(e.target.value)}
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

      <Card title="分享归因列表">
        <Table
          rowKey={(r, i) => r.id || `${r.sharer_user_id}-${i}`}
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1100 }}
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
