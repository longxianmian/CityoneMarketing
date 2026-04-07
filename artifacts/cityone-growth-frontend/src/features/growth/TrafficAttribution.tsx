import React, { useState, useCallback } from 'react'
import { Card, Table, Row, Col, Statistic, Select, Tag, Spin } from 'antd'
import { FunnelPlotOutlined, EyeOutlined, UserAddOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'

export default function TrafficAttribution() {
  const { t } = useI18n()
  const ta = (key: string) => t(`trafficAttribution.${key}`)

  const [visits, setVisits] = useState<any[]>([])
  const [summary, setSummary] = useState({ totalVisits: 0, uniqueVisitors: 0, registrations: 0, orders: 0, conversionRate: 0 })
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [utmSource, setUtmSource] = useState<string | undefined>()

  const fetchData = useCallback(async (p = page, ps = pageSize) => {
    setLoading(true)
    try {
      const res: any = await request.get('/growth/traffic/list', { params: { pageNum: p, pageSize: ps, utmSource } })
      setVisits(res.data?.list || [])
      setTotal(res.data?.total || 0)
      const statsRes: any = await request.get('/growth/traffic/summary')
      if (statsRes.data) setSummary(statsRes.data)
    } catch (e) {}
    setLoading(false)
  }, [page, pageSize, utmSource])

  React.useEffect(() => { fetchData() }, [])

  const handleSearch = () => { setPage(1); fetchData(1, pageSize) }

  const columns = [
    { title: ta('colVisitId'), dataIndex: 'visitId', key: 'visitId', width: 180, ellipsis: true },
    { title: ta('colSource'), dataIndex: 'utmSource', key: 'utmSource', width: 100, render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <Tag>{ta('directVisit')}</Tag> },
    { title: ta('colCampaign'), dataIndex: 'utmCampaign', key: 'utmCampaign', width: 120, ellipsis: true, responsive: ['md' as const] },
    { title: ta('colRefCode'), dataIndex: 'refCode', key: 'refCode', width: 100, responsive: ['md' as const] },
    { title: ta('colLanding'), dataIndex: 'landingUrl', key: 'landingUrl', width: 160, ellipsis: true, responsive: ['lg' as const] },
    { title: ta('colBound'), dataIndex: 'userId', key: 'userId', width: 100, render: (v: any) => v ? <Tag color="green">{ta('bound')}</Tag> : <Tag>{ta('unbound')}</Tag> },
    { title: ta('colCreatedAt'), dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--' },
  ]

  const summaryCards = [
    { key: 'totalVisits', title: ta('statTotal'), value: summary.totalVisits, icon: <EyeOutlined />, color: '#1677ff' },
    { key: 'uniqueVisitors', title: ta('statUnique'), value: summary.uniqueVisitors, icon: <EyeOutlined />, color: '#722ed1' },
    { key: 'registrations', title: ta('statReg'), value: summary.registrations, icon: <UserAddOutlined />, color: '#52c41a' },
    { key: 'orders', title: ta('statOrders'), value: summary.orders, icon: <ShoppingCartOutlined />, color: '#faad14' },
    { key: 'conversionRate', title: ta('statRate'), value: summary.conversionRate, suffix: '%', icon: <FunnelPlotOutlined />, color: '#eb2f96' },
  ]

  const sourceOptions = [
    { value: 'tiktok', label: 'TikTok' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'google', label: 'Google' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'line', label: 'LINE' },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>{ta('pageTitle')}</h2>
      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {summaryCards.map((s) => (
            <Col xs={12} sm={8} md={4} key={s.key}>
              <Card>
                <Statistic title={s.title} value={s.value} suffix={s.suffix}
                  prefix={React.cloneElement(s.icon as React.ReactElement<any>, { style: { color: s.color } })}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>
      <Card styles={{ body: { paddingBottom: 0 } }}>
        <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8} md={6}>
            <Select placeholder={ta('filterSource')} value={utmSource} onChange={(v) => { setUtmSource(v); setTimeout(() => handleSearch(), 0) }}
              allowClear style={{ width: '100%' }} options={sourceOptions}
            />
          </Col>
        </Row>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Table rowKey="id" columns={columns} dataSource={visits} loading={loading} scroll={{ x: 800 }}
          pagination={{
            current: page, pageSize, total, showSizeChanger: true,
            showTotal: (total) => ta('totalRows').replace('{n}', String(total)),
            onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
          }}
        />
      </Card>
    </div>
  )
}
