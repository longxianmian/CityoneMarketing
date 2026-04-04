import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Tag, Row, Col, Modal, Form, message, InputNumber, Select, Switch, Drawer } from 'antd'
import { SearchOutlined, ReloadOutlined, PlusOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'

const ruleTypeMap: Record<string, { label: string; color: string }> = {
  frequency: { label: '频率限制', color: 'blue' },
  limit: { label: '数量限制', color: 'orange' },
  blacklist: { label: '黑名单', color: 'red' },
}

const targetOptions = {
  frequency: [
    { value: 'user', label: '用户' },
    { value: 'device', label: '设备' },
    { value: 'ip', label: 'IP' },
  ],
  limit: [
    { value: 'user', label: '用户' },
    { value: 'device', label: '设备' },
  ],
}

const blacklistTypeOptions = [
  { value: 'user_id', label: '用户ID' },
  { value: 'mobile', label: '手机号' },
  { value: 'device', label: '设备' },
]

function ConfigSummary({ config, ruleType }: { config: any; ruleType: string }) {
  if (!config) return <span>--</span>
  if (ruleType === 'frequency') {
    return <span>最多{config.max_count}次/{config.period_minutes}分钟 ({config.target || '--'})</span>
  }
  if (ruleType === 'limit') {
    return <span>日限{config.daily_limit} / 月限{config.monthly_limit} ({config.target || '--'})</span>
  }
  if (ruleType === 'blacklist') {
    const count = config.values ? (Array.isArray(config.values) ? config.values.length : config.values.split('\n').filter(Boolean).length) : 0
    return <span>{config.blacklist_type || '--'} ({count}条)</span>
  }
  return <span>{JSON.stringify(config)}</span>
}

export default function RiskRuleManage() {
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

  const handleSearch = () => { fetchData() }

  const handleAdd = () => {
    setIsEdit(false)
    form.resetFields()
    setRuleType('frequency')
    setDrawerVisible(true)
  }

  const handleEdit = (record: any) => {
    setIsEdit(true)
    const config = record.config || {}
    const values: any = {
      id: record.id,
      rule_key: record.rule_key,
      rule_name: record.rule_name,
      rule_type: record.rule_type,
      description: record.description,
      enabled: record.enabled,
    }
    if (record.rule_type === 'frequency') {
      values.max_count = config.max_count
      values.period_minutes = config.period_minutes
      values.frequency_target = config.target
    } else if (record.rule_type === 'limit') {
      values.daily_limit = config.daily_limit
      values.monthly_limit = config.monthly_limit
      values.limit_target = config.target
    } else if (record.rule_type === 'blacklist') {
      values.blacklist_type = config.blacklist_type
      values.blacklist_values = Array.isArray(config.values) ? config.values.join('\n') : (config.values || '')
    }
    setRuleType(record.rule_type)
    form.setFieldsValue(values)
    setDrawerVisible(true)
  }

  const handleFormOk = async () => {
    const values = await form.validateFields()
    let config: any = {}
    if (values.rule_type === 'frequency') {
      config = { max_count: values.max_count, period_minutes: values.period_minutes, target: values.frequency_target }
    } else if (values.rule_type === 'limit') {
      config = { daily_limit: values.daily_limit, monthly_limit: values.monthly_limit, target: values.limit_target }
    } else if (values.rule_type === 'blacklist') {
      config = { blacklist_type: values.blacklist_type, values: (values.blacklist_values || '').split('\n').filter(Boolean) }
    }
    const payload = {
      id: values.id,
      rule_key: values.rule_key,
      rule_name: values.rule_name,
      rule_type: values.rule_type,
      description: values.description,
      enabled: values.enabled ?? true,
      config,
    }
    try {
      await request.post('/growth/risk/save', payload)
      message.success(isEdit ? '修改成功' : '创建成功')
      setDrawerVisible(false)
      fetchData()
    } catch (e) {}
  }

  const handleToggle = async (record: any) => {
    try {
      await request.post('/growth/risk/toggle', { id: record.id, enabled: !record.enabled })
      message.success('操作成功')
      fetchData()
    } catch (e) {}
  }

  const handleDelete = (record: any) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除规则「${record.rule_name}」吗？`,
      onOk: async () => {
        await request.post('/growth/risk/delete', { id: record.id })
        message.success('删除成功')
        fetchData()
      },
    })
  }

  const filteredData = keyword
    ? data.filter((item: any) => (item.rule_name || '').includes(keyword) || (item.rule_key || '').includes(keyword))
    : data

  const columns = [
    { title: '规则名称', dataIndex: 'rule_name', key: 'rule_name', width: 160, ellipsis: true },
    {
      title: '规则类型', dataIndex: 'rule_type', key: 'rule_type', width: 120,
      render: (v: string) => { const t = ruleTypeMap[v]; return t ? <Tag color={t.color}>{t.label}</Tag> : <Tag>{v}</Tag> },
    },
    {
      title: '配置摘要', key: 'config_summary', width: 240,
      render: (_: any, record: any) => <ConfigSummary config={record.config} ruleType={record.rule_type} />,
    },
    {
      title: '启用', dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean, record: any) => <Switch checked={v} size="small" onChange={() => handleToggle(record)} />,
    },
    { title: '描述', dataIndex: 'description', key: 'description', width: 200, ellipsis: true },
    {
      title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 170, responsive: ['md' as const],
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--',
    },
    {
      title: '操作', key: 'action', width: 150, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card styles={{ body: { paddingBottom: 0 } }}>
        <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8} md={6}>
            <Input placeholder="搜索规则名称/Key" prefix={<SearchOutlined />} value={keyword} onChange={e => setKeyword(e.target.value)} onPressEnter={handleSearch} allowClear />
          </Col>
          <Col xs={24} sm={16} md={18}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); fetchData() }}>重置</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加规则</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Table rowKey="id" columns={columns} dataSource={filteredData} loading={loading} scroll={{ x: 1000 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>
      <Drawer title={isEdit ? '编辑规则' : '添加规则'} open={drawerVisible} onClose={() => setDrawerVisible(false)} width={520}
        extra={<Space><Button onClick={() => setDrawerVisible(false)}>取消</Button><Button type="primary" onClick={handleFormOk}>保存</Button></Space>}
      >
        <Form form={form} layout="vertical" initialValues={{ enabled: true, rule_type: 'frequency' }}>
          {isEdit && <Form.Item name="id" hidden><Input /></Form.Item>}
          <Form.Item name="rule_key" label="规则Key" rules={[{ required: true, message: '请输入规则Key' }]}>
            <Input placeholder="如: daily_borrow_limit" disabled={isEdit} />
          </Form.Item>
          <Form.Item name="rule_name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="rule_type" label="规则类型" rules={[{ required: true }]}>
            <Select options={Object.entries(ruleTypeMap).map(([k, v]) => ({ value: k, label: v.label }))}
              onChange={(v: string) => setRuleType(v)} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>

          {ruleType === 'frequency' && (
            <>
              <Form.Item name="max_count" label="最大次数" rules={[{ required: true, message: '请输入最大次数' }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="period_minutes" label="周期(分钟)" rules={[{ required: true, message: '请输入周期' }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="frequency_target" label="限制对象" rules={[{ required: true, message: '请选择限制对象' }]}>
                <Select options={targetOptions.frequency} />
              </Form.Item>
            </>
          )}

          {ruleType === 'limit' && (
            <>
              <Form.Item name="daily_limit" label="每日限制" rules={[{ required: true, message: '请输入每日限制' }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="monthly_limit" label="每月限制" rules={[{ required: true, message: '请输入每月限制' }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="limit_target" label="限制对象" rules={[{ required: true, message: '请选择限制对象' }]}>
                <Select options={targetOptions.limit} />
              </Form.Item>
            </>
          )}

          {ruleType === 'blacklist' && (
            <>
              <Form.Item name="blacklist_type" label="黑名单类型" rules={[{ required: true, message: '请选择黑名单类型' }]}>
                <Select options={blacklistTypeOptions} />
              </Form.Item>
              <Form.Item name="blacklist_values" label="黑名单值(每行一个)">
                <Input.TextArea rows={6} placeholder="每行输入一个值" />
              </Form.Item>
            </>
          )}
        </Form>
      </Drawer>
    </div>
  )
}
