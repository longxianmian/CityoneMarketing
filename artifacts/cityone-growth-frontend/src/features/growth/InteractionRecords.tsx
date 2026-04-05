import React, { useEffect, useState } from 'react'
import { Card, Table, Tag, Select, Input, Button, Space, DatePicker, Row, Col } from 'antd'
import { SearchOutlined, ReloadOutlined, InteractionOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import request from '../../api/request'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'

const RESULT_COLOR: Record<string, string> = {
  win: 'green',
  no_win: 'default',
  scratched: 'blue',
  drawn: 'purple',
}

export default function InteractionRecords() {
  const { t } = useI18n()
  const ik = (key: string) => t(`admin.interactionRecords.${key}`)

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

  const resultOptions = [
    { value: 'win', label: ik('resultWin') },
    { value: 'no_win', label: ik('resultNoWin') },
    { value: 'scratched', label: ik('resultScratched') },
    { value: 'drawn', label: ik('resultDrawn') },
  ]

  const activityTypeMap: Record<string, string> = {
    lucky_wheel: ik('typeLuckyWheel'),
    scratch_card: ik('typeScratchCard'),
    thai_fortune_draw: ik('typeFortuneSign'),
  }

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
    { title: ik('colId'), dataIndex: 'id', key: 'id', width: 80 },
    { title: ik('colUserId'), dataIndex: 'userId', key: 'userId', width: 120 },
    { title: ik('colNickName'), dataIndex: 'nickName', key: 'nickName', width: 150 },
    {
      title: ik('colActivityType'), dataIndex: 'activityType', key: 'activityType', width: 120,
      render: (v: string) => activityTypeMap[v] || v,
    },
    {
      title: ik('colResult'), dataIndex: 'result', key: 'result', width: 100,
      render: (v: string) => {
        const label = resultOptions.find(o => o.value === v)?.label || v
        return <Tag color={RESULT_COLOR[v] || 'default'}>{label}</Tag>
      },
    },
    { title: ik('colPrize'), dataIndex: 'prizeDesc', key: 'prizeDesc', width: 180, render: (v: string) => v || '—' },
    { title: ik('colCreatedAt'), dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—' },
  ]

  return (
    <Card title={<Space><InteractionOutlined />{ik('pageTitle')}{activityId ? ` — #${activityId}` : ` (${ik('noActivity')})`}</Space>}>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Input placeholder={ik('searchPlaceholder')} prefix={<SearchOutlined />} value={keyword} onChange={e => setKeyword(e.target.value)} onPressEnter={handleSearch} allowClear />
        </Col>
        <Col xs={24} sm={6} md={4}>
          <Select placeholder={ik('filterResult')} value={resultFilter} onChange={setResultFilter} allowClear style={{ width: '100%' }} options={resultOptions} />
        </Col>
        <Col xs={24} sm={8} md={8}>
          <DatePicker.RangePicker value={dateRange} onChange={setDateRange} style={{ width: '100%' }} />
        </Col>
        <Col>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>{ik('btnSearch')}</Button>
            <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setResultFilter(undefined); setDateRange(null); fetchData(1, pageSize) }}>{ik('btnReset')}</Button>
          </Space>
        </Col>
      </Row>
      <Table
        columns={columns} dataSource={records} rowKey="id" loading={loading} size="small" scroll={{ x: 900 }}
        pagination={{
          current: page, pageSize, total, showSizeChanger: true,
          showTotal: total => ik('totalRows').replace('{n}', String(total)),
          onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
        }}
        locale={{ emptyText: activityId ? ik('emptyRecords') : ik('noActivity') }}
      />
    </Card>
  )
}
