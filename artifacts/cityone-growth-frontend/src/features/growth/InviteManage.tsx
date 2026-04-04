import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Tag, Row, Col, Statistic, message, Modal, Form, InputNumber, Switch } from 'antd'
import { SearchOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'

export default function InviteManage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [stats, setStats] = useState<any>({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [config, setConfig] = useState<any>({})
  const [configLoading, setConfigLoading] = useState(false)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configForm] = Form.useForm()

  const fetchData = useCallback(async (p = page, ps = pageSize) => {
    setLoading(true)
    try {
      const res: any = await request.get('/growth/invite/relations', { params: { pageNum: p, pageSize: ps, keyword: keyword || undefined } })
      setData(res.data?.list || [])
      setTotal(res.data?.total || 0)
    } catch (e) {}
    setLoading(false)
  }, [page, pageSize, keyword])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res: any = await request.get('/growth/invite/stats')
      setStats(res.data || {})
    } catch (e) {}
    setStatsLoading(false)
  }, [])

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const res: any = await request.get('/growth/invite/config')
      setConfig(res.data || {})
    } catch (e) {}
    setConfigLoading(false)
  }, [])

  React.useEffect(() => { fetchData(); fetchStats(); fetchConfig() }, [])

  const handleConfigEdit = () => {
    configForm.setFieldsValue({
      inviter_points: config.inviter_points ?? 100,
      invitee_points: config.invitee_points ?? 50,
      daily_limit: config.daily_limit ?? 10,
      enabled: config.enabled !== false,
    })
    setConfigModalOpen(true)
  }

  const handleConfigSave = async () => {
    try {
      const values = await configForm.validateFields()
      setConfigSaving(true)
      await request.post('/growth/invite/config/save', values)
      message.success('邀请配置已保存')
      setConfigModalOpen(false)
      fetchConfig()
    } catch (e) {}
    setConfigSaving(false)
  }

  const handleSearch = () => { setPage(1); fetchData(1, pageSize) }

  const topColumns = [
    { title: '用户手机', dataIndex: 'mobile', key: 'mobile', width: 140 },
    { title: '昵称', dataIndex: 'nick_name', key: 'nick_name', width: 120 },
    { title: '邀请人数', dataIndex: 'invite_count', key: 'invite_count', width: 100 },
  ]

  const columns = [
    { title: '邀请人手机', dataIndex: 'inviter_mobile', key: 'inviter_mobile', width: 140 },
    { title: '邀请人昵称', dataIndex: 'inviter_name', key: 'inviter_name', width: 120 },
    { title: '被邀请人手机', dataIndex: 'invitee_mobile', key: 'invitee_mobile', width: 140 },
    { title: '被邀请人昵称', dataIndex: 'invitee_name', key: 'invitee_name', width: 120 },
    { title: '邀请码', dataIndex: 'code', key: 'code', width: 120, responsive: ['md' as const] },
    { title: '来源', dataIndex: 'source', key: 'source', width: 100, responsive: ['md' as const], render: (v: string) => <Tag>{v || '--'}</Tag> },
    { title: '绑定时间', dataIndex: 'bound_at', key: 'bound_at', width: 180, responsive: ['lg' as const], render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--' },
  ]

  return (
    <div>
      <Card title="邀请配置" extra={<Button type="primary" icon={<SettingOutlined />} onClick={handleConfigEdit}>编辑配置</Button>} loading={configLoading} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}><Statistic title="邀请人积分" value={config.inviter_points ?? '--'} suffix="分" /></Col>
          <Col xs={12} sm={6}><Statistic title="被邀请人积分" value={config.invitee_points ?? '--'} suffix="分" /></Col>
          <Col xs={12} sm={6}><Statistic title="每日上限" value={config.daily_limit ?? '--'} suffix="次" /></Col>
          <Col xs={12} sm={6}><Statistic title="状态" valueRender={() => config.enabled !== false ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>} /></Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card loading={statsLoading}><Statistic title="总邀请关系" value={stats.totalRelations || 0} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card loading={statsLoading}><Statistic title="总发放奖励" value={stats.totalRewards || 0} suffix="次" /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card loading={statsLoading}><Statistic title="总积分支出" value={stats.totalPoints || 0} suffix="分" /></Card>
        </Col>
      </Row>

      {stats.topInviters && stats.topInviters.length > 0 && (
        <Card title="邀请排行榜" style={{ marginBottom: 16 }}>
          <Table rowKey="mobile" columns={topColumns} dataSource={stats.topInviters} pagination={false} size="small" />
        </Card>
      )}

      <Card styles={{ body: { paddingBottom: 0 } }}>
        <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input placeholder="搜索手机号/昵称/邀请码" prefix={<SearchOutlined />} value={keyword} onChange={e => setKeyword(e.target.value)} onPressEnter={handleSearch} allowClear />
          </Col>
          <Col xs={24} sm={12} md={16}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); fetchData(1, pageSize) }}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Table rowKey={(r: any) => `${r.inviter_mobile}_${r.invitee_mobile}_${r.bound_at}`} columns={columns} dataSource={data} loading={loading} scroll={{ x: 900 }}
          pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) } }}
        />
      </Card>

      <Modal title="编辑邀请配置" open={configModalOpen} onOk={handleConfigSave} onCancel={() => setConfigModalOpen(false)} confirmLoading={configSaving}>
        <Form form={configForm} layout="vertical">
          <Form.Item name="inviter_points" label="邀请人积分奖励" rules={[{ required: true, message: '请输入' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="邀请人获得积分" />
          </Form.Item>
          <Form.Item name="invitee_points" label="被邀请人积分奖励" rules={[{ required: true, message: '请输入' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="被邀请人获得积分" />
          </Form.Item>
          <Form.Item name="daily_limit" label="每日邀请上限" rules={[{ required: true, message: '请输入' }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="每人每日最多邀请次数" />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
