import React, { useMemo } from 'react'
import { Alert, Card, Col, Row, Space, Statistic, Table, Tag, Typography } from 'antd'
import {
  BarChartOutlined,
  BuildOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  RobotOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useLocation } from 'react-router-dom'

const { Title, Paragraph, Text } = Typography

type AssetRow = {
  key: string
  asset: string
  retained: string
  futureUse: string
}

export default function AgentReservedPage() {
  const location = useLocation()
  const isOps = location.pathname.includes('/agent/sysops')

  const page = useMemo(() => {
    if (isOps) {
      return {
        title: '运维 Agent',
        agentCode: 'digital_ops_engineer',
        color: '#fa8c16',
        icon: <ToolOutlined style={{ fontSize: 32, color: '#fa8c16', marginTop: 4 }} />,
        summary: '当前先作为预留二开位保留，不直接承接生产自动修复动作。',
        description: '已保留运维故障词典、修复动作、风险边界和授权流骨架，后续可以在确认生产权限模型后继续深挖。',
        stats: [
          { key: 'agent', title: '保留 Agent', value: 1, prefix: <RobotOutlined /> },
          { key: 'keywords', title: '关键词模板', value: 1, prefix: <DeploymentUnitOutlined /> },
          { key: 'skills', title: '可复用 Skills', value: 3, prefix: <BuildOutlined /> },
          { key: 'issues', title: '故障类型字典', value: 9, prefix: <DatabaseOutlined /> },
          { key: 'repairs', title: '修复动作字典', value: 8, prefix: <WarningOutlined /> },
        ],
        assets: [
          {
            key: 'ops-keywords',
            asset: '角色关键词',
            retained: '已保留 digital_ops_engineer 的中文角色关键词模板',
            futureUse: '后续可继续补泰文/英文版本，并和授权流联动',
          },
          {
            key: 'ops-skills',
            asset: 'Skills 骨架',
            retained: '已保留 3 个可复用 Skill：问题检测、低风险自动修复、超管授权申请',
            futureUse: '后续接入真实监控、配置中心、审计日志后可直接扩展',
          },
          {
            key: 'ops-issues',
            asset: '故障字典',
            retained: '已保留 9 类故障类型，用于归类登录失败、权限异常、接口不可用等问题',
            futureUse: '后续可以接自动诊断规则和问题升级流程',
          },
          {
            key: 'ops-repairs',
            asset: '修复动作',
            retained: '已保留 8 类修复动作与 requires_approval 风险边界',
            futureUse: '后续可接真正的安全执行器，而不是只做配置展示',
          },
          {
            key: 'ops-auth',
            asset: '授权流',
            retained: '页面和数据结构里已经有高风险动作需超管授权的骨架',
            futureUse: '后续可继续补审批记录、执行回放、回滚审计',
          },
        ] as AssetRow[],
        notes: [
          '当前建议仅保留架构和配置资产，不启用真实自动修复。',
          '如果后续要上线，必须先补生产权限模型、审批流、审计日志和回滚机制。',
          '运维 Agent 未来更适合作为内部助手，不建议直接暴露给用户侧。',
        ],
      }
    }

    return {
      title: '业务管理 Agent',
      agentCode: 'digital_business_manager',
      color: '#722ed1',
      icon: <BarChartOutlined style={{ fontSize: 32, color: '#722ed1', marginTop: 4 }} />,
      summary: '当前先作为预留二开位保留，不直接作为独立业务 Agent 投入使用。',
      description: '已保留 KPI、报表模板、预警规则、动作建议等经营分析资产，后续可以按商务/推广/运营三个方向继续拆分。',
      stats: [
        { key: 'agent', title: '保留 Agent', value: 1, prefix: <RobotOutlined /> },
        { key: 'keywords', title: '关键词模板', value: 1, prefix: <DeploymentUnitOutlined /> },
        { key: 'skills', title: '可复用 Skills', value: 2, prefix: <BuildOutlined /> },
        { key: 'kpi', title: 'KPI 指标', value: 18, prefix: <DatabaseOutlined /> },
        { key: 'reports', title: '报表模板', value: 10, prefix: <BarChartOutlined /> },
      ],
      assets: [
        {
          key: 'biz-keywords',
          asset: '角色关键词',
          retained: '已保留 digital_business_manager 的中文角色关键词模板',
          futureUse: '后续可补足多语言版本，按部门输出差异化分析口径',
        },
        {
          key: 'biz-skills',
          asset: 'Skills 骨架',
          retained: '已保留日报、周报 2 个基础 Skill，可继续扩展月报、复盘、渠道分析',
          futureUse: '后续接真实数据源后可直接升级为报表生成链路',
        },
        {
          key: 'biz-kpi',
          asset: 'KPI 指标',
          retained: '已保留 18 条 KPI 指标配置，覆盖业务分析基础字段',
          futureUse: '后续可按商务/推广/运营拆成独立 Agent 或独立 Tab',
        },
        {
          key: 'biz-reports',
          asset: '报表模板',
          retained: '已保留 10 个报表模板，包含日报、周报、月报、活动/渠道/站点复盘',
          futureUse: '后续可对接真实 BI 结果，生成经营复盘内容',
        },
        {
          key: 'biz-alerts',
          asset: '预警与动作建议',
          retained: '已保留 5 条预警规则、3 条动作建议模板',
          futureUse: '后续可升级为经营异常预警与经营建议助手',
        },
      ] as AssetRow[],
      notes: [
        '当前三个旧路由“商务 / 推广 / 运营”本质共用同一个 agent_code，不建议继续假装是三个独立 Agent。',
        '更合理的做法是先保留一套统一业务管理骨架，后续再按真实组织和数据权限拆分。',
        '在接入真实数据前，这个 Agent 更适合作为内部分析能力预留位，而不是正式运营入口。',
      ],
    }
  }, [isOps])

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Space align="start" style={{ width: '100%' }}>
          {page.icon}
          <div style={{ flex: 1 }}>
            <Space align="center" wrap>
              <Title level={4} style={{ margin: 0 }}>{page.title}</Title>
              <Tag color={page.color}>{page.agentCode}</Tag>
              <Tag color="gold">预留二开</Tag>
              <Tag>当前只保留架构资产</Tag>
            </Space>
            <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
              {page.summary}
            </Paragraph>
          </div>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        message={`${page.title} 当前不作为正式上线能力交付`}
        description={page.description}
      />

      <Row gutter={[16, 16]}>
        {page.stats.map((item) => (
          <Col xs={24} sm={12} lg={Math.max(4, Math.floor(24 / page.stats.length))} key={item.key}>
            <Card>
              <Statistic title={item.title} value={item.value} prefix={item.prefix} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="可保留用于二开的资产">
        <Table
          rowKey="key"
          pagination={false}
          size="small"
          dataSource={page.assets}
          columns={[
            { title: '资产类型', dataIndex: 'asset', width: 140 },
            { title: '当前保留内容', dataIndex: 'retained' },
            { title: '后续二开用途', dataIndex: 'futureUse' },
          ]}
        />
      </Card>

      <Card title="当前建议">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {page.notes.map((note, index) => (
            <div key={index} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Tag color={page.color} style={{ marginTop: 2 }}>{index + 1}</Tag>
              <Text>{note}</Text>
            </div>
          ))}
        </Space>
      </Card>
    </Space>
  )
}
