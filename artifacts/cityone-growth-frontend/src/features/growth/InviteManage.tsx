/**
 * 邀请裂变 — 邀请奖励配置 + 邀请关系链路
 * 归因记录已移至「渠道效果」模块，避免与积分规则重叠
 */
import React, { useState, useCallback } from 'react'
import {
  Card, Table, Input, Button, Tag, Row, Col,
  Statistic, message, Modal, Form, InputNumber, Switch,
} from 'antd'
import { ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'

/* ─── Tab1：邀请链路 ──────────────────────────────────────────────────────── */
function InviteTab() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [stats, setStats] = useState<any>({})
  const [config, setConfig] = useState<any>({})
  const [configLoading, setConfigLoading] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configForm] = Form.useForm()

  const keywordRef = React.useRef(keyword)
  keywordRef.current = keyword

  const fetchData = useCallback(async (p: number, ps: number) => {
    setLoading(true)
    try {
      const res: any = await request.get('/growth/invite/relations', {
        params: { pageNum: p, pageSize: ps, keyword: keywordRef.current || undefined },
      })
      setData(res.data?.list || [])
      setTotal(res.data?.total || 0)
      setPage(p)
    } catch {}
    setLoading(false)
  }, [])

  const fetchStats = useCallback(async () => {
    try { const res: any = await request.get('/growth/invite/stats'); setStats(res.data || {}) } catch {}
  }, [])

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true)
    try { const res: any = await request.get('/growth/invite/config'); setConfig(res.data || {}) } catch {}
    setConfigLoading(false)
  }, [])

  React.useEffect(() => {
    Promise.all([fetchData(1, pageSize), fetchStats(), fetchConfig()])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfigSave = async () => {
    const vals = await configForm.validateFields()
    setConfigSaving(true)
    try {
      await request.post('/growth/invite/config/save', vals)
      message.success('配置已保存')
      setConfigOpen(false); fetchConfig()
    } catch {}
    setConfigSaving(false)
  }

  const columns = [
    { title: '邀请人', dataIndex: 'inviter_mobile', key: 'im', width: 140,
      render: (v: string, r: any) => <div><div>{v || r.inviter_id || '—'}</div><div style={{ fontSize: 11, color: '#aaa' }}>{r.inviter_name}</div></div> },
    { title: '被邀请人', dataIndex: 'invitee_mobile', key: 'ie', width: 140,
      render: (v: string, r: any) => <div><div>{v || r.invitee_id || '—'}</div><div style={{ fontSize: 11, color: '#aaa' }}>{r.invitee_name}</div></div> },
    { title: '邀请码', dataIndex: 'code', key: 'code', width: 120,
      render: (v: string) => <Tag style={{ fontFamily: 'monospace' }}>{v || '—'}</Tag> },
    { title: '来源', dataIndex: 'source', key: 'source', width: 90,
      render: (v: string) => <Tag color="blue">{v || '—'}</Tag> },
    { title: '绑定时间', dataIndex: 'bound_at', key: 'bound_at', width: 155,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—' },
  ]

  return (
    <div>
      {/* 邀请配置卡 */}
      <Card
        title="邀请奖励配置"
        extra={<Button type="primary" icon={<SettingOutlined />} onClick={() => { configForm.setFieldsValue({ inviter_points: config.inviter_points ?? 100, invitee_points: config.invitee_points ?? 50, daily_limit: config.daily_limit ?? 10, enabled: config.enabled !== false }); setConfigOpen(true) }}>编辑配置</Button>}
        loading={configLoading}
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}><Statistic title="邀请人奖励" value={config.inviter_points ?? '—'} suffix="积分" /></Col>
          <Col xs={12} sm={6}><Statistic title="被邀请人奖励" value={config.invitee_points ?? '—'} suffix="积分" /></Col>
          <Col xs={12} sm={6}><Statistic title="每日上限" value={config.daily_limit ?? '—'} suffix="次" /></Col>
          <Col xs={12} sm={6}>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>活动状态</div>
            {config.enabled !== false
              ? <Tag color="green" style={{ fontSize: 14, padding: '2px 10px' }}>启用中</Tag>
              : <Tag color="red" style={{ fontSize: 14, padding: '2px 10px' }}>已禁用</Tag>}
          </Col>
        </Row>
      </Card>

      {/* 统计汇总 */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={8}><Card size="small"><Statistic title="总邀请关系" value={stats.totalRelations || 0} /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="已发放奖励" value={stats.totalRewards || 0} suffix="次" /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="累计积分" value={stats.totalPoints || 0} suffix="分" /></Card></Col>
      </Row>

      {/* 邀请记录列表 */}
      <Card styles={{ body: { paddingBottom: 0 } }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input.Search
            placeholder="搜索手机号 / 用户ID"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onSearch={() => fetchData(1, pageSize)}
            style={{ width: 260 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchData(page, pageSize)}>刷新</Button>
        </div>
        <Table
          rowKey={(r: any) => `${r.inviter_mobile}_${r.invitee_mobile}_${r.bound_at}`}
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 700 }}
          size="middle"
          pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) } }}
        />
      </Card>

      {/* 配置弹窗 */}
      <Modal title="编辑邀请奖励配置" open={configOpen} onOk={handleConfigSave} onCancel={() => setConfigOpen(false)} confirmLoading={configSaving} okText="保存" cancelText="取消">
        <Form form={configForm} layout="vertical" style={{ paddingTop: 8 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="inviter_points" label="邀请人奖励（积分）" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="invitee_points" label="被邀请人奖励（积分）" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="daily_limit" label="每日发放上限（次）" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="活动开关" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

/* ─── 主页面 ─────────────────────────────────────────────────────────────── */
export default function InviteManage() {
  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>邀请裂变</div>
        <div style={{ color: '#888', fontSize: 13 }}>管理邀请奖励积分配置与邀请关系链路（归因记录请前往「渠道效果」查看）</div>
      </div>
      <InviteTab />
    </div>
  )
}
