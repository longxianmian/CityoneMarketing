import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, DatePicker, Button, Spin } from 'antd'
import { RiseOutlined, TeamOutlined, MessageOutlined, CheckCircleOutlined, GiftOutlined, BarChartOutlined } from '@ant-design/icons'
import { getAgentMetrics } from '../../api/agent-admin'
import { useI18n } from '../../i18n'
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

const PIE_COLORS = ['#2CDBCE', '#2F80FF', '#7B61FF', '#FF7A59', '#52c41a', '#A0A7B3']

export default function AgentMetrics() {
  const { t } = useI18n()
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const MOCK_PIE = [
    { name: t('agentMetrics.pieBorrow'), value: 35 },
    { name: t('agentMetrics.pieCoupon'), value: 22 },
    { name: t('agentMetrics.piePoints'), value: 18 },
    { name: t('agentMetrics.pieOrder'), value: 14 },
    { name: t('agentMetrics.pieSite'), value: 8 },
    { name: t('agentMetrics.pieOther'), value: 3 },
  ]

  const MOCK_FUNNEL = [
    { name: t('agentMetrics.funnelEnter'), value: 3248, fill: '#2CDBCE' },
    { name: t('agentMetrics.funnelIntent'), value: 2835, fill: '#2F80FF' },
    { name: t('agentMetrics.funnelTool'), value: 2267, fill: '#7B61FF' },
    { name: t('agentMetrics.funnelConvert'), value: 671, fill: '#52c41a' },
  ]

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
        <div style={{ fontSize: 18, fontWeight: 700 }}>{t('agentMetrics.pageTitle')}</div>
      </div>

      <div style={{ background: '#fff', padding: 12, borderRadius: 12, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <RangePicker size="small" />
        <Button type="primary" size="small">{t('agentMetrics.queryBtn')}</Button>
      </div>

      {loading ? <Spin style={{ display: 'block', marginTop: 60 }} /> : (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {[
              { title: t('agentMetrics.sessionCount'), value: m.sessionCount, icon: <TeamOutlined />, color: '#2CDBCE' },
              { title: t('agentMetrics.messageCount'), value: m.messageCount, icon: <MessageOutlined />, color: '#2F80FF' },
              { title: t('agentMetrics.intentSuccessRate'), value: m.intentSuccessRate, suffix: '%', icon: <CheckCircleOutlined />, color: '#7B61FF' },
              { title: t('agentMetrics.toolSuccessRate'), value: m.toolSuccessRate, suffix: '%', icon: <RiseOutlined />, color: '#52c41a' },
              { title: t('agentMetrics.couponConvert'), value: m.couponConvert, icon: <GiftOutlined />, color: '#FF7A59' },
              { title: t('agentMetrics.firstOrderConvert'), value: m.firstOrderConvert, icon: <RiseOutlined />, color: '#fa8c16' },
              { title: t('agentMetrics.inviteConvert'), value: m.inviteConvert, icon: <TeamOutlined />, color: '#13c2c2' },
              { title: t('agentMetrics.afterSalesRate'), value: m.afterSalesRate, suffix: '%', icon: <CheckCircleOutlined />, color: '#A0A7B3' },
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
              <Card title={t('agentMetrics.trendTitle')} size="small">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={MOCK_TREND}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sessions" stroke="#2CDBCE" name={t('agentMetrics.trendSessions')} dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="messages" stroke="#2F80FF" name={t('agentMetrics.trendMessages')} dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            <Col xs={24} lg={10}>
              <Card title={t('agentMetrics.pieTitle')} size="small">
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
              <Card title={t('agentMetrics.funnelTitle')} size="small">
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
