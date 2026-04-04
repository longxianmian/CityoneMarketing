import React, { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Typography,
  Space,
  Alert,
  Tabs,
  Table,
  Tag,
  Form,
  Input,
  Button,
  Row,
  Col,
  Modal,
  Select,
  message,
  Popconfirm,
} from 'antd'
import {
  getRouteList,
  getRouteLogs,
  createRoute,
  updateRoute,
  enableRoute,
  disableRoute,
  testRouteMatch,
} from '../../api/growth'
import { useI18n } from '../../i18n'

const { Title, Text } = Typography

type RouteRule = {
  route_rule_id: string
  rule_name: string
  site_id: string
  entry_type: string
  feature_name: string
  priority: number
  status: string
  route_source?: string
  updated_at?: string
}

type RouteLog = {
  route_log_id: string
  entry_type: string
  entry_code: string
  matched_rule_id: string
  route_result: string
  user_status: string
  created_at?: string
}

export default function RouteCenter() {
  const { t } = useI18n('admin')
  const rt = (key: string) => t(`admin.route.${key}`)

  const [loading, setLoading] = useState(false)
  const [rules, setRules] = useState<RouteRule[]>([])
  const [logs, setLogs] = useState<RouteLog[]>([])
  const [matchResult, setMatchResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [testForm] = Form.useForm()
  const [filterForm] = Form.useForm()
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RouteRule | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError('')

      const [rulesRes, logsRes] = await Promise.all([getRouteList(), getRouteLogs()])

      setRules(rulesRes?.data || [])
      setLogs(logsRes?.data || [])
    } catch (err: any) {
      setError(err?.message || rt('loadError'))
    } finally {
      setLoading(false)
    }
  }

  async function handleTest(values: any) {
    try {
      setError('')
      const res = await testRouteMatch(values)
      setMatchResult(res?.data || null)
      message.success(rt('testSuccess'))
    } catch (err: any) {
      setError(err?.message || rt('testError'))
    }
  }

  const filterValues = Form.useWatch([], filterForm) || {}
  const ruleKeyword = String(filterValues.rule_keyword || '').trim().toLowerCase()
  const ruleEntryType = String(filterValues.entry_type || '').trim()
  const ruleStatus = String(filterValues.status || '').trim()

  const filteredRules = useMemo(() => {
    return rules.filter((item) => {
      const matchKeyword =
        !ruleKeyword ||
        item.rule_name.toLowerCase().includes(ruleKeyword) ||
        item.site_id.toLowerCase().includes(ruleKeyword) ||
        item.route_rule_id.toLowerCase().includes(ruleKeyword)

      const matchEntryType = !ruleEntryType || item.entry_type === ruleEntryType
      const matchStatus = !ruleStatus || item.status === ruleStatus

      return matchKeyword && matchEntryType && matchStatus
    })
  }, [rules, ruleKeyword, ruleEntryType, ruleStatus])

  async function handleCreateRule(values: any) {
    try {
      setSubmitting(true)
      await createRoute(values)
      message.success(rt('saveSuccess'))
      setCreateOpen(false)
      createForm.resetFields()
      await loadData()
    } catch (err: any) {
      setError(err?.message || rt('saveError'))
    } finally {
      setSubmitting(false)
    }
  }

  function openEditModal(record: RouteRule) {
    setEditingRule(record)
    editForm.setFieldsValue({
      rule_name: record.rule_name,
      site_id: record.site_id,
      entry_type: record.entry_type,
      feature_name: record.feature_name,
      priority: String(record.priority),
    })
    setEditOpen(true)
  }

  async function handleEditRule(values: any) {
    if (!editingRule) return

    try {
      setSubmitting(true)
      await updateRoute(editingRule.route_rule_id, values)
      message.success(rt('updateSuccess'))
      setEditOpen(false)
      setEditingRule(null)
      editForm.resetFields()
      await loadData()
    } catch (err: any) {
      setError(err?.message || rt('updateError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleStatus(record: RouteRule) {
    try {
      setSubmitting(true)

      if (record.status === 'enabled') {
        await disableRoute(record.route_rule_id)
        message.success(rt('disableSuccess'))
      } else {
        await enableRoute(record.route_rule_id)
        message.success(rt('enableSuccess'))
      }

      await loadData()
    } catch (err: any) {
      setError(err?.message || rt('statusError'))
    } finally {
      setSubmitting(false)
    }
  }

  const routeFormFields = (
    <>
      <Form.Item name="rule_name" label={rt('formRuleName')} rules={[{ required: true, message: rt('formRuleNameRequired') }]}>
        <Input placeholder={rt('formRuleNamePlaceholder')} />
      </Form.Item>

      <Form.Item name="site_id" label={rt('formSiteId')} rules={[{ required: true, message: rt('formSiteIdRequired') }]}>
        <Input placeholder={rt('formSiteIdPlaceholder')} />
      </Form.Item>

      <Form.Item name="entry_type" label={rt('formEntryType')} rules={[{ required: true, message: rt('formEntryTypeRequired') }]}>
        <Select
          options={[
            { label: 'table_card', value: 'table_card' },
            { label: 'device_qr', value: 'device_qr' },
          ]}
        />
      </Form.Item>

      <Form.Item name="feature_name" label={rt('formFeatureName')} rules={[{ required: true, message: rt('formFeatureNameRequired') }]}>
        <Select
          options={[
            { label: 'shake', value: 'shake' },
            { label: 'battery_sos', value: 'battery_sos' },
            { label: 'flash_coupon', value: 'flash_coupon' },
          ]}
        />
      </Form.Item>

      <Form.Item name="priority" label={rt('formPriority')} initialValue="100">
        <Input placeholder={rt('formPriorityPlaceholder')} />
      </Form.Item>
    </>
  )

  const tabItems = [
    {
      key: 'rules',
      label: rt('tabsRules'),
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card title={rt('filterTitle')}>
            <Form form={filterForm} layout="vertical">
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="rule_keyword" label={rt('keyword')}>
                    <Input placeholder={rt('keywordPlaceholder')} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="entry_type" label={rt('entryType')}>
                    <Select
                      allowClear
                      placeholder={rt('all')}
                      options={[
                        { label: 'table_card', value: 'table_card' },
                        { label: 'device_qr', value: 'device_qr' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="status" label={rt('status')}>
                    <Select
                      allowClear
                      placeholder={rt('all')}
                      options={[
                        { label: rt('enabled'), value: 'enabled' },
                        { label: rt('disabled'), value: 'disabled' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Space>
                <Button onClick={() => filterForm.resetFields()}>{rt('resetFilter')}</Button>
                <Button type="primary" onClick={() => setCreateOpen(true)}>
                  {rt('newRule')}
                </Button>
              </Space>
            </Form>
          </Card>

          <Card title={rt('listTitle')} loading={loading}>
            <Table
              rowKey="route_rule_id"
              pagination={false}
              dataSource={filteredRules}
              columns={[
                { title: rt('ruleId'), dataIndex: 'route_rule_id' },
                { title: rt('ruleName'), dataIndex: 'rule_name' },
                { title: rt('siteId'), dataIndex: 'site_id' },
                { title: rt('entryType'), dataIndex: 'entry_type' },
                { title: rt('featureName'), dataIndex: 'feature_name', render: (v) => <Tag color="purple">{v}</Tag> },
                { title: rt('priority'), dataIndex: 'priority' },
                { title: rt('source'), dataIndex: 'route_source', render: (v) => <Tag>{v || '-'}</Tag> },
                {
                  title: rt('status'),
                  dataIndex: 'status',
                  render: (v) => <Tag color={v === 'enabled' ? 'green' : 'default'}>{v}</Tag>,
                },
                {
                  title: rt('actions'),
                  key: 'actions',
                  render: (_, record: RouteRule) => (
                    <Space wrap>
                      <Button size="small" onClick={() => openEditModal(record)}>
                        {rt('edit')}
                      </Button>
                      <Popconfirm
                        title={record.status === 'enabled' ? rt('confirmDisable') : rt('confirmEnable')}
                        onConfirm={() => handleToggleStatus(record)}
                        okText={rt('ok')}
                        cancelText={rt('cancel')}
                      >
                        <Button size="small" loading={submitting}>
                          {record.status === 'enabled' ? rt('disable') : rt('enable')}
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>

          <Modal
            title={rt('createRule')}
            open={createOpen}
            onCancel={() => setCreateOpen(false)}
            onOk={() => createForm.submit()}
            okText={rt('save')}
            cancelText={rt('cancel')}
            confirmLoading={submitting}
          >
            <Form form={createForm} layout="vertical" onFinish={handleCreateRule}>
              {routeFormFields}
            </Form>
          </Modal>

          <Modal
            title={rt('editRule')}
            open={editOpen}
            onCancel={() => {
              setEditOpen(false)
              setEditingRule(null)
              editForm.resetFields()
            }}
            onOk={() => editForm.submit()}
            okText={rt('update')}
            cancelText={rt('cancel')}
            confirmLoading={submitting}
          >
            <Form form={editForm} layout="vertical" onFinish={handleEditRule}>
              {routeFormFields}
            </Form>
          </Modal>
        </Space>
      ),
    },
    {
      key: 'test',
      label: rt('tabsTest'),
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card title={rt('testTitle')}>
            <Form form={testForm} layout="vertical" onFinish={handleTest}>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="site_id" label={rt('siteId')} initialValue="site_001">
                    <Input placeholder={rt('formSiteIdPlaceholder')} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="entry_type" label={rt('entryType')} initialValue="table_card">
                    <Input placeholder="table_card / device_qr" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="entry_code" label={rt('entryCode')} initialValue="T001">
                    <Input placeholder="T001 / D001" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="referrer_type" label={rt('formReferrerType')}>
                    <Input placeholder={rt('optionalPlaceholder')} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="referrer_id" label={rt('formReferrerId')}>
                <Input placeholder={rt('optionalPlaceholder')} />
              </Form.Item>

              <Button type="primary" htmlType="submit">
                {rt('testButton')}
              </Button>
            </Form>
          </Card>

          <Card title={rt('resultTitle')}>
            {matchResult ? (
              <Space direction="vertical" size={12}>
                <div>
                  <Text strong>{rt('matchedRule')}：</Text> <Tag color="blue">{matchResult.matched_rule_id}</Tag>
                </div>
                <div>
                  <Text strong>{rt('routeResult')}：</Text> <Tag color="purple">{matchResult.route_result}</Tag>
                </div>
                <div>
                  <Text strong>{rt('routeSource')}：</Text> <Tag>{matchResult.route_source}</Tag>
                </div>
              </Space>
            ) : (
              <Text type="secondary">{rt('emptyResult')}</Text>
            )}
          </Card>
        </Space>
      ),
    },
    {
      key: 'logs',
      label: rt('tabsLogs'),
      children: (
        <Card title={rt('logsTitle')} loading={loading}>
          <Table
            rowKey="route_log_id"
            pagination={false}
            dataSource={logs}
            columns={[
              { title: rt('logId'), dataIndex: 'route_log_id' },
              { title: rt('entryType'), dataIndex: 'entry_type' },
              { title: rt('entryCode'), dataIndex: 'entry_code' },
              { title: rt('matchedRule'), dataIndex: 'matched_rule_id' },
              { title: rt('routeResult'), dataIndex: 'route_result', render: (v) => <Tag color="blue">{v}</Tag> },
              { title: rt('userStatus'), dataIndex: 'user_status' },
              { title: rt('time'), dataIndex: 'created_at' },
            ]}
          />
        </Card>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 8 }}>
          {rt('title')}
        </Title>
        <Text type="secondary">{rt('subtitle')}</Text>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Tabs defaultActiveKey="rules" items={tabItems} />
    </Space>
  )
}
