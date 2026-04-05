import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Tag, Row, Col, Statistic, message, Modal, Form, InputNumber, Switch } from 'antd'
import { SearchOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'

export default function InviteManage() {
  const { t } = useI18n()
  const iv = (key: string) => t(`admin.invite.${key}`)

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
    try { const res: any = await request.get('/growth/invite/stats'); setStats(res.data || {}) }
    catch (e) {}
    setStatsLoading(false)
  }, [])

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true)
    try { const res: any = await request.get('/growth/invite/config'); setConfig(res.data || {}) }
    catch (e) {}
    setConfigLoading(false)
  }, [])

  React.useEffect(() => { fetchData(); fetchStats(); fetchConfig() }, [])

  const handleConfigEdit = () => {
    configForm.setFieldsValue({ inviter_points: config.inviter_points ?? 100, invitee_points: config.invitee_points ?? 50, daily_limit: config.daily_limit ?? 10, enabled: config.enabled !== false })
    setConfigModalOpen(true)
  }

  const handleConfigSave = async () => {
    try {
      const values = await configForm.validateFields()
      setConfigSaving(true)
      await request.post('/growth/invite/config/save', values)
      message.success(iv('configSaved'))
      setConfigModalOpen(false)
      fetchConfig()
    } catch (e) {}
    setConfigSaving(false)
  }

  const handleSearch = () => { setPage(1); fetchData(1, pageSize) }

  const topColumns = [
    { title: iv('colMobile'), dataIndex: 'mobile', key: 'mobile', width: 140 },
    { title: iv('colNickName'), dataIndex: 'nick_name', key: 'nick_name', width: 120 },
    { title: iv('colInviteCount'), dataIndex: 'invite_count', key: 'invite_count', width: 100 },
  ]

  const columns = [
    { title: iv('colInviterMobile'), dataIndex: 'inviter_mobile', key: 'inviter_mobile', width: 140 },
    { title: iv('colInviterName'), dataIndex: 'inviter_name', key: 'inviter_name', width: 120 },
    { title: iv('colInviteeMobile'), dataIndex: 'invitee_mobile', key: 'invitee_mobile', width: 140 },
    { title: iv('colInviteeName'), dataIndex: 'invitee_name', key: 'invitee_name', width: 120 },
    { title: iv('colCode'), dataIndex: 'code', key: 'code', width: 120, responsive: ['md' as const] },
    { title: iv('colSource'), dataIndex: 'source', key: 'source', width: 100, responsive: ['md' as const], render: (v: string) => <Tag>{v || '--'}</Tag> },
    { title: iv('colBoundAt'), dataIndex: 'bound_at', key: 'bound_at', width: 180, responsive: ['lg' as const], render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--' },
  ]

  return (
    <div>
      <Card title={iv('configTitle')} extra={<Button type="primary" icon={<SettingOutlined />} onClick={handleConfigEdit}>{iv('editConfig')}</Button>} loading={configLoading} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}><Statistic title={iv('inviterPoints')} value={config.inviter_points ?? '--'} suffix={iv('pts')} /></Col>
          <Col xs={12} sm={6}><Statistic title={iv('inviteePoints')} value={config.invitee_points ?? '--'} suffix={iv('pts')} /></Col>
          <Col xs={12} sm={6}><Statistic title={iv('dailyLimit')} value={config.daily_limit ?? '--'} suffix={iv('times')} /></Col>
          <Col xs={12} sm={6}><Statistic title={iv('status')} valueRender={() => config.enabled !== false ? <Tag color="green">{iv('statusOn')}</Tag> : <Tag color="red">{iv('statusOff')}</Tag>} /></Col>
        </Row>
      </Card>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card loading={statsLoading}><Statistic title={iv('statRelations')} value={stats.totalRelations || 0} /></Card></Col>
        <Col xs={24} sm={8}><Card loading={statsLoading}><Statistic title={iv('statRewards')} value={stats.totalRewards || 0} suffix={iv('times')} /></Card></Col>
        <Col xs={24} sm={8}><Card loading={statsLoading}><Statistic title={iv('statPoints')} value={stats.totalPoints || 0} suffix={iv('pts')} /></Card></Col>
      </Row>
      {stats.topInviters && stats.topInviters.length > 0 && (
        <Card title={iv('rankTitle')} style={{ marginBottom: 16 }}>
          <Table rowKey="mobile" columns={topColumns} dataSource={stats.topInviters} pagination={false} size="small" />
        </Card>
      )}
      <Card styles={{ body: { paddingBottom: 0 } }}>
        <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input placeholder={iv('searchPlaceholder')} prefix={<SearchOutlined />} value={keyword} onChange={e => setKeyword(e.target.value)} onPressEnter={handleSearch} allowClear />
          </Col>
          <Col xs={24} sm={12} md={16}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>{iv('btnSearch')}</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); fetchData(1, pageSize) }}>{iv('btnReset')}</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Table rowKey={(r: any) => `${r.inviter_mobile}_${r.invitee_mobile}_${r.bound_at}`} columns={columns} dataSource={data} loading={loading} scroll={{ x: 900 }}
          pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (total) => iv('totalRows').replace('{n}', String(total)), onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) } }}
        />
      </Card>
      <Modal title={iv('configModalTitle')} open={configModalOpen} onOk={handleConfigSave} onCancel={() => setConfigModalOpen(false)} confirmLoading={configSaving}>
        <Form form={configForm} layout="vertical">
          <Form.Item name="inviter_points" label={iv('formInviterPoints')} rules={[{ required: true, message: iv('fieldRequired') }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="invitee_points" label={iv('formInviteePoints')} rules={[{ required: true, message: iv('fieldRequired') }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="daily_limit" label={iv('formDailyLimit')} rules={[{ required: true, message: iv('fieldRequired') }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label={iv('formEnabled')} valuePropName="checked">
            <Switch checkedChildren={iv('statusOn')} unCheckedChildren={iv('statusOff')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
