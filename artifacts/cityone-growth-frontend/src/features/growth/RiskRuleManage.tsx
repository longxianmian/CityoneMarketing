import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Tag, Row, Col, Form, message, InputNumber, Select, Switch, Drawer } from 'antd'
import { SearchOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'

function ConfigSummary({ config, ruleType, labels }: { config: any; ruleType: string; labels: any }) {
  if (!config) return <span>--</span>
  if (ruleType === 'frequency') {
    return <span>{labels.maxCount}{config.max_count}{labels.times}/{config.period_minutes}{labels.min} ({config.target || '--'})</span>
  }
  if (ruleType === 'limit') {
    return <span>{labels.dailyLimit}{config.daily_limit} / {labels.monthlyLimit}{config.monthly_limit} ({config.target || '--'})</span>
  }
  if (ruleType === 'blacklist') {
    const count = config.values ? (Array.isArray(config.values) ? config.values.length : config.values.split('\n').filter(Boolean).length) : 0
    return <span>{config.blacklist_type || '--'} ({count}{labels.items})</span>
  }
  return <span>{JSON.stringify(config)}</span>
}

export default function RiskRuleManage() {
  const { t } = useI18n()
  const rr = (key: string) => t(`riskRule.${key}`)

  const ruleTypeMap: Record<string, { label: string; color: string }> = {
    frequency: { label: rr('typeFrequency'), color: 'blue' },
    limit: { label: rr('typeLimit'), color: 'orange' },
    blacklist: { label: rr('typeBlacklist'), color: 'red' },
  }

  const targetOptions = {
    frequency: [
      { value: 'user', label: rr('targetUser') },
      { value: 'device', label: rr('targetDevice') },
      { value: 'ip', label: rr('targetIp') },
    ],
    limit: [
      { value: 'user', label: rr('targetUser') },
      { value: 'device', label: rr('targetDevice') },
    ],
  }

  const blacklistTypeOptions = [
    { value: 'user_id', label: rr('blacklistUserId') },
    { value: 'mobile', label: rr('blacklistMobile') },
    { value: 'device', label: rr('blacklistDevice') },
  ]

  const configLabels = {
    maxCount: rr('labelMax'), times: rr('labelTimes'),
    min: rr('labelMin'), dailyLimit: rr('labelDaily'),
    monthlyLimit: rr('labelMonthly'), items: rr('labelItems'),
  }

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [form] = Form.useForm()
  const [ruleType, setRuleType] = useState<string>('frequency')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await request.get('/admin/risk/rules')
      setData(res.data || [])
    } catch (e) {}
    setLoading(false)
  }, [])

  React.useEffect(() => { fetchData() }, [])

  const handleAdd = () => {
    setIsEdit(false); form.resetFields(); setRuleType('frequency'); setDrawerVisible(true)
  }

  const handleEdit = (record: any) => {
    setIsEdit(true)
    const config = record.config || {}
    const values: any = {
      id: record.id, rule_key: record.rule_key, rule_name: record.rule_name,
      rule_type: record.rule_type, description: record.description, enabled: record.enabled,
    }
    if (record.rule_type === 'frequency') {
      values.max_count = config.max_count; values.period_minutes = config.period_minutes; values.frequency_target = config.target
    } else if (record.rule_type === 'limit') {
      values.daily_limit = config.daily_limit; values.monthly_limit = config.monthly_limit; values.limit_target = config.target
    } else if (record.rule_type === 'blacklist') {
      values.blacklist_type = config.blacklist_type
      values.blacklist_values = Array.isArray(config.values) ? config.values.join('\n') : (config.values || '')
    }
    setRuleType(record.rule_type); form.setFieldsValue(values); setDrawerVisible(true)
  }

  const handleFormOk = async () => {
    try {
      const values = await form.validateFields()
      let config: any = {}
      if (values.rule_type === 'frequency') {
        config = { max_count: values.max_count, period_minutes: values.period_minutes, target: values.frequency_target }
      } else if (values.rule_type === 'limit') {
        config = { daily_limit: values.daily_limit, monthly_limit: values.monthly_limit, target: values.limit_target }
      } else if (values.rule_type === 'blacklist') {
        config = {
          blacklist_type: values.blacklist_type,
          values: (values.blacklist_values || '').split('\n').filter(Boolean),
        }
      }
      const payload = { rule_key: values.rule_key, rule_name: values.rule_name, rule_type: values.rule_type, description: values.description, enabled: values.enabled, config }
      if (isEdit) {
        await request.put(`/admin/risk/rules/${values.id}`, payload)
      } else {
        await request.post('/admin/risk/rules', payload)
      }
      message.success(isEdit ? rr('updateSuccess') : rr('addSuccess'))
      setDrawerVisible(false); fetchData()
    } catch {}
  }

  const handleDelete = async (record: any) => {
    try {
      await request.delete(`/admin/risk/rules/${record.id}`)
      message.success(rr('deleteSuccess')); fetchData()
    } catch { message.error(rr('deleteFail')) }
  }

  const filteredData = data.filter(item =>
    !keyword || (item.rule_name || '').includes(keyword) || (item.rule_key || '').includes(keyword)
  )

  const columns = [
    { title: rr('colKey'), dataIndex: 'rule_key', key: 'rule_key', width: 160 },
    { title: rr('colName'), dataIndex: 'rule_name', key: 'rule_name', width: 160 },
    {
      title: rr('colType'), dataIndex: 'rule_type', key: 'rule_type', width: 120,
      render: (v: string) => {
        const r = ruleTypeMap[v]; return r ? <Tag color={r.color}>{r.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: rr('colConfig'), key: 'config', width: 240,
      render: (_: any, r: any) => <ConfigSummary config={r.config} ruleType={r.rule_type} labels={configLabels} />,
    },
    { title: rr('colDesc'), dataIndex: 'description', key: 'description' },
    {
      title: rr('colEnabled'), dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? rr('statusOn') : rr('statusOff')}</Tag>,
    },
    {
      title: rr('colUpdated'), dataIndex: 'updated_at', key: 'updated_at', width: 180,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--',
    },
    {
      title: rr('colAction'), key: 'action', width: 140,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" onClick={() => handleEdit(r)}>{rr('btnEdit')}</Button>
          <Button size="small" danger onClick={() => handleDelete(r)}>{rr('btnDelete')}</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="middle">
        <Col xs={24} sm={10} md={8}>
          <Input placeholder={rr('searchPlaceholder')} prefix={<SearchOutlined />} value={keyword}
            onChange={e => setKeyword(e.target.value)} allowClear />
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>{rr('btnRefresh')}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{rr('btnAdd')}</Button>
          </Space>
        </Col>
      </Row>

      <Table
        columns={columns} dataSource={filteredData} rowKey="id" loading={loading} size="small"
        pagination={{ pageSize: 20 }}
      />

      <Drawer
        title={isEdit ? rr('drawerEdit') : rr('drawerAdd')}
        open={drawerVisible} onClose={() => setDrawerVisible(false)} width={520}
        footer={
          <Space style={{ justifyContent: 'flex-end', display: 'flex' }}>
            <Button onClick={() => setDrawerVisible(false)}>{rr('btnCancel')}</Button>
            <Button type="primary" onClick={handleFormOk}>{rr('btnSave')}</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="rule_key" label={rr('formKey')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="rule_name" label={rr('formName')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="rule_type" label={rr('formType')} rules={[{ required: true }]}>
            <Select
              options={Object.entries(ruleTypeMap).map(([k, v]) => ({ value: k, label: v.label }))}
              onChange={v => { setRuleType(v); form.setFieldsValue({ frequency_target: undefined, limit_target: undefined }) }}
            />
          </Form.Item>
          <Form.Item name="description" label={rr('formDesc')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="enabled" label={rr('formEnabled')} valuePropName="checked">
            <Switch />
          </Form.Item>

          {ruleType === 'frequency' && (
            <>
              <Form.Item name="max_count" label={rr('formMaxCount')} rules={[{ required: true, message: rr('formMaxCountRequired') }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="period_minutes" label={rr('formPeriod')} rules={[{ required: true, message: rr('formPeriodRequired') }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="frequency_target" label={rr('formTarget')} rules={[{ required: true, message: rr('formTargetRequired') }]}>
                <Select options={targetOptions.frequency} />
              </Form.Item>
            </>
          )}

          {ruleType === 'limit' && (
            <>
              <Form.Item name="daily_limit" label={rr('formDailyLimit')} rules={[{ required: true, message: rr('formDailyLimitRequired') }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="monthly_limit" label={rr('formMonthlyLimit')} rules={[{ required: true, message: rr('formMonthlyLimitRequired') }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="limit_target" label={rr('formTarget')} rules={[{ required: true, message: rr('formTargetRequired') }]}>
                <Select options={targetOptions.limit} />
              </Form.Item>
            </>
          )}

          {ruleType === 'blacklist' && (
            <>
              <Form.Item name="blacklist_type" label={rr('formBlacklistType')} rules={[{ required: true, message: rr('formBlacklistTypeRequired') }]}>
                <Select options={blacklistTypeOptions} />
              </Form.Item>
              <Form.Item name="blacklist_values" label={rr('formBlacklistValues')}>
                <Input.TextArea rows={6} placeholder={rr('formBlacklistPlaceholder')} />
              </Form.Item>
            </>
          )}
        </Form>
      </Drawer>
    </div>
  )
}
