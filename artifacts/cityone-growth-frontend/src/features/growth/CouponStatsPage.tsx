import React, { useEffect, useState, useCallback } from 'react'
import { Segmented, Table, Tag, Card, Row, Col, Statistic, DatePicker, Space, Button, Input } from 'antd'
import { SearchOutlined, ReloadOutlined, FileTextOutlined, CheckCircleOutlined } from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'

function pickML(field: any): string {
  if (!field) return '-'
  if (typeof field === 'string') return field
  if (typeof field === 'object' && !Array.isArray(field))
    return field.zh || field.en || field.th || '-'
  return '-'
}

const { RangePicker } = DatePicker

type ViewMode = 'issue' | 'usage'

export default function CouponStatsPage() {
  const [mode, setMode] = useState<ViewMode>('issue')
  const [loading, setLoading] = useState(false)
  const [issueData, setIssueData] = useState<any[]>([])
  const [usageData, setUsageData] = useState<any[]>([])
  const [couponItems, setCouponItems] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<any>(null)

  const fetchCoupons = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await request.get('/growth/coupon/items', { params: { pageSize: 200 } })
      const items = (res.data?.items || res.data || []) as any[]
      setCouponItems(items)

      const issueRows: any[] = []
      const usageRows: any[] = []

      for (const item of items) {
        issueRows.push({
          key: `issue_${item.id}`,
          couponId: item.id,
          couponName: pickML(item.name || item.title),
          couponType: item.type || item.coupon_type || '-',
          batchCount: item.total_quantity || item.stock || 0,
          issuedCount: item.issued_count || 0,
          remainCount: (item.total_quantity || item.stock || 0) - (item.issued_count || 0),
          status: item.status || 'active',
          createdAt: item.created_at || item.createdAt || '-',
        })

        const used = item.used_count || 0
        const issued = item.issued_count || 0
        usageRows.push({
          key: `usage_${item.id}`,
          couponId: item.id,
          couponName: pickML(item.name || item.title),
          couponType: item.type || item.coupon_type || '-',
          issuedCount: issued,
          usedCount: used,
          unusedCount: issued - used,
          usageRate: issued > 0 ? ((used / issued) * 100).toFixed(1) + '%' : '0%',
          expiredCount: item.expired_count || 0,
        })
      }
      setIssueData(issueRows)
      setUsageData(usageRows)
    } catch {
      setIssueData([])
      setUsageData([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchCoupons() }, [fetchCoupons])

  const totalIssued = issueData.reduce((s, r) => s + r.issuedCount, 0)
  const totalBatch = issueData.reduce((s, r) => s + r.batchCount, 0)
  const totalUsed = usageData.reduce((s, r) => s + r.usedCount, 0)
  const overallRate = totalIssued > 0 ? ((totalUsed / totalIssued) * 100).toFixed(1) : '0'

  const filterFn = (row: any) => {
    if (!search) return true
    return (row.couponName || '').toLowerCase().includes(search.toLowerCase())
  }

  const issueColumns = [
    { title: '卡券名称', dataIndex: 'couponName', key: 'couponName', ellipsis: true },
    { title: '类型', dataIndex: 'couponType', key: 'couponType', render: (v: string) => <Tag>{v}</Tag> },
    { title: '库存数量', dataIndex: 'batchCount', key: 'batchCount', align: 'right' as const },
    { title: '已发放', dataIndex: 'issuedCount', key: 'issuedCount', align: 'right' as const,
      render: (v: number) => <span style={{ color: '#1677ff', fontWeight: 600 }}>{v}</span> },
    { title: '剩余库存', dataIndex: 'remainCount', key: 'remainCount', align: 'right' as const },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? '活跃' : v}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', ellipsis: true,
      render: (v: string) => v && v !== '-' ? dayjs(v).format('YYYY-MM-DD') : '-' },
  ]

  const usageColumns = [
    { title: '卡券名称', dataIndex: 'couponName', key: 'couponName', ellipsis: true },
    { title: '类型', dataIndex: 'couponType', key: 'couponType', render: (v: string) => <Tag>{v}</Tag> },
    { title: '已发放', dataIndex: 'issuedCount', key: 'issuedCount', align: 'right' as const },
    { title: '已使用', dataIndex: 'usedCount', key: 'usedCount', align: 'right' as const,
      render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 600 }}>{v}</span> },
    { title: '未使用', dataIndex: 'unusedCount', key: 'unusedCount', align: 'right' as const },
    { title: '使用率', dataIndex: 'usageRate', key: 'usageRate',
      render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '已过期', dataIndex: 'expiredCount', key: 'expiredCount', align: 'right' as const },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>卡券数据统计</div>
        <div style={{ color: '#888' }}>发放数据与使用数据一览</div>
      </div>

      {/* 汇总指标卡 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="卡券种类" value={couponItems.length} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总库存量" value={totalBatch} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总发放量" value={totalIssued} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总使用量" value={totalUsed}
              suffix={<span style={{ fontSize: 14, color: '#52c41a' }}> ({overallRate}%)</span>}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 切换按钮 + 工具栏 */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <Segmented
            size="large"
            value={mode}
            onChange={(v) => setMode(v as ViewMode)}
            options={[
              { label: '📤  发放数据', value: 'issue' },
              { label: '✅  使用数据', value: 'usage' },
            ]}
          />
          <Space wrap>
            <Input
              placeholder="搜索卡券名称"
              prefix={<SearchOutlined />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <RangePicker value={dateRange} onChange={setDateRange} />
            <Button icon={<ReloadOutlined />} onClick={fetchCoupons}>刷新</Button>
          </Space>
        </div>

        {mode === 'issue' ? (
          <Table
            loading={loading}
            dataSource={issueData.filter(filterFn)}
            columns={issueColumns}
            rowKey="key"
            pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
            size="middle"
          />
        ) : (
          <Table
            loading={loading}
            dataSource={usageData.filter(filterFn)}
            columns={usageColumns}
            rowKey="key"
            pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
            size="middle"
          />
        )}
      </Card>
    </div>
  )
}
