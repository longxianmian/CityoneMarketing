import React from 'react'
import { Card, Typography, Space, Tag, Alert, List, Badge, Descriptions } from 'antd'
import { RobotOutlined, MonitorOutlined, AlertOutlined, ApiOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n'

const { Title, Text } = Typography

const MONITOR_ITEMS = [
  { key: 'api', label: 'API 健康监测', status: 'placeholder', desc: '监测各后端服务接口响应状态与延迟' },
  { key: 'entry', label: '入口断链检测', status: 'placeholder', desc: '检测 QR Code / 短链是否正常跳转' },
  { key: 'coupon-issue', label: '券发放异常告警', status: 'placeholder', desc: '发放量异常波动、批次卡住时触发告警' },
  { key: 'coupon-verify', label: '核销异常告警', status: 'placeholder', desc: '核销失败率超阈值时告警' },
  { key: 'data-backfill', label: '数据回填异常', status: 'placeholder', desc: '积分/归因回填任务失败时告警' },
  { key: 'device', label: '设备离线/站点异常', status: 'placeholder', desc: '设备长时间离线或站点容量异常时告警' },
]

const API_ENDPOINTS = [
  '/api/admin/agent/sysops/health',
  '/api/admin/agent/sysops/alerts',
  '/api/admin/agent/sysops/entry-check',
  '/api/admin/agent/sysops/coupon-monitor',
  '/api/admin/agent/sysops/device-status',
]

export default function AgentSysOpsPage() {
  const { t } = useI18n()

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Space>
          <RobotOutlined style={{ fontSize: 28, color: '#fa8c16' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>系统运维 Agent</Title>
            <Text type="secondary">面向系统运维场景，自动监测关键服务状态、异常告警与故障定位。</Text>
          </div>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        message="阶段一骨架"
        description="本页面为阶段一结构占位。监测规则、告警引擎与自动修复链路将在阶段三实现。"
      />

      <Card title={<><MonitorOutlined /> 监测范围（预留）</>}>
        <List
          dataSource={MONITOR_ITEMS}
          renderItem={item => (
            <List.Item>
              <List.Item.Meta
                avatar={<Badge status="default" />}
                title={<Space><Tag color="orange">{item.label}</Tag><Text type="secondary" style={{ fontSize: 12 }}>占位中</Text></Space>}
                description={item.desc}
              />
            </List.Item>
          )}
        />
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message="当前所有监测项均为占位展示，真实监测数据对接将在阶段三实现。"
        />
      </Card>

      <Card title="告警机制（规划）">
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="告警触发">阈值超限 / 服务连续失败 / 数据断流</Descriptions.Item>
          <Descriptions.Item label="通知渠道">后台消息 / LINE OA 推送给运维管理员</Descriptions.Item>
          <Descriptions.Item label="自动处理">部分场景支持自动重试 / 自动回滚（阶段三）</Descriptions.Item>
          <Descriptions.Item label="告警级别">P0 致命 / P1 严重 / P2 警告 / P3 通知</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={<><ApiOutlined /> 接口预留</>}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {API_ENDPOINTS.map(ep => (
            <Text key={ep} code style={{ display: 'block', fontSize: 12 }}>{ep}</Text>
          ))}
        </Space>
      </Card>
    </Space>
  )
}
