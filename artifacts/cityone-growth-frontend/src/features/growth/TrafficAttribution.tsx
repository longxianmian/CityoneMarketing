import React, { useState, useCallback } from 'react'
import { Card, Table, Row, Col, Statistic, DatePicker, Select, Tag, Spin } from 'antd'
import { FunnelPlotOutlined, EyeOutlined, UserAddOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'

export default function TrafficAttribution() {
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
    { title: '访问ID', dataIndex: 'visitId', key: 'visitId', width: 180, ellipsis: true },
    { title: '来源', dataIndex: 'utmSource', key: 'utmSource', width: 100, render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <Tag>直接访问</Tag> },
    { title: '活动', dataIndex: 'utmCampaign', key: 'utmCampaign', width: 120, ellipsis: true, responsive: ['md' as const] },
    { title: '邀请码', dataIndex: 'refCode', key: 'refCode', width: 100, responsive: ['md' as const] },
    { title: '落地页', dataIndex: 'landingUrl', key: 'landingUrl', width: 160, ellipsis: true, responsive: ['lg' as const] },
    { title: '已绑定用户', dataIndex: 'userId', key: 'userId', width: 100, render: (v: any) => v ? <Tag color="green">已绑定</Tag> : <Tag>未绑定</Tag> },
    {
      title: '访问时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--',
    },
  ]

  const summaryCards = [
    { title: '总访问量', value: summary.totalVisits, icon: <EyeOutlined />, color: '#1677ff' },
    { title: '独立访客', value: summary.uniqueVisitors, icon: <EyeOutlined />, color: '#722ed1' },
    { title: '注册转化', value: summary.registrations, icon: <UserAddOutlined />, color: '#52c41a' },
    { title: '下单转化', value: summary.orders, icon: <ShoppingCartOutlined />, color: '#faad14' },
    { title: '注册转化率', value: summary.conversionRate, suffix: '%', icon: <FunnelPlotOutlined />, color: '#eb2f96' },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>流量归因</h2>
      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {summaryCards.map((s, i) => (
            <Col xs={12} sm={8} md={4} key={i}>
              <Card>
                <Statistic title={s.title} value={s.value} suffix={s.suffix}
                  prefix={React.cloneElement(s.icon as React.ReactElement, { style: { color: s.color } })}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>
      <Card styles={{ body: { paddingBottom: 0 } }}>
        <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8} md={6}>
            <Select placeholder="按来源筛选" value={utmSource} onChange={(v) => { setUtmSource(v); setTimeout(() => handleSearch(), 0) }}
              allowClear style={{ width: '100%' }}
              options={[{ value: 'tiktok', label: 'TikTok' }, { value: 'facebook', label: 'Facebook' }, { value: 'google', label: 'Google' }, { value: 'youtube', label: 'YouTube' }, { value: 'line', label: 'LINE' }]}
            />
          </Col>
        </Row>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Table rowKey="id" columns={columns} dataSource={visits} loading={loading} scroll={{ x: 800 }}
          pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) } }}
        />
      </Card>
    </div>
  )
}
