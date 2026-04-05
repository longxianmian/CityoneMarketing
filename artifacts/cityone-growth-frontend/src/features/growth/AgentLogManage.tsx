import React, { useEffect, useState } from 'react'
import { Table, Tag, Select, DatePicker, Button, Space, Modal, Descriptions } from 'antd'
import { SearchOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons'
import { getAgentLogs } from '../../api/agent-admin'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'

const { RangePicker } = DatePicker

const TIER_COLORS: Record<string, string> = {
  guest: 'default', fan: 'cyan', user: 'blue', member: 'purple',
}

const MOCK_LOGS = [
  { id: 'l1', sessionId: 'sess_aaa001', userId: 'Uabc123', tier: 'fan', question: '怎么借充电宝？', intent: 'borrow_guide', tool: 'site_search', result: 'success', intercepted: false, converted: true, createdAt: '2026-04-02T10:30:00Z' },
  { id: 'l2', sessionId: 'sess_aaa002', userId: 'Udef456', tier: 'user', question: '我的积分还有多少？', intent: 'points_query', tool: 'points_query', result: 'success', intercepted: false, converted: false, createdAt: '2026-04-02T11:00:00Z' },
  { id: 'l3', sessionId: 'sess_aaa003', userId: 'Ughi789', tier: 'member', question: '帮我用积分兑换奶茶', intent: 'points_redeem', tool: 'points_exchange', result: 'success', intercepted: false, converted: true, createdAt: '2026-04-02T11:45:00Z' },
  { id: 'l4', sessionId: 'sess_aaa004', userId: 'Ujkl012', tier: 'guest', question: '有什么活动吗', intent: 'activity_query', tool: '-', result: 'follow_required', intercepted: true, converted: false, createdAt: '2026-04-02T12:00:00Z' },
  { id: 'l5', sessionId: 'sess_aaa005', userId: 'Umno345', tier: 'user', question: '帮我找最近的充电站', intent: 'site_search', tool: 'site_search', result: 'success', intercepted: false, converted: false, createdAt: '2026-04-02T14:30:00Z' },
]

export default function AgentLogManage() {
  const { t } = useI18n()
  const al = (key: string) => t(`admin.agentLog.${key}`)

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [filters, setFilters] = useState<any>({})

  const tierOptions = [
    { value: 'guest', label: al('tierGuest') },
    { value: 'fan', label: al('tierFan') },
    { value: 'user', label: al('tierUser') },
    { value: 'member', label: al('tierMember') },
  ]

  const resultOptions = [
    { value: 'success', label: al('resultSuccess') },
    { value: 'follow_required', label: al('resultFollowRequired') },
    { value: 'error', label: al('resultError') },
  ]

  const load = async (params: any = {}) => {
    setLoading(true)
    try {
      const res = await getAgentLogs(params)
      setData(res.data?.data || res.data?.list || MOCK_LOGS)
    } catch { setData(MOCK_LOGS) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const onSearch = () => load(filters)

  const columns = [
    { title: al('colTime'), dataIndex: 'createdAt', width: 160, render: (v: string) => dayjs(v).format('MM-DD HH:mm') },
    { title: al('colSessionId'), dataIndex: 'sessionId', width: 130, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
    { title: al('colUserId'), dataIndex: 'userId', width: 110, render: (v: string) => <span style={{ fontSize: 12, color: '#666' }}>{v}</span> },
    { title: al('colTier'), dataIndex: 'tier', width: 90, render: (v: string) => <Tag color={TIER_COLORS[v] || 'default'}>{tierOptions.find(o => o.value === v)?.label || v}</Tag> },
    { title: al('colQuestion'), dataIndex: 'question', ellipsis: true },
    { title: al('colIntent'), dataIndex: 'intent', width: 140, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
    { title: al('colTool'), dataIndex: 'tool', width: 130, render: (v: string) => v && v !== '-' ? <code style={{ fontSize: 11 }}>{v}</code> : <span style={{ color: '#bbb' }}>-</span> },
    {
      title: al('colResult'), dataIndex: 'result', width: 110,
      render: (v: string) => <Tag color={v === 'success' ? 'green' : v === 'follow_required' ? 'orange' : 'red'}>{resultOptions.find(o => o.value === v)?.label || v}</Tag>,
    },
    { title: al('colIntercepted'), dataIndex: 'intercepted', width: 70, render: (v: boolean) => v ? <Tag color="red">{al('yes')}</Tag> : '-' },
    { title: al('colConverted'), dataIndex: 'converted', width: 70, render: (v: boolean) => v ? <Tag color="green">✓</Tag> : '-' },
    { title: al('colDetail'), width: 70, render: (_: any, row: any) => <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(row)} /> },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <FileTextOutlined style={{ fontSize: 20, color: '#1677ff' }} />
        <div style={{ fontSize: 18, fontWeight: 700 }}>{al('pageTitle')}</div>
      </div>
      <div style={{ background: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{al('filterTimeRange')}</div>
          <RangePicker size="small" onChange={(v) => setFilters((f: any) => ({ ...f, startAt: v?.[0]?.toISOString(), endAt: v?.[1]?.toISOString() }))} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{al('filterTier')}</div>
          <Select size="small" allowClear placeholder={al('filterAll')} style={{ width: 120 }} options={tierOptions} onChange={(v) => setFilters((f: any) => ({ ...f, tier: v }))} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{al('filterResult')}</div>
          <Select size="small" allowClear placeholder={al('filterAll')} style={{ width: 140 }} options={resultOptions} onChange={(v) => setFilters((f: any) => ({ ...f, result: v }))} />
        </div>
        <Button type="primary" size="small" icon={<SearchOutlined />} onClick={onSearch}>{al('btnSearch')}</Button>
      </div>
      <Table
        rowKey="id" dataSource={data} columns={columns} loading={loading} scroll={{ x: 1100 }}
        pagination={{ pageSize: 15, showTotal: (total) => al('totalRows').replace('{n}', String(total)) }}
      />
      <Modal open={!!detail} title={al('modalTitle')} footer={null} onCancel={() => setDetail(null)} width={560}>
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={al('colSessionId')}><code>{detail.sessionId}</code></Descriptions.Item>
            <Descriptions.Item label={al('colUserId')}>{detail.userId}</Descriptions.Item>
            <Descriptions.Item label={al('colTier')}><Tag color={TIER_COLORS[detail.tier]}>{tierOptions.find(o => o.value === detail.tier)?.label || detail.tier}</Tag></Descriptions.Item>
            <Descriptions.Item label={al('colQuestion')}>{detail.question}</Descriptions.Item>
            <Descriptions.Item label={al('colIntent')}><code>{detail.intent}</code></Descriptions.Item>
            <Descriptions.Item label={al('colTool')}>{detail.tool || '-'}</Descriptions.Item>
            <Descriptions.Item label={al('colResult')}><Tag color={detail.result === 'success' ? 'green' : 'red'}>{detail.result}</Tag></Descriptions.Item>
            <Descriptions.Item label={al('colIntercepted')}>{detail.intercepted ? al('yes') : al('no')}</Descriptions.Item>
            <Descriptions.Item label={al('colConverted')}>{detail.converted ? `✓ ${al('yes')}` : al('no')}</Descriptions.Item>
            <Descriptions.Item label={al('colTime')}>{dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
