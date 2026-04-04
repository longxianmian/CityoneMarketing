import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Tag, Row, Col, Modal, Form, message, InputNumber, Select, DatePicker, Statistic } from 'antd'
import { SearchOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons'
import { adjustPoints } from '../../api/growth'
import request from '../../api/request'
import dayjs from 'dayjs'

const refTypeMap: Record<string, string> = {
  activity: '活动',
  invite: '邀请',
  sign_in: '签到',
  exchange: '兑换',
  admin_adjust: '管理员调整',
  order: '订单',
  share: '分享',
}

export default function PointsLedger() {
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
      setSummary({
        total_earned: payload.total_earned || 0,
        total_spent: payload.total_spent || 0,
        total_records: payload.total || 0,
      })
    } catch (e) {}
    setLoading(false)
  }, [page, pageSize, userId, typeFilter, refTypeFilter, dateRange])

  React.useEffect(() => { fetchData() }, [])

  const handleSearch = () => { setPage(1); fetchData(1, pageSize) }

  const handleAdjust = () => { adjustForm.resetFields(); setAdjustVisible(true) }

  const handleAdjustOk = async () => {
    const values = await adjustForm.validateFields()
    try {
      await adjustPoints({
        user_id: values.user_id,
        type: values.type,
        points: Number(values.points),
        reason: values.reason,
        operator_id: 'admin',
      })
      message.success('调整成功')
      setAdjustVisible(false)
      fetchData()
    } catch (e) {
      message.error('调整失败，请重试')
    }
  }

  const columns = [
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 140, ellipsis: true },
    { title: '用户手机', dataIndex: 'mobile', key: 'mobile', width: 140, responsive: ['md' as const] },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 90,
      render: (v: string) => v === 'credit' || v === 'earn'
        ? <Tag color="green">获得</Tag>
        : <Tag color="red">消费</Tag>,
    },
    { title: '积分', dataIndex: 'points', key: 'points', width: 100 },
    {
      title: '来源', dataIndex: 'ref_type', key: 'ref_type', width: 120,
      render: (v: string) => <Tag>{refTypeMap[v] || v || '--'}</Tag>,
    },
    { title: '原因', dataIndex: 'reason', key: 'reason', width: 160, ellipsis: true, responsive: ['md' as const] },
    { title: '操作员', dataIndex: 'operator_id', key: 'operator_id', width: 100, responsive: ['lg' as const] },
    {
      title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180, responsive: ['lg' as const],
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--',
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card><Statistic title="总发放" value={summary.total_earned || 0} suffix="分" valueStyle={{ color: '#3f8600' }} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="总消费" value={summary.total_spent || 0} suffix="分" valueStyle={{ color: '#cf1322' }} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="总记录" value={summary.total_records || 0} suffix="条" /></Card>
        </Col>
      </Row>

      <Card styles={{ body: { paddingBottom: 0 } }}>
        <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={4}>
            <Input placeholder="用户ID" value={userId} onChange={e => setUserId(e.target.value)} onPressEnter={handleSearch} allowClear />
          </Col>
          <Col xs={24} sm={12} md={3}>
            <Select placeholder="类型" value={typeFilter} onChange={v => setTypeFilter(v)} allowClear style={{ width: '100%' }}
              options={[{ value: 'credit', label: '获得' }, { value: 'debit', label: '消费' }]} />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select placeholder="来源" value={refTypeFilter} onChange={v => setRefTypeFilter(v)} allowClear style={{ width: '100%' }}
              options={Object.entries(refTypeMap).map(([k, v]) => ({ value: k, label: v }))} />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <DatePicker.RangePicker value={dateRange} onChange={v => setDateRange(v)} style={{ width: '100%' }} />
          </Col>
          <Col xs={24} sm={24} md={7}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
              <Button icon={<ReloadOutlined />} onClick={() => {
                setUserId(''); setTypeFilter(undefined); setRefTypeFilter(undefined); setDateRange(null)
                fetchData(1, pageSize)
              }}>重置</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdjust}>手动调整</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
          }}
        />
      </Card>

      <Modal title="手动调整积分" open={adjustVisible} onOk={handleAdjustOk} onCancel={() => setAdjustVisible(false)} width={480} destroyOnClose>
        <Form form={adjustForm} layout="vertical">
          <Form.Item name="user_id" label="用户ID" rules={[{ required: true, message: '请输入用户ID' }]}>
            <Input placeholder="请输入用户ID" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
                <Select options={[{ value: 'credit', label: '增加积分' }, { value: 'debit', label: '扣减积分' }]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="points" label="积分数" rules={[{ required: true, message: '请输入积分数' }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="原因" rules={[{ required: true, message: '请输入调整原因' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ color: '#999', fontSize: 12 }}>操作员将记录为：admin</div>
        </Form>
      </Modal>
    </div>
  )
}
