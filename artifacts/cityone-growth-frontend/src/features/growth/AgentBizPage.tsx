import React, { useState } from 'react'
import { Card, Typography, Space, Tag, Alert, Tabs, Descriptions, List, Badge } from 'antd'
import { RobotOutlined, ShopOutlined, NotificationOutlined, TeamOutlined, ApiOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n'

const { Title, Paragraph, Text } = Typography

const BIZ_AGENTS = [
  {
    key: 'commerce',
    label: '商务 Agent',
    icon: <ShopOutlined />,
    color: 'purple',
    desc: '面向商务团队，聚焦合作商户、设备站点、合同与营收数据的智能查询与汇总。',
    kpis: ['站点在线率', '日均订单量', '营收日报', '设备离线告警', '合作商户状态'],
    apis: [
      '/api/admin/agent/business/summary?dept=biz',
      '/api/admin/agent/business/kpi-details?dept=biz',
      '/api/admin/agent/business/alerts?dept=biz',
      '/api/admin/agent/business/context?dept=biz',
    ],
  },
  {
    key: 'marketing',
    label: '推广 Agent',
    icon: <NotificationOutlined />,
    color: 'orange',
    desc: '面向推广团队，聚焦活动效果、渠道流量、粉丝增长、用户转化数据的智能分析与建议。',
    kpis: ['活动新增粉丝', '渠道转化率', '裂变邀请成功数', '优惠券使用率', '活动 ROI 估算'],
    apis: [
      '/api/admin/agent/business/summary?dept=marketing',
      '/api/admin/agent/business/kpi-details?dept=marketing',
      '/api/admin/agent/business/alerts?dept=marketing',
      '/api/admin/agent/business/context?dept=marketing',
    ],
  },
  {
    key: 'ops',
    label: '运营 Agent',
    icon: <TeamOutlined />,
    color: 'green',
    desc: '面向运营团队，聚焦用户生命周期、积分账户、权益发放、会员成长数据的运营支持。',
    kpis: ['用户活跃度', '积分发放总量', '权益兑换率', '会员新增数', '用户留存率'],
    apis: [
      '/api/admin/agent/business/summary?dept=ops',
      '/api/admin/agent/business/kpi-details?dept=ops',
      '/api/admin/agent/business/alerts?dept=ops',
      '/api/admin/agent/business/context?dept=ops',
    ],
  },
]

export default function AgentBizPage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState('commerce')

  const active = BIZ_AGENTS.find(a => a.key === activeTab)!

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Space>
          <RobotOutlined style={{ fontSize: 28, color: '#722ed1' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>业务管理 Agent</Title>
            <Text type="secondary">面向内部业务团队，提供商务 / 推广 / 运营三类智能数据分析与告警服务。</Text>
          </div>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        message="阶段一骨架"
        description="本页面为阶段一结构占位。三类 Agent 的 KPI 数据对接、告警引擎与 GPT 分析链路将在阶段二实现。"
      />

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={BIZ_AGENTS.map(a => ({
            key: a.key,
            label: <Space>{a.icon}<span>{a.label}</span></Space>,
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Alert type="success" showIcon message={<Text strong>{a.label}</Text>} description={a.desc} />

                <Card title="KPI 监控指标（预留）" size="small">
                  <Space wrap>
                    {a.kpis.map(kpi => (
                      <Tag key={kpi} color={a.color}>{kpi}</Tag>
                    ))}
                  </Space>
                  <Alert
                    style={{ marginTop: 8 }}
                    type="warning"
                    message="当前为占位展示，真实数据将在阶段二对接后台 KPI 接口后呈现。"
                  />
                </Card>

                <Card title={<><ApiOutlined /> 接口预留</>} size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {a.apis.map(ep => (
                      <Text key={ep} code style={{ display: 'block', fontSize: 12 }}>{ep}</Text>
                    ))}
                  </Space>
                </Card>

                <Card title="工作方式" size="small">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="触发方式">定时推送（日报/周报）+ 主动问询</Descriptions.Item>
                    <Descriptions.Item label="推送渠道">LINE OA 消息 / 后台内部通知</Descriptions.Item>
                    <Descriptions.Item label="访问权限">仅限对应部门账户</Descriptions.Item>
                    <Descriptions.Item label="数据来源">增长系统后台 + A 系统订单数据（阶段四对接）</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Space>
            ),
          }))}
        />
      </Card>
    </Space>
  )
}
