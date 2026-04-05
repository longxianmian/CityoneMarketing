import React, { useEffect, useState } from 'react'
import { Table, Tag, Switch, Button, Modal, message, Descriptions, Badge } from 'antd'
import { InfoCircleOutlined, ToolOutlined } from '@ant-design/icons'
import { getAgentTools, updateAgentTool } from '../../api/agent-admin'
import { useI18n } from '../../i18n'

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
  const { t } = useI18n()
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
      setData((prev) => prev.map((item) => item.id === row.id ? { ...item, enabled: !item.enabled } : item))
    } catch {
      message.error(t('agentToolManage.toggleError'))
      setData((prev) => prev.map((item) => item.id === row.id ? { ...item, enabled: !item.enabled } : item))
    }
  }

  const toggleMode = async (row: any) => {
    const next = row.mode === 'live' ? 'mock' : 'live'
    try {
      await updateAgentTool({ id: row.id, mode: next })
      setData((prev) => prev.map((item) => item.id === row.id ? { ...item, mode: next } : item))
    } catch {
      setData((prev) => prev.map((item) => item.id === row.id ? { ...item, mode: next } : item))
    }
  }

  const columns = [
    { title: t('agentToolManage.colCode'), dataIndex: 'code', width: 160, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: t('agentToolManage.colName'), dataIndex: 'name', width: 140 },
    { title: t('agentToolManage.colDomain'), dataIndex: 'domain', width: 100, render: (v: string) => <Tag color={DOMAIN_COLORS[v] || 'default'}>{v}</Tag> },
    { title: t('agentToolManage.colService'), dataIndex: 'service', width: 140 },
    {
      title: t('agentToolManage.colMode'), dataIndex: 'mode', width: 120,
      render: (v: string, row: any) => (
        <Button size="small" type={v === 'live' ? 'primary' : 'default'} onClick={() => toggleMode(row)}>
          {v === 'live' ? '🟢 Live' : '🟡 Mock'}
        </Button>
      ),
    },
    { title: t('agentToolManage.colErrorRate'), dataIndex: 'errorRate', width: 80, align: 'center' as const },
    { title: t('agentToolManage.colEnabled'), dataIndex: 'enabled', width: 80, render: (_: any, row: any) => <Switch size="small" checked={row.enabled} onChange={() => toggleEnabled(row)} /> },
    {
      title: t('agentToolManage.colDetail'), width: 80,
      render: (_: any, row: any) => (
        <Button size="small" icon={<InfoCircleOutlined />} onClick={() => setDetail(row)}>{t('agentToolManage.detailBtn')}</Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <ToolOutlined style={{ fontSize: 20, color: '#1677ff' }} />
        <div style={{ fontSize: 18, fontWeight: 700 }}>{t('agentToolManage.pageTitle')}</div>
        <Badge count={data.filter((d) => d.mode === 'mock').length} showZero={false}>
          <Tag color="gold" style={{ marginLeft: 8 }}>{t('agentToolManage.mockBadge')}</Tag>
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
        title={detail ? `${detail.name}` : ''}
        footer={null}
        onCancel={() => setDetail(null)}
      >
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('agentToolManage.detailCode')}><code>{detail.code}</code></Descriptions.Item>
            <Descriptions.Item label={t('agentToolManage.detailDomain')}>{detail.domain}</Descriptions.Item>
            <Descriptions.Item label={t('agentToolManage.detailService')}>{detail.service}</Descriptions.Item>
            <Descriptions.Item label={t('agentToolManage.detailMode')}>{detail.mode === 'live' ? t('agentToolManage.modeLive') : t('agentToolManage.modeMock')}</Descriptions.Item>
            <Descriptions.Item label={t('agentToolManage.detailError')}>{detail.errorRate}</Descriptions.Item>
            <Descriptions.Item label={t('agentToolManage.detailDesc')}>{detail.desc}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
