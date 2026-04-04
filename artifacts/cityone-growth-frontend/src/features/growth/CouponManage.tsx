import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Tag, Row, Col, Modal, Form, message, InputNumber, Select, DatePicker, Divider } from 'antd'
import { SearchOutlined, ReloadOutlined, PlusOutlined, ExclamationCircleOutlined, PictureOutlined, VideoCameraOutlined, ShareAltOutlined } from '@ant-design/icons'
import request from '../../api/request'
import MediaUploadField from '../../components/MediaUploadField'
import SharePromoModal from '../../components/SharePromoModal'
import dayjs from 'dayjs'

const couponTypeMap: Record<string, string> = {
  newbie: '新人礼包', channel: '渠道专属', general: '通用券', activity: '活动券',
}
const discountTypeMap: Record<string, string> = {
  fixed: '满减', percent: '折扣', free_time: '免费时长', free_order: '免单',
}
const discountTypeColors: Record<string, string> = {
  fixed: 'blue', percent: 'purple', free_time: 'green', free_order: 'orange',
}

function fmtDiscount(r: any) {
  const val = Number(r.discount_value)
  if (r.discount_type === 'percent') {
    const off = val <= 1 ? Math.round((1 - val) * 100) : Math.round(100 - val)
    return `-${off}% OFF`
  }
  if (r.discount_type === 'free_time') return `${val} min`
  if (r.discount_type === 'free_order') return '免单'
  return `฿${val}`
}

export default function CouponManage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [formVisible, setFormVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [form] = Form.useForm()
  const [coverImage, setCoverImage] = useState('')
  const [coverVideo, setCoverVideo] = useState('')
  const [shareRecord, setShareRecord] = useState<any | null>(null)

  const fetchData = useCallback(async (p = page, ps = pageSize) => {
    setLoading(true)
    try {
      const res: any = await request.get('/growth/coupon/list', { params: { pageNum: p, pageSize: ps, name: keyword || undefined } })
      setData(res.data?.rows || res.data?.list || [])
      setTotal(res.data?.total || 0)
    } catch (e) {}
    setLoading(false)
  }, [page, pageSize, keyword])

  React.useEffect(() => { fetchData() }, [])

  const handleSearch = () => { setPage(1); fetchData(1, pageSize) }
  const handleAdd = () => {
    setIsEdit(false)
    form.resetFields()
    setCoverImage('')
    setCoverVideo('')
    setFormVisible(true)
  }

  const handleEdit = (record: any) => {
    setIsEdit(true)
    form.setFieldsValue({
      id: record.id,
      name: record.name,
      couponType: record.coupon_type,
      discountType: record.discount_type,
      discountValue: Number(record.discount_value),
      minAmount: Number(record.min_amount) || 0,
      totalCount: record.total_count,
      status: record.status,
      validFrom: record.valid_from ? dayjs(record.valid_from) : undefined,
      validTo: record.valid_to ? dayjs(record.valid_to) : undefined,
    })
    setCoverImage(record.cover_image || '')
    setCoverVideo(record.cover_video || '')
    setFormVisible(true)
  }

  const handleFormOk = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        validFrom: values.validFrom?.toISOString(),
        validTo: values.validTo?.toISOString(),
        coverImage: coverImage || undefined,
        coverVideo: coverVideo || undefined,
      }
      if (isEdit) { await request.post('/growth/coupon/update', payload); message.success('修改成功') }
      else { await request.post('/growth/coupon/add', payload); message.success('创建成功') }
      setFormVisible(false)
      fetchData()
    } catch (e: any) {
      if (e?.response?.data?.msg) message.error(e.response.data.msg)
    }
  }

  const handleDelete = (record: any) => {
    Modal.confirm({
      title: '确认删除', icon: <ExclamationCircleOutlined />,
      content: `确定要删除券「${record.name}」吗？`,
      onOk: async () => {
        await request.post('/growth/coupon/delete', { id: record.id })
        message.success('删除成功')
        fetchData()
      },
    })
  }

  const columns = [
    {
      title: '封面', key: 'cover', width: 60,
      render: (_: any, r: any) => r.cover_image
        ? <img src={r.cover_image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
        : <span style={{ color: '#ddd', fontSize: 18 }}>—</span>,
    },
    { title: '券名称', dataIndex: 'name', key: 'name', width: 180, ellipsis: true },
    {
      title: '类型', dataIndex: 'coupon_type', key: 'coupon_type', width: 100,
      render: (v: string) => <Tag color="blue">{couponTypeMap[v] || v}</Tag>,
    },
    {
      title: '优惠方式', dataIndex: 'discount_type', key: 'discount_type', width: 110,
      render: (v: string) => <Tag color={discountTypeColors[v] || 'default'}>{discountTypeMap[v] || v}</Tag>,
    },
    {
      title: '面额/折扣', key: 'discount', width: 110,
      render: (_: any, r: any) => <span style={{ fontWeight: 600, color: '#1677ff' }}>{fmtDiscount(r)}</span>,
    },
    {
      title: '使用门槛', dataIndex: 'min_amount', key: 'min_amount', width: 110,
      render: (v: any) => Number(v) > 0 ? `满฿${Number(v)}` : '无门槛',
      responsive: ['md' as const],
    },
    {
      title: '已领/总量', key: 'stock', width: 100,
      render: (_: any, r: any) => `${r.claimed_count || 0}/${r.total_count || 0}`,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: number) => v === 1 ? <Tag color="green">生效中</Tag> : <Tag color="default">已停用</Tag>,
    },
    {
      title: '有效期', key: 'validity', width: 180, responsive: ['lg' as const],
      render: (_: any, r: any) => r.valid_from && r.valid_to
        ? `${dayjs(r.valid_from).format('MM/DD')} - ${dayjs(r.valid_to).format('MM/DD')}`
        : '--',
    },
    {
      title: '操作', key: 'action', width: 180, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" size="small" icon={<ShareAltOutlined />} onClick={() => setShareRecord(record)} style={{ color: '#06C755' }}>推广</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card styles={{ body: { paddingBottom: 0 } }}>
        <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="搜索券名称" prefix={<SearchOutlined />}
              value={keyword} onChange={e => setKeyword(e.target.value)}
              onPressEnter={handleSearch} allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={16}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); fetchData(1, pageSize) }}>重置</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>创建优惠券</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Table
          rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 960 }}
          pagination={{
            current: page, pageSize, total, showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
          }}
        />
      </Card>

      <SharePromoModal
        open={!!shareRecord}
        onClose={() => setShareRecord(null)}
        type="coupon"
        id={shareRecord?.id}
        name={shareRecord?.name || ''}
      />

      <Modal
        title={isEdit ? '编辑优惠券' : '创建优惠券'}
        open={formVisible} onOk={handleFormOk} onCancel={() => setFormVisible(false)}
        width={680} destroyOnClose
      >
        <Form form={form} layout="vertical">
          {isEdit && <Form.Item name="id" hidden><Input /></Form.Item>}
          <Form.Item name="name" label="券名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="couponType" label="券类型" rules={[{ required: true }]}>
                <Select options={Object.entries(couponTypeMap).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="discountType" label="优惠方式" rules={[{ required: true }]}>
                <Select options={Object.entries(discountTypeMap).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="discountValue" label="面额/折扣值" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="minAmount" label="使用门槛(THB)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="totalCount" label="发放总量" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="validFrom" label="生效时间">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="validTo" label="失效时间">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="状态">
            <Select options={[{ value: 1, label: '生效中' }, { value: 0, label: '已停用' }]} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0}>
            <span style={{ fontSize: 13, color: '#555' }}>营销素材（可选）</span>
          </Divider>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label={<span><PictureOutlined style={{ marginRight: 4 }} />封面图</span>} style={{ marginBottom: 8 }}>
                <MediaUploadField
                  type="image"
                  value={coverImage}
                  onChange={setCoverImage}
                  placeholder="上传券封面图"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label={<span><VideoCameraOutlined style={{ marginRight: 4 }} />宣传视频</span>} style={{ marginBottom: 8 }}>
                <MediaUploadField
                  type="video"
                  value={coverVideo}
                  onChange={setCoverVideo}
                  placeholder="上传宣传视频"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
