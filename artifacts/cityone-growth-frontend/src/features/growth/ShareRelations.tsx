import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Select, Row, Col, Tag } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { getAdminShareRelations } from '../../api/growth'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'

const POINTS_STATUS_COLOR: Record<string, string> = {
  pending: 'orange',
  settled: 'green',
  revoked: 'default',
  failed: 'red',
}

export default function ShareRelations() {
  const { t } = useI18n()
  const sk = (key: string) => t(`shareRelations.${key}`)

  const POINTS_STATUS_OPTIONS = [
    { value: 'pending', label: sk('statusPending') },
    { value: 'settled', label: sk('statusSettled') },
    { value: 'revoked', label: sk('statusRevoked') },
    { value: 'failed', label: sk('statusFailed') },
  ]

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
        page: p, page_size: ps,
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
    { title: sk('colSharerId'), dataIndex: 'sharer_user_id', key: 'sharer_user_id', width: 150, ellipsis: true },
    { title: sk('colInviteeId'), dataIndex: 'invitee_user_id', key: 'invitee_user_id', width: 150, ellipsis: true, responsive: ['md' as const] },
    { title: sk('colCampaignId'), dataIndex: 'campaign_id', key: 'campaign_id', width: 140, ellipsis: true, responsive: ['md' as const] },
    { title: sk('colContentType'), dataIndex: 'share_content_type', key: 'share_content_type', width: 100, render: (v: string) => <Tag>{v || '--'}</Tag> },
    { title: sk('colContentId'), dataIndex: 'share_content_id', key: 'share_content_id', width: 120, responsive: ['lg' as const] },
    { title: sk('colChannel'), dataIndex: 'channel', key: 'channel', width: 90, responsive: ['lg' as const], render: (v: string) => <Tag color="blue">{v || '--'}</Tag> },
    {
      title: sk('colPointsStatus'), dataIndex: 'points_status', key: 'points_status', width: 100,
      render: (v: string) => {
        const label = POINTS_STATUS_OPTIONS.find(o => o.value === v)?.label || v || '--'
        return <Tag color={POINTS_STATUS_COLOR[v] || 'default'}>{label}</Tag>
      },
    },
    { title: sk('colPoints'), dataIndex: 'points', key: 'points', width: 80 },
    {
      title: sk('colFollowedAt'), dataIndex: 'followed_at', key: 'followed_at', width: 180, responsive: ['lg' as const],
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--',
    },
    {
      title: sk('colCreatedAt'), dataIndex: 'created_at', key: 'created_at', width: 180, responsive: ['lg' as const],
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--',
    },
  ]

  return (
    <div>
      <Card styles={{ body: { paddingBottom: 0 } }} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input placeholder={sk('filterCampaign')} value={campaignId} onChange={e => setCampaignId(e.target.value)} onPressEnter={handleSearch} allowClear />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select placeholder={sk('filterStatus')} value={pointsStatus} onChange={v => setPointsStatus(v)} allowClear style={{ width: '100%' }} options={POINTS_STATUS_OPTIONS} />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>{sk('btnSearch')}</Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>{sk('btnReset')}</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card title={sk('tableTitle')}>
        <Table
          rowKey={(r, i) => r.id || `${r.sharer_user_id}-${i}`}
          columns={columns} dataSource={data} loading={loading} scroll={{ x: 1100 }}
          pagination={{
            current: page, pageSize, total, showSizeChanger: true,
            showTotal: (total) => sk('totalRows').replace('{n}', String(total)),
            onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
          }}
        />
      </Card>
    </div>
  )
}
