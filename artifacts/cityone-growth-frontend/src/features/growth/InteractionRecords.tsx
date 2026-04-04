import React, { useEffect, useState } from 'react'
import { Card, Table, Tag, Select, Input, Button, Space, DatePicker, Row, Col } from 'antd'
import { SearchOutlined, ReloadOutlined, InteractionOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import request from '../../api/request'
import dayjs from 'dayjs'

const RESULT_MAP: Record<string, { label: string; color: string }> = {
  win: { label: '中奖', color: 'green' },
  no_win: { label: '未中奖', color: 'default' },
  scratched: { label: '已刮开', color: 'blue' },
  drawn: { label: '已抽签', color: 'purple' },
}

export default function InteractionRecords() {
  const [searchParams] = useSearchParams()
  const activityId = searchParams.get('activityId')
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [resultFilter, setResultFilter] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<any>(null)

  const fetchData = async (p = page, ps = pageSize) => {
    if (!activityId) return
    setLoading(true)
    try {
      const params: any = { page: p, pageSize: ps }
      if (keyword) params.keyword = keyword
      if (resultFilter) params.result = resultFilter
      if (dateRange?.[0]) params.startDate = dateRange[0].format('YYYY-MM-DD')
      if (dateRange?.[1]) params.endDate = dateRange[1].format('YYYY-MM-DD')
      const res: any = await request.get(`/api/activities/${activityId}/interaction-records`, { params })
      setRecords(res.data?.list || [])
      setTotal(res.data?.total || 0)
    } catch { setRecords([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData(1, pageSize) }, [activityId])

  const handleSearch = () => { setPage(1); fetchData(1, pageSize) }

  const columns = [
    { title: '记录ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '用户ID', dataIndex: 'userId', key: 'userId', width: 120 },
    { title: '用户昵称', dataIndex: 'nickName', key: 'nickName', width: 150 },
    { title: '活动类型', dataIndex: 'activityType', key: 'activityType', width: 120,
      render: (v: string) => {
        const m: Record<string, string> = { lucky_wheel: '大转盘', scratch_card: '刮刮卡', thai_fortune_draw: '祈福抽签' }
        return m[v] || v
      } },
    { title: '互动结果', dataIndex: 'result', key: 'result', width: 100,
      render: (v: string) => {
        const r = RESULT_MAP[v]
        return r ? <Tag color={r.color}>{r.label}</Tag> : <Tag>{v}</Tag>
      } },
    { title: '奖励内容', dataIndex: 'prizeDesc', key: 'prizeDesc', width: 180,
      render: (v: string) => v || '—' },
    { title: '参与时间', dataIndex: 'createdAt', key: 'createdAt', width: 180,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—' },
  ]

  return (
    <Card
      title={<Space><InteractionOutlined />互动记录{activityId ? ` — 活动 #${activityId}` : '（请从活动列表进入）'}</Space>}
    >
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Input
            placeholder="搜索用户ID / 昵称"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
        </Col>
        <Col xs={24} sm={6} md={4}>
          <Select
            placeholder="互动结果"
            value={resultFilter}
            onChange={setResultFilter}
            allowClear
            style={{ width: '100%' }}
            options={Object.entries(RESULT_MAP).map(([k, v]) => ({ value: k, label: v.label }))}
          />
        </Col>
        <Col xs={24} sm={8} md={8}>
          <DatePicker.RangePicker value={dateRange} onChange={setDateRange} style={{ width: '100%' }} />
        </Col>
        <Col>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setResultFilter(undefined); setDateRange(null); fetchData(1, pageSize) }}>重置</Button>
          </Space>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 900 }}
        pagination={{
          current: page, pageSize, total,
          showSizeChanger: true,
          showTotal: t => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
        }}
        locale={{ emptyText: activityId ? '暂无互动记录' : '请通过活动列表进入' }}
      />
    </Card>
  )
}
