import React from 'react'
import { Card, Typography, Space, Tag, Alert, Descriptions } from 'antd'
import { RobotOutlined, MessageOutlined, BulbOutlined, ApiOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n'

const { Title, Paragraph, Text } = Typography

export default function AgentWenwenPage() {
  const { t } = useI18n()

  const capabilities = [
    { key: 'faq', label: '常见问题解答', desc: '自动回答借充电宝、归还、收费等高频问题' },
    { key: 'coupon', label: '权益查询与引导（可用卡券）', desc: '查询用户当前可用权益（含卡券物品），引导核销或使用流程' },
    { key: 'points', label: '积分查询', desc: '查询积分余额、明细、兑换入口' },
    { key: 'site', label: '站点查询', desc: '查找附近站点、设备状态' },
    { key: 'activity', label: '活动说明', desc: '介绍当前进行中的活动规则与参与方式' },
    { key: 'order', label: '订单查询', desc: '查询借用订单状态与记录' },
  ]

  const apiEndpoints = [
    'POST /api/agent/wenwen/chat',
    'GET  /api/agent/wenwen/session/:id',
    'POST /api/agent/wenwen/feedback',
    'GET  /api/agent/wenwen/suggestions',
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Space>
          <RobotOutlined style={{ fontSize: 28, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>问问 Agent</Title>
            <Text type="secondary">用于用户端问答与常见问题相关能力。面向 LINE OA 用户提供智能对话服务。</Text>
          </div>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        message="阶段一骨架"
        description="本页面为阶段一结构占位。Agent 核心能力（NLU、意图识别、工具调用链路）将在阶段二对接。"
      />

      <Card title={<><BulbOutlined /> 核心能力范围</>}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {capabilities.map(c => (
            <Card key={c.key} size="small" style={{ background: '#fafafa' }}>
              <Space>
                <Tag color="blue">{c.label}</Tag>
                <Text type="secondary">{c.desc}</Text>
              </Space>
            </Card>
          ))}
        </Space>
      </Card>

      <Card title={<><MessageOutlined /> 适用场景</>}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="用户端入口">LINE OA 聊天窗口 / 问问页面（/agent/chat）</Descriptions.Item>
          <Descriptions.Item label="触发方式">用户主动发消息 / 点击快捷提问</Descriptions.Item>
          <Descriptions.Item label="身份识别">通过 LINE User ID 识别三层身份：粉丝（已关注OA）/ 用户（进入业务链路）/ 会员（已缴押金）</Descriptions.Item>
          <Descriptions.Item label="能力分层">粉丝可查询基础信息；用户可查询权益/订单；会员可查询全部能力含押金状态</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={<><ApiOutlined /> 接口预留</>}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {apiEndpoints.map(ep => (
            <Text key={ep} code style={{ display: 'block' }}>{ep}</Text>
          ))}
        </Space>
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message="接口尚未对接，当前用户端走 /api/agent/chat（前端直连），正式 Agent 链路在阶段二实现。"
        />
      </Card>
    </Space>
  )
}
