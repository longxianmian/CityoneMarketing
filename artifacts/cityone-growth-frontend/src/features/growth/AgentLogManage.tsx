import React, { useEffect, useState } from 'react'
import { Table, Tag, Select, DatePicker, Button, Space, Modal, Descriptions, message } from 'antd'
import { SearchOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons'
import { getAgentLogs } from '../../api/agent-admin'
import dayjs from 'dayjs'

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
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [filters, setFilters] = useState<any>({})

  const load = async (params: any = {}) => {
    setLoading(true)
    try {
      const res = await getAgentLogs(params)
      setData(res.data?.data || res.data?.list || MOCK_LOGS)
    } catch {
      setData(MOCK_LOGS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onSearch = () => load(filters)

  const columns = [
    { title: '时间', dataIndex: 'createdAt', width: 160, render: (v: string) => dayjs(v).format('MM-DD HH:mm') },
    { title: '会话 ID', dataIndex: 'sessionId', width: 130, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
    { title: '用户 ID', dataIndex: 'userId', width: 110, render: (v: string) => <span style={{ fontSize: 12, color: '#666' }}>{v}</span> },
    { title: '身份', dataIndex: 'tier', width: 90, render: (v: string) => <Tag color={TIER_COLORS[v] || 'default'}>{v}</Tag> },
    { title: '用户问题', dataIndex: 'question', ellipsis: true },
    { title: '识别意图', dataIndex: 'intent', width: 140, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
    { title: '调用工具', dataIndex: 'tool', width: 130, render: (v: string) => v && v !== '-' ? <code style={{ fontSize: 11 }}>{v}</code> : <span style={{ color: '#bbb' }}>-</span> },
    { title: '结果', dataIndex: 'result', width: 110, render: (v: string) => <Tag color={v === 'success' ? 'green' : v === 'follow_required' ? 'orange' : 'red'}>{v}</Tag> },
    { title: '拦截', dataIndex: 'intercepted', width: 70, render: (v: boolean) => v ? <Tag color="red">是</Tag> : '-' },
    { title: '转化', dataIndex: 'converted', width: 70, render: (v: boolean) => v ? <Tag color="green">✓</Tag> : '-' },
    { title: '详情', width: 70, render: (_: any, row: any) => <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(row)} /> },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <FileTextOutlined style={{ fontSize: 20, color: '#1677ff' }} />
        <div style={{ fontSize: 18, fontWeight: 700 }}>会话日志</div>
      </div>

      <div style={{ background: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>时间范围</div>
          <RangePicker size="small" onChange={(v) => setFilters((f: any) => ({ ...f, startAt: v?.[0]?.toISOString(), endAt: v?.[1]?.toISOString() }))} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>身份等级</div>
          <Select size="small" allowClear placeholder="全部" style={{ width: 120 }}
            options={[{ value: 'guest', label: '访客' }, { value: 'fan', label: 'OA 粉丝' }, { value: 'user', label: '认证用户' }, { value: 'member', label: '会员' }]}
            onChange={(v) => setFilters((f: any) => ({ ...f, tier: v }))}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>执行结果</div>
          <Select size="small" allowClear placeholder="全部" style={{ width: 140 }}
            options={[{ value: 'success', label: '成功' }, { value: 'follow_required', label: '需关注 OA' }, { value: 'error', label: '错误' }]}
            onChange={(v) => setFilters((f: any) => ({ ...f, result: v }))}
          />
        </div>
        <Button type="primary" size="small" icon={<SearchOutlined />} onClick={onSearch}>查询</Button>
      </div>

      <Table
        rowKey="id"
        dataSource={data}
        columns={columns}
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 15, showTotal: (total) => `共 ${total} 条` }}
      />

      <Modal
        open={!!detail}
        title="会话详情"
        footer={null}
        onCancel={() => setDetail(null)}
        width={560}
      >
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="会话 ID"><code>{detail.sessionId}</code></Descriptions.Item>
            <Descriptions.Item label="用户 ID">{detail.userId}</Descriptions.Item>
            <Descriptions.Item label="身份等级"><Tag color={TIER_COLORS[detail.tier]}>{detail.tier}</Tag></Descriptions.Item>
            <Descriptions.Item label="用户问题">{detail.question}</Descriptions.Item>
            <Descriptions.Item label="识别意图"><code>{detail.intent}</code></Descriptions.Item>
            <Descriptions.Item label="调用工具">{detail.tool || '-'}</Descriptions.Item>
            <Descriptions.Item label="执行结果"><Tag color={detail.result === 'success' ? 'green' : 'red'}>{detail.result}</Tag></Descriptions.Item>
            <Descriptions.Item label="是否拦截">{detail.intercepted ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="是否转化">{detail.converted ? '✓ 是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="时间">{dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
