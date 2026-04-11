import React, { useEffect, useState, useCallback } from 'react'
import { Table, Card, Row, Col, Statistic, Input, Space, Button, Tag, Progress, Spin } from 'antd'
import { SearchOutlined, ReloadOutlined, ShoppingOutlined, PercentageOutlined, TrophyOutlined } from '@ant-design/icons'
import request from '../../api/request'
import { useI18n } from '../../i18n'
import { pickML, useMLPick } from '../../lib/ml'

const ITEM_TYPE_LABEL: Record<string, string> = {
  digital: '数字商品',
  voucher: '兑换券',
  physical: '实物',
  ai: 'AI权益',
  flash: '闪购',
}

const ITEM_TYPE_COLOR: Record<string, string> = {
  digital: 'blue',
  voucher: 'purple',
  physical: 'orange',
  ai: 'geekblue',
  flash: 'red',
}

export default function RedeemStatsPage() {
  const pick = useMLPick()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [itemsRes, ordersRes]: any[] = await Promise.all([
        request.get('/growth/mall/items', { params: { pageSize: 500 } }),
        request.get('/growth/mall/orders', { params: { pageSize: 500 } }),
      ])
      const itemList = itemsRes.data?.list || itemsRes.data?.items || (Array.isArray(itemsRes.data) ? itemsRes.data : [])
      const orderList = ordersRes.data?.list || ordersRes.data?.items || (Array.isArray(ordersRes.data) ? ordersRes.data : [])
      setItems(itemList)
      setOrders(orderList)
    } catch {
      setItems([])
      setOrders([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // 统计计算
  const totalOrders = orders.length
  const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'success').length
  const totalPointsSpent = orders.reduce((s: number, o: any) => s + (o.points_used || o.points_required || 0), 0)

  // 按商品汇总
  const itemStatsMap: Record<string, { item: any; count: number; points: number }> = {}
  for (const order of orders) {
    const id = order.item_id || order.mall_item_id || order.id
    if (!itemStatsMap[id]) {
      const matchedItem = items.find(i => i.id === id)
      itemStatsMap[id] = { item: matchedItem || { id, name: order.item_name || order.name || id }, count: 0, points: 0 }
    }
    itemStatsMap[id].count += 1
    itemStatsMap[id].points += order.points_used || order.points_required || 0
  }

  // 如果没有订单，用商品列表生成占位统计
  const statsRows = Object.values(itemStatsMap).length > 0
    ? Object.values(itemStatsMap).map(({ item, count, points }) => ({
        key: item.id,
        id: item.id,
        name: pick(item.name),
        itemType: item.item_type || 'digital',
        redeemCount: count,
        pointsSpent: points,
        rate: totalOrders > 0 ? ((count / totalOrders) * 100).toFixed(1) : '0',
      }))
    : items.map(item => ({
        key: item.id,
        id: item.id,
        name: pick(item.name),
        itemType: item.item_type || 'digital',
        redeemCount: 0,
        pointsSpent: 0,
        rate: '0',
      }))

  const sortedRows = [...statsRows].sort((a, b) => b.redeemCount - a.redeemCount)
  const maxCount = sortedRows[0]?.redeemCount || 1

  // 按类型汇总占比
  const typeStats: Record<string, number> = {}
  for (const row of sortedRows) {
    typeStats[row.itemType] = (typeStats[row.itemType] || 0) + row.redeemCount
  }
  const typeStatsList = Object.entries(typeStats).map(([type, count]) => ({
    type, count, pct: totalOrders > 0 ? ((count / totalOrders) * 100).toFixed(1) : '0',
  })).sort((a, b) => b.count - a.count)

  const filteredRows = sortedRows.filter(r =>
    !search || (r.name || '').toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    { title: '排名', key: 'rank', width: 60, render: (_: any, __: any, idx: number) => (
      <span style={{ fontWeight: idx < 3 ? 700 : 400, color: idx === 0 ? '#f5a623' : idx === 1 ? '#9b9b9b' : idx === 2 ? '#c07941' : undefined }}>
        {idx + 1}
      </span>
    )},
    { title: '商品名称', dataIndex: 'name', key: 'name', ellipsis: true,
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v || '-'}</span> },
    { title: '类型', dataIndex: 'itemType', key: 'itemType',
      render: (v: string) => <Tag color={ITEM_TYPE_COLOR[v] || 'default'}>{ITEM_TYPE_LABEL[v] || v}</Tag> },
    { title: '兑换次数', dataIndex: 'redeemCount', key: 'redeemCount', align: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 600, color: '#1677ff' }}>{v}</span> },
    { title: '兑换占比', key: 'bar', render: (_: any, row: any) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Progress percent={maxCount > 0 ? Math.round((row.redeemCount / maxCount) * 100) : 0}
          showInfo={false} size="small" style={{ flex: 1, minWidth: 80 }} />
        <span style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>{row.rate}%</span>
      </div>
    )},
    { title: '消耗积分', dataIndex: 'pointsSpent', key: 'pointsSpent', align: 'right' as const,
      render: (v: number) => <span style={{ color: '#fa8c16' }}>{v.toLocaleString()}</span> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>兑换数据</div>
        <div style={{ color: '#888' }}>用户端福利中心"兑换"栏的商品兑换数据统计</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          {/* 汇总统计 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic title="在架商品数" value={items.filter(i => i.on_shelf).length}
                  prefix={<ShoppingOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="兑换总次数" value={totalOrders} valueStyle={{ color: '#1677ff' }}
                  prefix={<TrophyOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="完成兑换" value={completedOrders}
                  suffix={<span style={{ fontSize: 14, color: '#52c41a' }}>
                    {totalOrders > 0 ? ` (${((completedOrders / totalOrders) * 100).toFixed(0)}%)` : ''}
                  </span>}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="已消耗积分" value={totalPointsSpent}
                  prefix={<PercentageOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 类型占比 */}
          {typeStatsList.length > 0 && (
            <Card title="兑换类型占比" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                {typeStatsList.map(({ type, count, pct }) => (
                  <Col key={type} xs={24} sm={12} md={8} lg={6} style={{ marginBottom: 16 }}>
                    <div style={{ padding: '12px 16px', borderRadius: 10, background: '#f8f9fb', border: '1px solid #eee' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Tag color={ITEM_TYPE_COLOR[type] || 'default'}>{ITEM_TYPE_LABEL[type] || type}</Tag>
                        <span style={{ fontWeight: 700, color: '#1677ff' }}>{count} 次</span>
                      </div>
                      <Progress percent={Number(pct)} size="small"
                        strokeColor={ITEM_TYPE_COLOR[type] === 'blue' ? '#1677ff' : undefined} />
                      <div style={{ textAlign: 'right', fontSize: 12, color: '#888', marginTop: 4 }}>占比 {pct}%</div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          {/* 商品兑换明细 */}
          <Card
            title="商品兑换数据列表"
            extra={
              <Space>
                <Input placeholder="搜索商品名称" prefix={<SearchOutlined />}
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: 200 }} allowClear />
                <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
              </Space>
            }
          >
            <Table
              dataSource={filteredRows}
              columns={columns}
              rowKey="key"
              pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个商品` }}
              size="middle"
            />
          </Card>
        </>
      )}
    </div>
  )
}
