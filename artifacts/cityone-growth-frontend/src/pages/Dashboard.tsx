import React from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Progress } from 'antd'
import {
  FunnelPlotOutlined,
  UserOutlined,
  GiftOutlined,
  FileTextOutlined,
  ShareAltOutlined,
  RiseOutlined,
} from '@ant-design/icons'

export default function Dashboard() {
  const stats = {
    visitCount: 28630,
    newUsers: 5218,
    couponIssued: 6320,
    attributedOrders: 1392,
    inviteUsers: 886,
    conversionRate: 18.2,
  }

  const channelData = [
    { key: '1', channel: 'LINE OA', visits: 12680, users: 2830, orders: 688, rate: 24.3 },
    { key: '2', channel: 'TikTok', visits: 8230, users: 1320, orders: 356, rate: 15.7 },
    { key: '3', channel: 'Facebook', visits: 4560, users: 760, orders: 208, rate: 13.4 },
    { key: '4', channel: '地推二维码', visits: 3160, users: 308, orders: 140, rate: 9.7 },
  ]

  const activityData = [
    { key: '1', name: '扫码抽奖赢免费时长', status: '进行中', participants: 1328, rewards: '30分钟/2小时券', orders: 322 },
    { key: '2', name: '新用户首借免单', status: '进行中', participants: 2311, rewards: '首单免单券', orders: 905 },
    { key: '3', name: '关注 LINE 领券', status: '草稿', participants: 0, rewards: '15分钟券', orders: 0 },
    { key: '4', name: '周末借电返积分', status: '已结束', participants: 889, rewards: '50积分', orders: 165 },
  ]

  const channelColumns = [
    { title: '渠道', dataIndex: 'channel', key: 'channel' },
    { title: '访问量', dataIndex: 'visits', key: 'visits' },
    { title: '拉新人数', dataIndex: 'users', key: 'users' },
    { title: '归因订单', dataIndex: 'orders', key: 'orders' },
    {
      title: '转化率',
      dataIndex: 'rate',
      key: 'rate',
      render: (v: number) => <Tag color={v >= 20 ? 'green' : v >= 12 ? 'blue' : 'default'}>{v}%</Tag>,
    },
  ]

  const activityColumns = [
    { title: '活动名称', dataIndex: 'name', key: 'name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={v === '进行中' ? 'green' : v === '草稿' ? 'gold' : 'default'}>
          {v}
        </Tag>
      ),
    },
    { title: '参与人数', dataIndex: 'participants', key: 'participants' },
    { title: '奖励内容', dataIndex: 'rewards', key: 'rewards' },
    { title: '带来订单', dataIndex: 'orders', key: 'orders' },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>增长总览</h2>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="累计访问量"
              value={stats.visitCount}
              prefix={<FunnelPlotOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="新增用户"
              value={stats.newUsers}
              prefix={<UserOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="发券总量"
              value={stats.couponIssued}
              prefix={<GiftOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="归因订单"
              value={stats.attributedOrders}
              prefix={<FileTextOutlined style={{ color: '#eb2f96' }} />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="邀请裂变用户"
              value={stats.inviteUsers}
              prefix={<ShareAltOutlined style={{ color: '#13c2c2' }} />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="整体转化率"
              value={stats.conversionRate}
              suffix="%"
              prefix={<RiseOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={10}>
          <Card title="渠道贡献概览">
            <div style={{ display: 'grid', gap: 16 }}>
              {channelData.map((item) => (
                <div key={item.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span>{item.channel}</span>
                    <span>{item.rate}%</span>
                  </div>
                  <Progress percent={item.rate} showInfo={false} />
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={14}>
          <Card title="渠道归因明细">
            <Table
              rowKey="key"
              columns={channelColumns}
              dataSource={channelData}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title="活动表现概览">
            <Table
              rowKey="key"
              columns={activityColumns}
              dataSource={activityData}
              pagination={false}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
