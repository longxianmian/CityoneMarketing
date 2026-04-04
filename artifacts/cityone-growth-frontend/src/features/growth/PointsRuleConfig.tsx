import React, { useState, useEffect } from 'react'
import { Card, Table, Tag, Descriptions, Alert, Spin } from 'antd'
import { getPointsRules } from '../../api/growth'
import dayjs from 'dayjs'

const ruleTypeMap: Record<string, { label: string; color: string }> = {
  EARN_ORDER_COMPLETE: { label: '消费赚积分', color: 'green' },
  EARN_SHARE_REGISTER: { label: '分享注册奖励', color: 'blue' },
  EARN_DAILY_CHECKIN: { label: '每日签到', color: 'cyan' },
  EARN_ACTIVITY: { label: '活动奖励', color: 'purple' },
  EARN_SHARE_FOLLOW: { label: '分享关注奖励', color: 'geekblue' },
}

export default function PointsRuleConfig() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRules = async () => {
    setLoading(true)
    try {
      const res: any = await getPointsRules()
      setRules(res.data?.rules || [])
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => { fetchRules() }, [])

  const columns = [
    {
      title: '规则标识', dataIndex: 'rule_key', key: 'rule_key', width: 200,
      render: (v: string) => {
        const r = ruleTypeMap[v]
        return r ? <Tag color={r.color}>{r.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: '积分值', dataIndex: 'points_value', key: 'points_value', width: 120,
      render: (v: number, r: any) =>
        r.rule_key === 'EARN_ORDER_COMPLETE' ? `${v} 分/THB` : `${v} 分/次`,
    },
    {
      title: '适用范围', dataIndex: 'scope_type', key: 'scope_type', width: 100,
      render: (v: string) => v === 'global' ? <Tag>全局</Tag> : <Tag color="orange">{v || '--'}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => v === 'on' || v === 'active'
        ? <Tag color="success">启用</Tag>
        : <Tag color="default">停用</Tag>,
    },
    {
      title: '优先级', dataIndex: 'priority', key: 'priority', width: 80,
      responsive: ['md' as const],
    },
    {
      title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 160,
      responsive: ['lg' as const],
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--',
    },
    {
      title: '备注', dataIndex: 'memo', key: 'memo', ellipsis: true,
      responsive: ['lg' as const],
    },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Descriptions title="积分规则说明" column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="消费积分">1 THB 实付 = N 积分（N 可配置）</Descriptions.Item>
          <Descriptions.Item label="分享奖励">好友成功关注 OA = N 积分/人</Descriptions.Item>
          <Descriptions.Item label="取关扣回">3 天内取关，积分失效或扣回</Descriptions.Item>
          <Descriptions.Item label="优先级">campaign/channel {'>'} global</Descriptions.Item>
          <Descriptions.Item label="不计分项">押金/优惠抵扣/积分抵扣/退款</Descriptions.Item>
          <Descriptions.Item label="规则快照">修改规则不影响历史流水</Descriptions.Item>
        </Descriptions>
      </Card>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="当前积分规则为只读展示，规则编辑功能待后端接口就绪后开放。"
      />

      <Card title="积分规则列表">
        <Spin spinning={loading}>
          <Table
            rowKey={(r) => r.id || r.rule_key}
            columns={columns}
            dataSource={rules}
            loading={false}
            scroll={{ x: 700 }}
            pagination={false}
            locale={{ emptyText: '暂无规则数据' }}
          />
        </Spin>
      </Card>
    </div>
  )
}
