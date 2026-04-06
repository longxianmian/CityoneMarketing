import React, { useState, useEffect } from 'react'
import { Card, Table, Tag, Descriptions, Alert, Spin } from 'antd'
import { getPointsRules } from '../../api/growth'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'

export default function PointsRuleConfig() {
  const { t } = useI18n()
  const pr = (key: string) => t(`pointsRuleConfig.${key}`)

  const ruleTypeMap: Record<string, { label: string; color: string }> = {
    EARN_ORDER_COMPLETE: { label: pr('ruleOrder'), color: 'green' },
    EARN_SHARE_REGISTER: { label: pr('ruleShareReg'), color: 'blue' },
    EARN_DAILY_CHECKIN: { label: pr('ruleCheckin'), color: 'cyan' },
    EARN_ACTIVITY: { label: pr('ruleActivity'), color: 'purple' },
    EARN_SHARE_FOLLOW: { label: pr('ruleShareFollow'), color: 'geekblue' },
  }

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
      title: pr('colRuleKey'), dataIndex: 'rule_key', key: 'rule_key', width: 200,
      render: (v: string) => {
        const r = ruleTypeMap[v]
        return r ? <Tag color={r.color}>{r.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: pr('colValue'), dataIndex: 'points_value', key: 'points_value', width: 120,
      render: (v: number, r: any) => r.rule_key === 'EARN_ORDER_COMPLETE' ? `${v} ${pr('unitPerTHB')}` : `${v} ${pr('unitPerTime')}`,
    },
    {
      title: pr('colScope'), dataIndex: 'scope_type', key: 'scope_type', width: 100,
      render: (v: string) => v === 'global' ? <Tag>{pr('scopeGlobal')}</Tag> : <Tag color="orange">{v || '--'}</Tag>,
    },
    {
      title: pr('colStatus'), dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => v === 'on' || v === 'active' ? <Tag color="success">{pr('statusOn')}</Tag> : <Tag color="default">{pr('statusOff')}</Tag>,
    },
    { title: pr('colPriority'), dataIndex: 'priority', key: 'priority', width: 80, responsive: ['md' as const] },
    { title: pr('colUpdatedAt'), dataIndex: 'updated_at', key: 'updated_at', width: 160, responsive: ['lg' as const], render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--' },
    { title: pr('colMemo'), dataIndex: 'memo', key: 'memo', ellipsis: true, responsive: ['lg' as const] },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Descriptions title={pr('descTitle')} column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label={pr('descOrderPoints')}>{pr('descOrderPointsVal')}</Descriptions.Item>
          <Descriptions.Item label={pr('descShareReward')}>{pr('descShareRewardVal')}</Descriptions.Item>
          <Descriptions.Item label={pr('descUnfollow')}>{pr('descUnfollowVal')}</Descriptions.Item>
          <Descriptions.Item label={pr('descPriority')}>{pr('descPriorityVal')}</Descriptions.Item>
          <Descriptions.Item label={pr('descExclude')}>{pr('descExcludeVal')}</Descriptions.Item>
          <Descriptions.Item label={pr('descSnapshot')}>{pr('descSnapshotVal')}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message={pr('readonlyNotice')} />
      <Card title={pr('tableTitle')}>
        <Spin spinning={loading}>
          <Table
            rowKey={(r) => r.id || r.rule_key}
            columns={columns}
            dataSource={rules}
            loading={false}
            scroll={{ x: 700 }}
            pagination={false}
            locale={{ emptyText: pr('emptyText') }}
          />
        </Spin>
      </Card>
    </div>
  )
}
