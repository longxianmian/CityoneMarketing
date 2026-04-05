import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Select, Row, Col, Tag } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { getAdminConsumeRelations } from '../../api/growth'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'

const POINTS_STATUS_COLOR: Record<string, string> = {
  pending: 'orange',
  settled: 'green',
  revoked: 'default',
  failed: 'red',
}

export default function ConsumeRelations() {
  const { t } = useI18n()
  const ck = (key: string) => t(`admin.consumeRelations.${key}`)

  const POINTS_STATUS_OPTIONS = [
    { value: 'pending', label: ck('statusPending') },
    { value: 'settled', label: ck('statusSettled') },
    { value: 'revoked', label: ck('statusRevoked') },
    { value: 'failed', label: ck('statusFailed') },
  ]

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
      const res: any = await getAdminConsumeRelations({ page: p, page_size: ps, user_id: userId || undefined, points_status: pointsStatus })
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
    { title: ck('colUserId'), dataIndex: 'user_id', key: 'user_id', width: 160, ellipsis: true },
    { title: ck('colOrderId'), dataIndex: 'order_id', key: 'order_id', width: 160, ellipsis: true, responsive: ['md' as const] },
    { title: ck('colAmount'), dataIndex: 'amount', key: 'amount', width: 130, render: (v: number) => v != null ? `฿${v}` : '--' },
    { title: ck('colPoints'), dataIndex: 'points', key: 'points', width: 100, render: (v: number) => <span style={{ color: '#1677ff', fontWeight: 700 }}>+{v ?? 0}</span> },
    {
      title: ck('colPointsStatus'), dataIndex: 'points_status', key: 'points_status', width: 100,
      render: (v: string) => {
        const label = POINTS_STATUS_OPTIONS.find(o => o.value === v)?.label || v || '--'
        return <Tag color={POINTS_STATUS_COLOR[v] || 'default'}>{label}</Tag>
      },
    },
    { title: ck('colRuleKey'), dataIndex: 'rule_key', key: 'rule_key', width: 160, responsive: ['lg' as const], render: (v: string) => <Tag>{v || '--'}</Tag> },
    { title: ck('colOrderTime'), dataIndex: 'order_time', key: 'order_time', width: 180, responsive: ['lg' as const], render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--' },
    { title: ck('colCreatedAt'), dataIndex: 'created_at', key: 'created_at', width: 180, responsive: ['lg' as const], render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--' },
  ]

  return (
    <div>
      <Card styles={{ body: { paddingBottom: 0 } }} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input placeholder={ck('filterUserId')} value={userId} onChange={e => setUserId(e.target.value)} onPressEnter={handleSearch} allowClear />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select placeholder={ck('filterStatus')} value={pointsStatus} onChange={v => setPointsStatus(v)} allowClear style={{ width: '100%' }} options={POINTS_STATUS_OPTIONS} />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>{ck('btnSearch')}</Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>{ck('btnReset')}</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card title={ck('tableTitle')}>
        <Table
          rowKey={(r, i) => r.id || `${r.user_id}-${i}`}
          columns={columns} dataSource={data} loading={loading} scroll={{ x: 1000 }}
          pagination={{
            current: page, pageSize, total, showSizeChanger: true,
            showTotal: (total) => ck('totalRows').replace('{n}', String(total)),
            onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
          }}
        />
      </Card>
    </div>
  )
}
