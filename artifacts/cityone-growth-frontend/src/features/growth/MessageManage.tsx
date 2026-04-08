import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Tag, Row, Col, Modal, Form, message, InputNumber, Select, Switch } from 'antd'
import { SearchOutlined, ReloadOutlined, PlusOutlined, ExclamationCircleOutlined, SendOutlined } from '@ant-design/icons'
import request from '../../api/request'
import { useI18n } from '../../i18n'

const channelMap: Record<string, { label: string; color: string }> = {
  line: { label: 'LINE', color: 'green' },
  sms: { label: 'SMS', color: 'blue' },
  in_app: { label: 'In-App', color: 'orange' },
}

const channelOptions = [
  { value: 'line', label: 'LINE' },
  { value: 'sms', label: 'SMS' },
  { value: 'in_app', label: 'In-App' },
]

const LANG_OPTIONS = [{ value: 'zh', label: '中文' }, { value: 'th', label: 'ภาษาไทย' }, { value: 'en', label: 'English' }]

function pickText(v: any, lang = 'zh'): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  return v[lang] || v.zh || v.th || v.en || ''
}

export default function MessageManage() {
  const { t, language } = useI18n()
  const mk = (key: string) => t(`admin.message.${key}`)

  const eventTypeOptions = [
    { value: 'overdue_A', label: mk('eventOverdueA') },
    { value: 'overdue_B', label: mk('eventOverdueB') },
    { value: 'overdue_C', label: mk('eventOverdueC') },
    { value: 'overdue_D', label: mk('eventOverdueD') },
    { value: 'welcome', label: mk('eventWelcome') },
    { value: 'deposit_remind', label: mk('eventDepositRemind') },
    { value: 'return_remind', label: mk('eventReturnRemind') },
  ]

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

  const handleAdd = () => {
    setIsEdit(false)
    form.resetFields()
    form.setFieldsValue({
      enabled: true,
      _sourceLang: language || 'zh',
      content: '',
    })
    setFormVisible(true)
  }

  const handleEdit = (record: any) => {
    setIsEdit(true)
    const sl = (language === 'zh' || language === 'th' || language === 'en') ? language : 'zh'
    form.setFieldsValue({
      ...record,
      _sourceLang: sl,
      content: pickText(record.content, sl) || record.content_zh || '',
    })
    setFormVisible(true)
  }

  const handleFormOk = async () => {
    const values = await form.validateFields()
    try {
      const sourceLang = values._sourceLang || 'zh'
      const raw: string = values.content || ''
      let content: any = { zh: '', th: '', en: '', [sourceLang]: raw }

      if (raw.trim() && ['zh', 'th', 'en'].some(l => l !== sourceLang && !content[l])) {
        try {
          const res: any = await request.post('/translate', { texts: { content: raw }, sourceLang }, { timeout: 8000, silentError: true } as any)
          const result = res.data?.result ?? {}
          if (result.content) content = { ...content, ...result.content }
        } catch {
          // 翻译失败静默降级
        }
      }

      const payload = {
        ...values,
        content,
        content_zh: content.zh || '',
        content_th: content.th || '',
        content_en: content.en || '',
      }
      delete payload._sourceLang
      await request.post('/growth/message/save', payload)
      message.success(isEdit ? mk('saveSuccess') : mk('createSuccess'))
      setFormVisible(false)
      fetchData()
    } catch (e) {}
  }

  const handleDelete = (record: any) => {
    Modal.confirm({
      title: mk('confirmDelete'),
      icon: <ExclamationCircleOutlined />,
      content: mk('confirmDeleteMsg').replace('{name}', record.name),
      onOk: async () => {
        await request.post('/growth/message/delete', { id: record.id })
        message.success(mk('deleteSuccess'))
        fetchData()
      },
    })
  }

  const handleTestSend = async (record: any) => {
    try {
      await request.post('/growth/message/test', { id: record.id })
      message.success(mk('testSuccess'))
    } catch (e) {}
  }

  const handleToggleEnabled = async (record: any, checked: boolean) => {
    try {
      await request.post('/growth/message/save', { id: record.id, enabled: checked })
      message.success(checked ? mk('enabledOn') : mk('enabledOff'))
      fetchData()
    } catch (e) {}
  }

  const columns = [
    { title: mk('colName'), dataIndex: 'name', key: 'name', width: 160, ellipsis: true },
    {
      title: mk('colChannel'), dataIndex: 'channel', key: 'channel', width: 100,
      render: (v: string) => {
        const ch = channelMap[v]
        return ch ? <Tag color={ch.color}>{ch.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: mk('colEvent'), dataIndex: 'event_type', key: 'event_type', width: 120,
      render: (v: string) => {
        const found = eventTypeOptions.find(o => o.value === v)
        return found ? found.label : v
      },
    },
    {
      title: mk('colContent'), key: 'content', width: 220, ellipsis: true,
      render: (_: any, record: any) => {
        const content = record.content
        if (content && typeof content === 'object') {
          return content[language] || content.zh || content.th || content.en || ''
        }
        return record.content_zh || ''
      },
    },
    {
      title: mk('colEnabled'), dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean, record: any) => <Switch checked={v} onChange={(checked) => handleToggleEnabled(record, checked)} />,
    },
    { title: mk('colCooldown'), dataIndex: 'cooldown_minutes', key: 'cooldown_minutes', width: 100 },
    {
      title: mk('colAction'), key: 'action', width: 180, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>{mk('actionEdit')}</Button>
          <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleTestSend(record)}>{mk('actionTest')}</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record)}>{mk('actionDelete')}</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card styles={{ body: { paddingBottom: 0 } }}>
        <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8} md={6}>
            <Select placeholder={mk('channelFilter')} value={filterChannel} onChange={v => setFilterChannel(v)} allowClear style={{ width: '100%' }} options={channelOptions} />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Select placeholder={mk('eventFilter')} value={filterEvent} onChange={v => setFilterEvent(v)} allowClear style={{ width: '100%' }} options={eventTypeOptions} />
          </Col>
          <Col xs={24} sm={8} md={12}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>{mk('btnSearch')}</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { handleReset(); setTimeout(fetchData, 0) }}>{mk('btnReset')}</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{mk('btnCreate')}</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 900 }} pagination={false} />
      </Card>
      <Modal
        title={isEdit ? mk('modalEdit') : mk('modalCreate')}
        open={formVisible}
        onOk={handleFormOk}
        onCancel={() => setFormVisible(false)}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {isEdit && <Form.Item name="id" hidden><Input /></Form.Item>}
          <Form.Item name="name" label={mk('formName')} rules={[{ required: true, message: mk('formNameRequired') }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="channel" label={mk('formChannel')} rules={[{ required: true, message: mk('formChannelRequired') }]}>
                <Select options={channelOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="event_type" label={mk('formEvent')} rules={[{ required: true, message: mk('formEventRequired') }]}>
                <Select options={eventTypeOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="_sourceLang" label="输入语言 / Input Language" initialValue="zh">
            <Select options={LANG_OPTIONS} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item
            name="content"
            label={mk('formContent')}
            rules={[{
              validator: (_, val) => {
                if (!val?.trim()) return Promise.reject(mk('formContentRequired'))
                return Promise.resolve()
              },
            }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="请输入消息内容，保存时自动翻译补齐其他语言"
            />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="cooldown_minutes" label={mk('formCooldown')}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="enabled" label={mk('formEnabled')} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
