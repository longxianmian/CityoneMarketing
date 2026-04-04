import React, { useEffect, useState } from 'react'
import { Table, Tag, Switch, Button, Modal, message, Descriptions, Badge } from 'antd'
import { InfoCircleOutlined, ToolOutlined } from '@ant-design/icons'
import { getAgentTools, updateAgentTool } from '../../api/agent-admin'

const DOMAIN_COLORS: Record<string, string> = {
  borrow: 'cyan', coupon: 'orange', points: 'gold', invite: 'green', order: 'blue', site: 'geekblue', general: 'default',
}

const MOCK_TOOLS = [
  { id: '1', code: 'site_search', name: '附近站点查询', domain: 'site', enabled: true, mode: 'live', service: 'site-service', errorRate: '0.2%', desc: '查询用户附近可用充电宝站点，支持距离过滤与排序' },
  { id: '2', code: 'coupon_list', name: '可用卡券列表', domain: 'coupon', enabled: true, mode: 'live', service: 'coupon-service', errorRate: '0.1%', desc: '获取用户当前可用卡券列表，包含适用条件与有效期' },
  { id: '3', code: 'coupon_use', name: '使用卡券', domain: 'coupon', enabled: true, mode: 'live', service: 'coupon-service', errorRate: '0.3%', desc: '代用户核销指定卡券，需二次确认' },
  { id: '4', code: 'points_query', name: '积分查询', domain: 'points', enabled: true, mode: 'live', service: 'points-service', errorRate: '0.0%', desc: '查询用户当前积分余额与历史记录' },
  { id: '5', code: 'points_exchange', name: '积分兑换', domain: 'points', enabled: true, mode: 'mock', service: 'points-service', errorRate: '-', desc: '代用户使用积分兑换指定商品或权益，需二次确认' },
  { id: '6', code: 'order_search', name: '订单查询', domain: 'order', enabled: true, mode: 'live', service: 'order-service', errorRate: '0.1%', desc: '查询用户历史借还充电宝订单列表及详情' },
  { id: '7', code: 'share_welfare', name: '分享福利给好友', domain: 'invite', enabled: true, mode: 'live', service: 'share-service', errorRate: '0.0%', desc: '引导用户选择活动或卡券分享给好友，触发归因积分发放' },
]

export default function AgentToolManage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAgentTools()
      setData(res.data?.data || res.data?.list || MOCK_TOOLS)
    } catch {
      setData(MOCK_TOOLS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggleEnabled = async (row: any) => {
    try {
      await updateAgentTool({ id: row.id, enabled: !row.enabled })
      setData((prev) => prev.map((t) => t.id === row.id ? { ...t, enabled: !t.enabled } : t))
    } catch {
      message.error('切换失败，后端接口未就绪')
      setData((prev) => prev.map((t) => t.id === row.id ? { ...t, enabled: !t.enabled } : t))
    }
  }

  const toggleMode = async (row: any) => {
    const next = row.mode === 'live' ? 'mock' : 'live'
    try {
      await updateAgentTool({ id: row.id, mode: next })
      setData((prev) => prev.map((t) => t.id === row.id ? { ...t, mode: next } : t))
    } catch {
      setData((prev) => prev.map((t) => t.id === row.id ? { ...t, mode: next } : t))
    }
  }

  const columns = [
    { title: '工具编码', dataIndex: 'code', width: 160, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: '工具名称', dataIndex: 'name', width: 140 },
    { title: '业务域', dataIndex: 'domain', width: 100, render: (v: string) => <Tag color={DOMAIN_COLORS[v] || 'default'}>{v}</Tag> },
    { title: '依赖服务', dataIndex: 'service', width: 140 },
    {
      title: '模式', dataIndex: 'mode', width: 120,
      render: (v: string, row: any) => (
        <Button size="small" type={v === 'live' ? 'primary' : 'default'} onClick={() => toggleMode(row)}>
          {v === 'live' ? '🟢 Live' : '🟡 Mock'}
        </Button>
      ),
    },
    { title: '错误率', dataIndex: 'errorRate', width: 80, align: 'center' as const },
    { title: '开关', dataIndex: 'enabled', width: 80, render: (_: any, row: any) => <Switch size="small" checked={row.enabled} onChange={() => toggleEnabled(row)} /> },
    {
      title: '说明', width: 80,
      render: (_: any, row: any) => (
        <Button size="small" icon={<InfoCircleOutlined />} onClick={() => setDetail(row)}>详情</Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <ToolOutlined style={{ fontSize: 20, color: '#1677ff' }} />
        <div style={{ fontSize: 18, fontWeight: 700 }}>工具管理</div>
        <Badge count={data.filter((d) => d.mode === 'mock').length} showZero={false}>
          <Tag color="gold" style={{ marginLeft: 8 }}>Mock 模式工具</Tag>
        </Badge>
      </div>

      <Table
        rowKey="id"
        dataSource={data}
        columns={columns}
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        open={!!detail}
        title={detail ? `${detail.name} 详情` : ''}
        footer={null}
        onCancel={() => setDetail(null)}
      >
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="工具编码"><code>{detail.code}</code></Descriptions.Item>
            <Descriptions.Item label="业务域">{detail.domain}</Descriptions.Item>
            <Descriptions.Item label="依赖服务">{detail.service}</Descriptions.Item>
            <Descriptions.Item label="当前模式">{detail.mode === 'live' ? '🟢 Live（真实接口）' : '🟡 Mock（模拟数据）'}</Descriptions.Item>
            <Descriptions.Item label="最近错误率">{detail.errorRate}</Descriptions.Item>
            <Descriptions.Item label="功能说明">{detail.desc}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
