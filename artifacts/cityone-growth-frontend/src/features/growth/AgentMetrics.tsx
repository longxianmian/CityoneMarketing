import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Select, DatePicker, Button, Spin } from 'antd'
import { RiseOutlined, TeamOutlined, MessageOutlined, CheckCircleOutlined, GiftOutlined, BarChartOutlined } from '@ant-design/icons'
import { getAgentMetrics } from '../../api/agent-admin'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList, Legend } from 'recharts'

const { RangePicker } = DatePicker

const MOCK_METRICS = {
  sessionCount: 3248,
  messageCount: 18764,
  intentSuccessRate: 87.3,
  toolSuccessRate: 94.1,
  couponConvert: 421,
  firstOrderConvert: 187,
  inviteConvert: 63,
  afterSalesRate: 12.4,
}

const MOCK_TREND = [
  { date: '3/27', sessions: 380, messages: 2100 },
  { date: '3/28', sessions: 420, messages: 2350 },
  { date: '3/29', sessions: 390, messages: 2180 },
  { date: '3/30', sessions: 460, messages: 2600 },
  { date: '3/31', sessions: 510, messages: 2900 },
  { date: '4/1', sessions: 548, messages: 3100 },
  { date: '4/2', sessions: 540, messages: 3534 },
]

const MOCK_PIE = [
  { name: '借还充电宝', value: 35 },
  { name: '卡券查询', value: 22 },
  { name: '积分兑换', value: 18 },
  { name: '订单查询', value: 14 },
  { name: '站点查询', value: 8 },
  { name: '其他', value: 3 },
]

const MOCK_FUNNEL = [
  { name: '进入对话', value: 3248, fill: '#2CDBCE' },
  { name: '意图识别', value: 2835, fill: '#2F80FF' },
  { name: '工具调用', value: 2267, fill: '#7B61FF' },
  { name: '完成转化', value: 671, fill: '#52c41a' },
]

const PIE_COLORS = ['#2CDBCE', '#2F80FF', '#7B61FF', '#FF7A59', '#52c41a', '#A0A7B3']

export default function AgentMetrics() {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await getAgentMetrics()
        setMetrics(res.data?.data || MOCK_METRICS)
      } catch {
        setMetrics(MOCK_METRICS)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const m = metrics || MOCK_METRICS

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <BarChartOutlined style={{ fontSize: 20, color: '#1677ff' }} />
        <div style={{ fontSize: 18, fontWeight: 700 }}>指标看板</div>
      </div>

      <div style={{ background: '#fff', padding: 12, borderRadius: 12, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <RangePicker size="small" />
        <Button type="primary" size="small">查询</Button>
      </div>

      {loading ? <Spin style={{ display: 'block', marginTop: 60 }} /> : (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {[
              { title: 'AI 会话人数', value: m.sessionCount, icon: <TeamOutlined />, color: '#2CDBCE' },
              { title: '消息总数', value: m.messageCount, icon: <MessageOutlined />, color: '#2F80FF' },
              { title: '意图识别成功率', value: m.intentSuccessRate, suffix: '%', icon: <CheckCircleOutlined />, color: '#7B61FF' },
              { title: '工具调用成功率', value: m.toolSuccessRate, suffix: '%', icon: <RiseOutlined />, color: '#52c41a' },
              { title: '领券转化数', value: m.couponConvert, icon: <GiftOutlined />, color: '#FF7A59' },
              { title: '首单转化数', value: m.firstOrderConvert, icon: <RiseOutlined />, color: '#fa8c16' },
              { title: '邀请转化数', value: m.inviteConvert, icon: <TeamOutlined />, color: '#13c2c2' },
              { title: '售后分流率', value: m.afterSalesRate, suffix: '%', icon: <CheckCircleOutlined />, color: '#A0A7B3' },
            ].map((item) => (
              <Col key={item.title} xs={12} sm={6}>
                <Card size="small" style={{ borderTop: `3px solid ${item.color}` }}>
                  <Statistic
                    title={<span style={{ fontSize: 12 }}>{item.title}</span>}
                    value={item.value}
                    suffix={item.suffix}
                    prefix={React.cloneElement(item.icon, { style: { color: item.color, fontSize: 16 } })}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[12, 12]}>
            <Col xs={24} lg={14}>
              <Card title="会话 & 消息趋势（最近 7 天）" size="small">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={MOCK_TREND}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sessions" stroke="#2CDBCE" name="会话人数" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="messages" stroke="#2F80FF" name="消息数" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            <Col xs={24} lg={10}>
              <Card title="能力使用占比" size="small">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={MOCK_PIE} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {MOCK_PIE.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            <Col xs={24}>
              <Card title="身份层级转化漏斗" size="small">
                <ResponsiveContainer width="100%" height={200}>
                  <FunnelChart>
                    <Tooltip />
                    <Funnel dataKey="value" data={MOCK_FUNNEL} isAnimationActive>
                      <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
