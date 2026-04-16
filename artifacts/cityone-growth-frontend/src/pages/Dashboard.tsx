import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Progress, Spin, Empty } from 'antd'
import {
  FunnelPlotOutlined,
  UserOutlined,
  GiftOutlined,
  FileTextOutlined,
  ShareAltOutlined,
  RiseOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useI18n } from '../i18n'
import request from '../api/request'

interface DashboardStats {
  visitCount: number
  newUsers: number
  couponIssued: number
  attributedOrders: number
  inviteUsers: number
  conversionRate: number
}

interface ChannelRow {
  channel: string
  visits: number
  users: number
  orders: number
  rate: number
}

interface ActivityRow {
  id: string
  name: string
  status: string
  participants: number
  interactions: number
  rewards: string
  orders: number
}

export default function Dashboard() {
  const { t, language } = useI18n()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [channelData, setChannelData] = useState<ChannelRow[]>([])
  const [activityData, setActivityData] = useState<ActivityRow[]>([])
  const copy = ({
    zh: {
      pendingASystem: '待接A系统',
      aSystemSuffix: '待A系统',
      statusRunning: '进行中',
      statusDraft: '草稿',
      participants: '参与用户',
      interactions: '互动次数',
      noChannelDataHint: '暂无渠道数据（互动记录中 utm_source 为空时统一归入 LINE OA）',
      noChannelData: '暂无渠道数据',
      noActivityData: '暂无活动数据',
    },
    th: {
      pendingASystem: 'รอเชื่อม A System',
      aSystemSuffix: 'รอ A System',
      statusRunning: 'กำลังดำเนินการ',
      statusDraft: 'ฉบับร่าง',
      participants: 'ผู้เข้าร่วม',
      interactions: 'จำนวนการโต้ตอบ',
      noChannelDataHint: 'ยังไม่มีข้อมูลช่องทาง (หาก utm_source ว่างจะถูกรวมใน LINE OA)',
      noChannelData: 'ยังไม่มีข้อมูลช่องทาง',
      noActivityData: 'ยังไม่มีข้อมูลกิจกรรม',
    },
    en: {
      pendingASystem: 'Pending A-System',
      aSystemSuffix: 'Awaiting A-System',
      statusRunning: 'Running',
      statusDraft: 'Draft',
      participants: 'Participants',
      interactions: 'Interactions',
      noChannelDataHint: 'No channel data yet (records without utm_source are grouped into LINE OA)',
      noChannelData: 'No channel data',
      noActivityData: 'No activity data',
    },
  } as const)[language] || ({
    pendingASystem: 'Pending A-System',
    aSystemSuffix: 'Awaiting A-System',
    statusRunning: 'Running',
    statusDraft: 'Draft',
    participants: 'Participants',
    interactions: 'Interactions',
    noChannelDataHint: 'No channel data yet (records without utm_source are grouped into LINE OA)',
    noChannelData: 'No channel data',
    noActivityData: 'No activity data',
  })

  const load = () => {
    setLoading(true)
    request.get('/dashboard/stats')
      .then((res: any) => {
        const d = res?.data || res
        if (d?.stats) setStats(d.stats)
        if (d?.channelData) setChannelData(d.channelData)
        if (d?.activityData) setActivityData(d.activityData)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const channelColumns = [
    { title: t('dashboard.colChannel'), dataIndex: 'channel', key: 'channel' },
    { title: t('dashboard.colVisits'), dataIndex: 'visits', key: 'visits' },
    { title: t('dashboard.colNewUsers'), dataIndex: 'users', key: 'users' },
    { title: t('dashboard.colOrders'), dataIndex: 'orders', key: 'orders',
      render: (v: number) => v === 0 ? <span style={{ color: '#bbb' }}>{copy.pendingASystem}</span> : v },
    {
      title: t('dashboard.colRate'),
      dataIndex: 'rate',
      key: 'rate',
      render: (v: number) => <Tag color={v >= 30 ? 'green' : v >= 15 ? 'blue' : 'default'}>{v}%</Tag>,
    },
  ]

  const activityColumns = [
    { title: t('dashboard.colActivity'), dataIndex: 'name', key: 'name' },
    {
      title: t('dashboard.colStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={v === '进行中' || v === 'running' ? 'green' : v === '草稿' || v === 'draft' ? 'gold' : 'default'}>
          {v === '进行中' || v === 'running' ? copy.statusRunning : v === '草稿' || v === 'draft' ? copy.statusDraft : v}
        </Tag>
      ),
    },
    { title: copy.participants, dataIndex: 'participants', key: 'participants' },
    { title: copy.interactions, dataIndex: 'interactions', key: 'interactions' },
    { title: t('dashboard.colRewards'), dataIndex: 'rewards', key: 'rewards' },
    {
      title: t('dashboard.colDrivenOrders'),
      dataIndex: 'orders',
      key: 'orders',
      render: (v: number) => v === 0 ? <span style={{ color: '#bbb' }}>{copy.pendingASystem}</span> : v,
    },
  ]

  const maxRate = channelData.length > 0 ? Math.max(...channelData.map(c => c.rate)) : 100

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{t('dashboard.pageTitle')}</h2>
        <ReloadOutlined
          onClick={load}
          spin={loading}
          style={{ color: '#2CDBCE', cursor: 'pointer', fontSize: 16 }}
        />
      </div>

      {loading && !stats ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} md={4}>
              <Card>
                <Statistic
                  title={t('dashboard.visitCount')}
                  value={stats?.visitCount ?? 0}
                  prefix={<FunnelPlotOutlined style={{ color: '#1677ff' }} />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card>
                <Statistic
                  title={t('dashboard.newUsers')}
                  value={stats?.newUsers ?? 0}
                  prefix={<UserOutlined style={{ color: '#52c41a' }} />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card>
                <Statistic
                  title={t('dashboard.couponIssued')}
                  value={stats?.couponIssued ?? 0}
                  prefix={<GiftOutlined style={{ color: '#faad14' }} />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card>
                <Statistic
                  title={t('dashboard.attributedOrders')}
                  value={stats?.attributedOrders ?? 0}
                  prefix={<FileTextOutlined style={{ color: '#eb2f96' }} />}
                  suffix={<span style={{ fontSize: 12, color: '#bbb' }}>{copy.aSystemSuffix}</span>}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card>
                <Statistic
                  title={t('dashboard.inviteUsers')}
                  value={stats?.inviteUsers ?? 0}
                  prefix={<ShareAltOutlined style={{ color: '#13c2c2' }} />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card>
                <Statistic
                  title={t('dashboard.conversionRate')}
                  value={stats?.conversionRate ?? 0}
                  suffix="%"
                  prefix={<RiseOutlined style={{ color: '#722ed1' }} />}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} md={10}>
              <Card title={t('dashboard.channelOverview')}>
                {channelData.length === 0 ? (
                  <Empty description={copy.noChannelDataHint} />
                ) : (
                  <div style={{ display: 'grid', gap: 16 }}>
                    {channelData.map((item) => (
                      <div key={item.channel}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span>{item.channel}</span>
                          <span>{item.rate}%</span>
                        </div>
                        <Progress percent={Number(((item.rate / maxRate) * 100).toFixed(0))} showInfo={false} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>

            <Col xs={24} md={14}>
              <Card title={t('dashboard.channelDetail')}>
                <Table
                  rowKey="channel"
                  columns={channelColumns}
                  dataSource={channelData}
                  pagination={false}
                  size="small"
                  locale={{ emptyText: copy.noChannelData }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24}>
              <Card title={t('dashboard.activityOverview')}>
                <Table
                  rowKey="id"
                  columns={activityColumns}
                  dataSource={activityData}
                  pagination={false}
                  locale={{ emptyText: copy.noActivityData }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
