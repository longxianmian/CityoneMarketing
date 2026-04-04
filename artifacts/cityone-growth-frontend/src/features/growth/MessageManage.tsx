import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Tag, Row, Col, Modal, Form, message, InputNumber, Select, Switch } from 'antd'
import { SearchOutlined, ReloadOutlined, PlusOutlined, ExclamationCircleOutlined, SendOutlined } from '@ant-design/icons'
import request from '../../api/request'

const channelMap: Record<string, { label: string; color: string }> = {
  line: { label: 'LINE', color: 'green' },
  sms: { label: 'SMS', color: 'blue' },
  in_app: { label: 'In-App', color: 'orange' },
}

const eventTypeOptions = [
  { value: 'overdue_A', label: '超时提醒A' },
  { value: 'overdue_B', label: '超时提醒B' },
  { value: 'overdue_C', label: '超时提醒C' },
  { value: 'overdue_D', label: '超时提醒D' },
  { value: 'welcome', label: '欢迎消息' },
  { value: 'deposit_remind', label: '押金提醒' },
  { value: 'return_remind', label: '归还提醒' },
]

const channelOptions = [
  { value: 'line', label: 'LINE' },
  { value: 'sms', label: 'SMS' },
  { value: 'in_app', label: 'In-App' },
]

export default function MessageManage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filterChannel, setFilterChannel] = useState<string | undefined>(undefined)
  const [filterEvent, setFilterEvent] = useState<string | undefined>(undefined)
  const [formVisible, setFormVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [form] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await request.get('/growth/message/list', { params: { channel: filterChannel, event_type: filterEvent } })
      setData(res.data?.list || res.data || [])
    } catch (e) {}
    setLoading(false)
  }, [filterChannel, filterEvent])

  React.useEffect(() => { fetchData() }, [])

  const handleSearch = () => { fetchData() }
  const handleReset = () => { setFilterChannel(undefined); setFilterEvent(undefined) }
  const handleAdd = () => { setIsEdit(false); form.resetFields(); form.setFieldsValue({ enabled: true }); setFormVisible(true) }
  const handleEdit = (record: any) => {
    setIsEdit(true)
    form.setFieldsValue({ ...record })
    setFormVisible(true)
  }

  const handleFormOk = async () => {
    const values = await form.validateFields()
    try {
      if (isEdit) {
        await request.post('/growth/message/save', values)
        message.success('修改成功')
      } else {
        await request.post('/growth/message/save', values)
        message.success('创建成功')
      }
      setFormVisible(false)
      fetchData()
    } catch (e) {}
  }

  const handleDelete = (record: any) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除模板「${record.name}」吗？`,
      onOk: async () => {
        await request.post('/growth/message/delete', { id: record.id })
        message.success('删除成功')
        fetchData()
      },
    })
  }

  const handleTestSend = async (record: any) => {
    try {
      await request.post('/growth/message/test', { id: record.id })
      message.success('测试发送成功（仅记录日志）')
    } catch (e) {}
  }

  const handleToggleEnabled = async (record: any, checked: boolean) => {
    try {
      await request.post('/growth/message/save', { id: record.id, enabled: checked })
      message.success(checked ? '已启用' : '已停用')
      fetchData()
    } catch (e) {}
  }

  const columns = [
    { title: '模板名称', dataIndex: 'name', key: 'name', width: 160, ellipsis: true },
    {
      title: '渠道', dataIndex: 'channel', key: 'channel', width: 100,
      render: (v: string) => {
        const ch = channelMap[v]
        return ch ? <Tag color={ch.color}>{ch.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: '事件类型', dataIndex: 'event_type', key: 'event_type', width: 120,
      render: (v: string) => {
        const found = eventTypeOptions.find(o => o.value === v)
        return found ? found.label : v
      },
    },
    { title: '内容预览(中文)', dataIndex: 'content_zh', key: 'content_zh', width: 200, ellipsis: true },
    {
      title: '启用', dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean, record: any) => <Switch checked={v} onChange={(checked) => handleToggleEnabled(record, checked)} />,
    },
    { title: '冷却(分钟)', dataIndex: 'cooldown_minutes', key: 'cooldown_minutes', width: 100 },
    {
      title: '操作', key: 'action', width: 180, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleTestSend(record)}>测试</Button>
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
            <Select placeholder="渠道筛选" value={filterChannel} onChange={v => setFilterChannel(v)} allowClear style={{ width: '100%' }} options={channelOptions} />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Select placeholder="事件类型" value={filterEvent} onChange={v => setFilterEvent(v)} allowClear style={{ width: '100%' }} options={eventTypeOptions} />
          </Col>
          <Col xs={24} sm={8} md={12}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { handleReset(); setTimeout(fetchData, 0) }}>重置</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>创建模板</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 900 }} pagination={false} />
      </Card>
      <Modal title={isEdit ? '编辑消息模板' : '创建消息模板'} open={formVisible} onOk={handleFormOk} onCancel={() => setFormVisible(false)} width={640} destroyOnClose>
        <Form form={form} layout="vertical">
          {isEdit && <Form.Item name="id" hidden><Input /></Form.Item>}
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="channel" label="渠道" rules={[{ required: true, message: '请选择渠道' }]}>
                <Select options={channelOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="event_type" label="事件类型" rules={[{ required: true, message: '请选择事件类型' }]}>
                <Select options={eventTypeOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="content_zh" label="中文内容" rules={[{ required: true, message: '请输入中文内容' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="content_en" label="英文内容">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="content_th" label="泰文内容">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="cooldown_minutes" label="冷却时间(分钟)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="enabled" label="启用" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
