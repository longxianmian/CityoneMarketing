import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Tag, Row, Col, Modal, Form, message, InputNumber, Select, DatePicker, Statistic } from 'antd'
import { SearchOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons'
import { adjustPoints } from '../../api/growth'
import request from '../../api/request'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'

export default function PointsLedger() {
  const { t } = useI18n()
  const pl = (key: string) => t(`admin.pointsLedger.${key}`)

  const refTypeMap: Record<string, string> = {
    activity: pl('refActivity'),
    invite: pl('refInvite'),
    sign_in: pl('refSignIn'),
    exchange: pl('refExchange'),
    admin_adjust: pl('refAdminAdjust'),
    order: pl('refOrder'),
    share: pl('refShare'),
  }

  const typeOptions = [
    { value: 'credit', label: pl('typeEarn') },
    { value: 'debit', label: pl('typeSpend') },
  ]

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [userId, setUserId] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [refTypeFilter, setRefTypeFilter] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<any>(null)
  const [summary, setSummary] = useState<any>({})
  const [adjustVisible, setAdjustVisible] = useState(false)
  const [adjustForm] = Form.useForm()

  const fetchData = useCallback(async (p = page, ps = pageSize) => {
    setLoading(true)
    try {
      const params: any = { page: p, page_size: ps }
      if (userId) params.user_id = userId
      if (typeFilter) params.type = typeFilter
      if (refTypeFilter) params.ref_type = refTypeFilter
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].toISOString()
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].toISOString()
      const res: any = await request.get('/growth/points/ledger', { params })
      const payload = res.data || {}
      setData(payload.items || [])
      setTotal(payload.total || 0)
      setSummary({ total_earned: payload.total_earned || 0, total_spent: payload.total_spent || 0, total_records: payload.total || 0 })
    } catch (e) {}
    setLoading(false)
  }, [page, pageSize, userId, typeFilter, refTypeFilter, dateRange])

  React.useEffect(() => { fetchData() }, [])

  const handleSearch = () => { setPage(1); fetchData(1, pageSize) }

  const handleAdjustOk = async () => {
    const values = await adjustForm.validateFields()
    try {
      await adjustPoints({ user_id: values.user_id, type: values.type, points: Number(values.points), reason: values.reason, operator_id: 'admin' })
      message.success(pl('adjustSuccess'))
      setAdjustVisible(false)
      fetchData()
    } catch (e) { message.error(pl('adjustFail')) }
  }

  const columns = [
    { title: pl('colUserId'), dataIndex: 'user_id', key: 'user_id', width: 140, ellipsis: true },
    { title: pl('colMobile'), dataIndex: 'mobile', key: 'mobile', width: 140, responsive: ['md' as const] },
    {
      title: pl('colType'), dataIndex: 'type', key: 'type', width: 90,
      render: (v: string) => v === 'credit' || v === 'earn' ? <Tag color="green">{pl('typeEarn')}</Tag> : <Tag color="red">{pl('typeSpend')}</Tag>,
    },
    { title: pl('colPoints'), dataIndex: 'points', key: 'points', width: 100 },
    { title: pl('colRefType'), dataIndex: 'ref_type', key: 'ref_type', width: 120, render: (v: string) => <Tag>{refTypeMap[v] || v || '--'}</Tag> },
    { title: pl('colReason'), dataIndex: 'reason', key: 'reason', width: 160, ellipsis: true, responsive: ['md' as const] },
    { title: pl('colOperator'), dataIndex: 'operator_id', key: 'operator_id', width: 100, responsive: ['lg' as const] },
    { title: pl('colTime'), dataIndex: 'created_at', key: 'created_at', width: 180, responsive: ['lg' as const], render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--' },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card><Statistic title={pl('statEarned')} value={summary.total_earned || 0} suffix={pl('statPts')} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title={pl('statSpent')} value={summary.total_spent || 0} suffix={pl('statPts')} valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title={pl('statRecords')} value={summary.total_records || 0} suffix={pl('statItems')} /></Card></Col>
      </Row>
      <Card styles={{ body: { paddingBottom: 0 } }}>
        <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={4}><Input placeholder={pl('filterUserId')} value={userId} onChange={e => setUserId(e.target.value)} onPressEnter={handleSearch} allowClear /></Col>
          <Col xs={24} sm={12} md={3}>
            <Select placeholder={pl('filterType')} value={typeFilter} onChange={v => setTypeFilter(v)} allowClear style={{ width: '100%' }} options={typeOptions} />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select placeholder={pl('filterRefType')} value={refTypeFilter} onChange={v => setRefTypeFilter(v)} allowClear style={{ width: '100%' }}
              options={Object.entries(refTypeMap).map(([k, v]) => ({ value: k, label: v }))} />
          </Col>
          <Col xs={24} sm={12} md={6}><DatePicker.RangePicker value={dateRange} onChange={v => setDateRange(v)} style={{ width: '100%' }} /></Col>
          <Col xs={24} sm={24} md={7}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>{pl('btnSearch')}</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { setUserId(''); setTypeFilter(undefined); setRefTypeFilter(undefined); setDateRange(null); fetchData(1, pageSize) }}>{pl('btnReset')}</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { adjustForm.resetFields(); setAdjustVisible(true) }}>{pl('btnAdjust')}</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 900 }}
          pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (total) => pl('totalRows').replace('{n}', String(total)), onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) } }}
        />
      </Card>
      <Modal title={pl('adjustTitle')} open={adjustVisible} onOk={handleAdjustOk} onCancel={() => setAdjustVisible(false)} width={480} destroyOnClose>
        <Form form={adjustForm} layout="vertical">
          <Form.Item name="user_id" label={pl('formUserId')} rules={[{ required: true, message: pl('formUserIdRequired') }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="type" label={pl('formType')} rules={[{ required: true, message: pl('formTypeRequired') }]}>
                <Select options={[{ value: 'credit', label: pl('adjustAdd') }, { value: 'debit', label: pl('adjustDeduct') }]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="points" label={pl('formPoints')} rules={[{ required: true, message: pl('formPointsRequired') }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label={pl('formReason')} rules={[{ required: true, message: pl('formReasonRequired') }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ color: '#999', fontSize: 12 }}>{pl('operatorNote')}</div>
        </Form>
      </Modal>
    </div>
  )
}
