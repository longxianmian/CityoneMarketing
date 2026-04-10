import React, { useEffect, useState, useCallback } from 'react'
import { Segmented, Table, Tag, Card, Row, Col, Statistic, Space, Button, Input, Progress } from 'antd'
import { SearchOutlined, ReloadOutlined, FileTextOutlined, CheckCircleOutlined, GiftOutlined, ClockCircleOutlined } from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'

function pickML(field: any): string {
  if (!field) return '-'
  if (typeof field === 'string') return field
  if (typeof field === 'object' && !Array.isArray(field))
    return field.zh || field.en || field.th || '-'
  return '-'
}

const couponTypeMap: Record<string, string> = {
  newbie: '新人券', channel: '渠道券', general: '通用券', activity: '活动券',
}
const discountTypeMap: Record<string, string> = {
  fixed: '固定减免', percent: '折扣', free_time: '免费时长', free_order: '免单',
}

type ViewMode = 'issue' | 'usage'

export default function CouponStatsPage() {
  const [mode, setMode] = useState<ViewMode>('issue')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await request.get('/growth/coupon/stats')
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || [])
      setRows(list)
    } catch {
      setRows([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // 汇总统计
  const totalKinds    = rows.length
  const totalStock    = rows.reduce((s, r) => s + (r.total_count   || 0), 0)
  const totalIssued   = rows.reduce((s, r) => s + (r.claimed_count || 0), 0)
  const totalUsed     = rows.reduce((s, r) => s + (r.used_count    || 0), 0)

  const filterFn = (row: any) =>
    !search || pickML(row.name).toLowerCase().includes(search.toLowerCase())

  const filtered = rows.filter(filterFn)

  // ── 发放数据列 ──
  const issueColumns = [
    {
      title: '卡券名称', dataIndex: 'name', key: 'name', ellipsis: true,
      render: (v: any) => <span style={{ fontWeight: 600 }}>{pickML(v)}</span>,
    },
    {
      title: '类型', dataIndex: 'coupon_type', key: 'coupon_type', width: 90,
      render: (v: string) => <Tag color="blue">{couponTypeMap[v] || v}</Tag>,
    },
    {
      title: '折扣方式', dataIndex: 'discount_type', key: 'discount_type', width: 100,
      render: (v: string) => <Tag>{discountTypeMap[v] || v}</Tag>,
    },
    {
      title: '总库存', dataIndex: 'total_count', key: 'total_count', align: 'right' as const, width: 90,
    },
    {
      title: '已领取', dataIndex: 'claimed_count', key: 'claimed_count', align: 'right' as const, width: 90,
      render: (v: number) => <span style={{ color: '#1677ff', fontWeight: 700 }}>{v}</span>,
    },
    {
      title: '剩余库存', key: 'remain', align: 'right' as const, width: 90,
      render: (_: any, r: any) => {
        const remain = (r.total_count || 0) - (r.claimed_count || 0)
        return <span style={{ color: remain <= 0 ? '#ff4d4f' : '#333' }}>{remain}</span>
      },
    },
    {
      title: '领取率', key: 'claim_rate', width: 140,
      render: (_: any, r: any) => {
        const pct = r.total_count > 0 ? Math.round((r.claimed_count / r.total_count) * 100) : 0
        return <Progress percent={pct} size="small" strokeColor="#1677ff" />
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: number) => <Tag color={v === 1 ? 'green' : 'default'}>{v === 1 ? '启用' : '停用'}</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 110,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
  ]

  // ── 使用数据列 ──
  const usageColumns = [
    {
      title: '卡券名称', dataIndex: 'name', key: 'name', ellipsis: true,
      render: (v: any) => <span style={{ fontWeight: 600 }}>{pickML(v)}</span>,
    },
    {
      title: '类型', dataIndex: 'coupon_type', key: 'coupon_type', width: 90,
      render: (v: string) => <Tag color="blue">{couponTypeMap[v] || v}</Tag>,
    },
    {
      title: '已领取', dataIndex: 'claimed_count', key: 'claimed_count', align: 'right' as const, width: 90,
    },
    {
      title: '已使用', dataIndex: 'used_count', key: 'used_count', align: 'right' as const, width: 90,
      render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 700 }}>{v}</span>,
    },
    {
      title: '未使用', key: 'unused', align: 'right' as const, width: 90,
      render: (_: any, r: any) => (r.claimed_count || 0) - (r.used_count || 0),
    },
    {
      title: '使用率', key: 'usage_rate', width: 140,
      render: (_: any, r: any) => {
        const pct = r.claimed_count > 0 ? Math.round((r.used_count / r.claimed_count) * 100) : 0
        return <Progress percent={pct} size="small" strokeColor="#52c41a" />
      },
    },
    {
      title: '已过期', dataIndex: 'expired_count', key: 'expired_count', align: 'right' as const, width: 90,
      render: (v: number) => v > 0 ? <span style={{ color: '#faad14' }}>{v}</span> : <span style={{ color: '#ccc' }}>0</span>,
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>卡券数据统计</div>
        <div style={{ color: '#888' }}>发放数据与使用数据一览</div>
      </div>

      {/* 汇总指标卡 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="卡券种类" value={totalKinds} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="总库存" value={totalStock} prefix={<GiftOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="总领取量" value={totalIssued} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总使用量"
              value={totalUsed}
              suffix={totalIssued > 0
                ? <span style={{ fontSize: 13, color: '#52c41a' }}>（{Math.round(totalUsed / totalIssued * 100)}%）</span>
                : undefined}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 切换 + 工具栏 */}
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
            <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
          </Space>
        </div>

        {mode === 'issue' ? (
          <Table
            loading={loading}
            dataSource={filtered}
            columns={issueColumns}
            rowKey="id"
            scroll={{ x: 800 }}
            pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
            size="middle"
          />
        ) : (
          <Table
            loading={loading}
            dataSource={filtered}
            columns={usageColumns}
            rowKey="id"
            scroll={{ x: 700 }}
            pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
            size="middle"
          />
        )}
      </Card>
    </div>
  )
}
