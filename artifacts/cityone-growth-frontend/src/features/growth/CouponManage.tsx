import React, { useState, useCallback } from 'react'
import { Card, Table, Input, Button, Space, Tag, Row, Col, Modal, Form, message, InputNumber, Select, DatePicker, Divider, Popconfirm } from 'antd'
import { SearchOutlined, ReloadOutlined, PlusOutlined, PictureOutlined, VideoCameraOutlined, ShareAltOutlined } from '@ant-design/icons'
import request from '../../api/request'
import StationScopeSelect, { type StationScope } from '../../components/StationScopeSelect'
import MediaUploadField from '../../components/MediaUploadField'
import SharePromoModal from '../../components/SharePromoModal'
import OssImage from '../../components/OssImage'
import { useI18n } from '../../i18n'
import { pickML, useMLPick } from '../../lib/ml'
import TranslateBatchButton, { asyncTranslateItem } from '../../components/TranslateBatchButton'
import dayjs from 'dayjs'

const LANG_OPTIONS = [{ value: 'zh', label: '中文' }, { value: 'th', label: 'ภาษาไทย' }, { value: 'en', label: 'English' }]

const discountTypeColors: Record<string, string> = {
  fixed: 'blue', percent: 'purple', free_time: 'green', free_order: 'orange',
}

export default function CouponManage() {
  const { t, language } = useI18n()
  const pick = useMLPick()

  const benefitActionOptions = [
    { value: 'benefit_detail', label: '权益说明页' },
    { value: 'charge_scan', label: '扫码充电' },
    { value: 'product_exchange', label: '商品兑换' },
    { value: 'physical_delivery', label: '查看领取信息' },
  ]
  const benefitActionMap = Object.fromEntries(benefitActionOptions.map(item => [item.value, item.label]))

  const couponTypeMap: Record<string, string> = {
    newbie: t('couponManage.couponTypeNewbie'),
    channel: t('couponManage.couponTypeChannel'),
    general: t('couponManage.couponTypeGeneral'),
    activity: t('couponManage.couponTypeActivity'),
  }
  const discountTypeMap: Record<string, string> = {
    fixed: t('couponManage.discountTypeFixed'),
    percent: t('couponManage.discountTypePercent'),
    free_time: t('couponManage.discountTypeFreeTime'),
    free_order: t('couponManage.discountTypeFreeOrder'),
  }

  const fmtDiscount = (r: any) => {
    const val = Number(r.discount_value)
    if (r.discount_type === 'percent') {
      const off = val <= 1 ? Math.round((1 - val) * 100) : Math.round(100 - val)
      return `-${off}% OFF`
    }
    if (r.discount_type === 'free_time') return `${val} min`
    if (r.discount_type === 'free_order') return t('couponManage.freeOrder')
    return `฿${val}`
  }

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [formVisible, setFormVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [coverImage, setCoverImage] = useState('')
  const [coverVideo, setCoverVideo] = useState('')
  const [stationScope, setStationScope] = useState<StationScope>({ type: 'all' })
  const [shareRecord, setShareRecord] = useState<any | null>(null)
  const [mallItemOptions, setMallItemOptions] = useState<{ value: string; label: string }[]>([])

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

  React.useEffect(() => {
    const loadMallItems = async () => {
      try {
        const res: any = await request.get('/growth/mall/items', { params: { pageNum: 1, pageSize: 200 } })
        const list = res?.data?.list || []
        setMallItemOptions(
          list.map((item: any) => ({
            value: String(item.id),
            label: `${pickML(item.name, language || 'zh') || item.id} (${item.id})`,
          }))
        )
      } catch {
        setMallItemOptions([])
      }
    }
    void loadMallItems()
  }, [language])

  const handleSearch = () => { setPage(1); fetchData(1, pageSize) }
  const handleAdd = () => {
    setIsEdit(false)
    form.resetFields()
    setCoverImage('')
    setCoverVideo('')
    setStationScope({ type: 'all' })
    setFormVisible(true)
  }

  const handleEdit = (record: any) => {
    setIsEdit(true)
    const sl = (language === 'zh' || language === 'th' || language === 'en') ? language : 'zh'
    form.setFieldsValue({
      id: record.id,
      _sourceLang: sl,
      name: pickML(record.name, sl),
      couponType: record.coupon_type,
      itemType: record.item_type || 'digital',
      discountType: record.discount_type,
      benefitActionType: record.benefit_action_type || 'benefit_detail',
      linkedMallItemId: record.linked_mall_item_id || undefined,
      discountValue: Number(record.discount_value),
      minAmount: Number(record.min_amount) || 0,
      totalCount: record.total_count,
      status: record.status,
      validFrom: record.valid_from ? dayjs(record.valid_from) : undefined,
      validTo: record.valid_to ? dayjs(record.valid_to) : undefined,
    })
    setCoverImage(record.cover_image || '')
    setCoverVideo(record.cover_video || '')
    setStationScope(record.station_scope || { type: 'all' })
    setFormVisible(true)
  }

  const handleFormOk = async () => {
    let values: any
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setSaving(true)
    try {
      const sourceLang = values._sourceLang || 'zh'
      const rawName: string = values.name || ''
      const mlName: any = { zh: '', th: '', en: '', [sourceLang]: rawName }
      // 保存前同步翻译（失败则静默降级，继续保存）
      if (rawName.trim()) {
        try {
          const tr: any = await request.post('/translate', { texts: { name: rawName }, sourceLang }, { timeout: 8000, silentError: true } as any)
          const result = tr?.data?.result ?? {}
          if (result.name) Object.assign(mlName, result.name)
        } catch {}
      }
      const payload = {
        ...values,
        name: mlName,
        validFrom: values.validFrom?.toISOString(),
        validTo: values.validTo?.toISOString(),
        coverImage: coverImage || undefined,
        coverVideo: coverVideo || undefined,
        benefitActionType: values.benefitActionType || 'benefit_detail',
        linkedMallItemId: values.benefitActionType === 'product_exchange' ? (values.linkedMallItemId || undefined) : undefined,
        station_scope: stationScope,
      }
      delete payload._sourceLang
      if (isEdit) {
        await request.post('/growth/coupon/update', payload)
        message.success(t('couponManage.msgUpdateOk'))
        asyncTranslateItem('coupon', String(values.id))
      } else {
        const res: any = await request.post('/growth/coupon/add', payload)
        message.success(t('couponManage.msgCreateOk'))
        const newId = res?.data?.data?.id || res?.data?.id
        if (newId) asyncTranslateItem('coupon', String(newId))
      }
      setFormVisible(false)
      fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.msg || '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (record: any) => {
    try {
      await request.post('/growth/coupon/delete', { id: record.id })
      message.success(t('couponManage.msgDeleteOk'))
      setData(prev => prev.filter(d => d.id !== record.id))
      setTotal(prev => Math.max(0, prev - 1))
    } catch (e: any) {}
  }

  const columns = [
    {
      title: t('couponManage.colCover'), key: 'cover', width: 60,
      render: (_: any, r: any) => r.cover_image
        ? <OssImage src={r.cover_image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} fallback={<span style={{ color: '#ddd', fontSize: 18 }}>—</span>} />
        : <span style={{ color: '#ddd', fontSize: 18 }}>—</span>,
    },
    {
      title: t('couponManage.colName'), dataIndex: 'name', key: 'name', width: 180, ellipsis: true,
      render: (v: any) => pick(v),
    },
    {
      title: t('couponManage.colType'), dataIndex: 'coupon_type', key: 'coupon_type', width: 100,
      render: (v: string) => <Tag color="blue">{couponTypeMap[v] || v}</Tag>,
    },
    {
      title: t('couponManage.colDiscount'), dataIndex: 'discount_type', key: 'discount_type', width: 110,
      render: (v: string) => <Tag color={discountTypeColors[v] || 'default'}>{discountTypeMap[v] || v}</Tag>,
    },
    {
      title: '权益动作', dataIndex: 'benefit_action_type', key: 'benefit_action_type', width: 120,
      render: (v: string) => <Tag color={v === 'product_exchange' ? 'purple' : v === 'charge_scan' ? 'cyan' : 'default'}>{benefitActionMap[v] || v || '权益说明页'}</Tag>,
    },
    {
      title: '关联商品', key: 'linked_mall_item', width: 220,
      render: (_: any, r: any) => {
        if (!r.linked_mall_item_id) return <span style={{ color: '#bbb' }}>—</span>
        const itemName = pickML(r.linked_mall_item_name, language || 'zh') || r.linked_mall_item_id
        return (
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontWeight: 600, color: '#333', lineHeight: 1.4 }}>{itemName}</span>
            <Space size={4} wrap>
              <Tag style={{ marginInlineEnd: 0 }}>{r.linked_mall_item_id}</Tag>
              {r.linked_mall_item_on_shelf == null ? null : (
                <Tag color={r.linked_mall_item_on_shelf ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
                  {r.linked_mall_item_on_shelf ? '已上架' : '已下架'}
                </Tag>
              )}
            </Space>
          </div>
        )
      },
    },
    {
      title: t('couponManage.colAmount'), key: 'discount', width: 110,
      render: (_: any, r: any) => <span style={{ fontWeight: 600, color: '#1677ff' }}>{fmtDiscount(r)}</span>,
    },
    {
      title: t('couponManage.colMinAmount'), dataIndex: 'min_amount', key: 'min_amount', width: 110,
      render: (v: any) => Number(v) > 0
        ? `${t('couponManage.thresholdPrefix')}฿${Number(v)}`
        : t('couponManage.thresholdNone'),
      responsive: ['md' as const],
    },
    {
      title: t('couponManage.colStock'), key: 'stock', width: 100,
      render: (_: any, r: any) => `${r.claimed_count || 0}/${r.total_count || 0}`,
    },
    {
      title: t('couponManage.colStatus'), dataIndex: 'status', key: 'status', width: 80,
      render: (v: number) => v === 1
        ? <Tag color="green">{t('couponManage.statusActive')}</Tag>
        : <Tag color="default">{t('couponManage.statusDisabled')}</Tag>,
    },
    {
      title: t('couponManage.colValidity'), key: 'validity', width: 180, responsive: ['lg' as const],
      render: (_: any, r: any) => r.valid_from && r.valid_to
        ? `${dayjs(r.valid_from).format('MM/DD')} - ${dayjs(r.valid_to).format('MM/DD')}`
        : '--',
    },
    {
      title: t('couponManage.colAction'), key: 'action', width: 180, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>{t('couponManage.actionEdit')}</Button>
          <Button type="link" size="small" icon={<ShareAltOutlined />} onClick={() => setShareRecord(record)} style={{ color: '#06C755' }}>{t('couponManage.actionPromo')}</Button>
          <Popconfirm title={t('couponManage.deleteTitle')} onConfirm={() => handleDelete(record)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger>{t('couponManage.actionDelete')}</Button>
          </Popconfirm>
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
              placeholder={t('couponManage.searchPlaceholder')}
              prefix={<SearchOutlined />}
              value={keyword} onChange={e => setKeyword(e.target.value)}
              onPressEnter={handleSearch} allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={16}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>{t('couponManage.btnSearch')}</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); fetchData(1, pageSize) }}>{t('couponManage.btnReset')}</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{t('couponManage.btnCreate')}</Button>
              <TranslateBatchButton type="coupon" onDone={() => fetchData(page, pageSize)} />
            </Space>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Table
          rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 960 }}
          pagination={{
            current: page, pageSize, total, showSizeChanger: true,
            showTotal: (tot) => `共 ${tot} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
          }}
        />
      </Card>

      <SharePromoModal
        open={!!shareRecord}
        onClose={() => setShareRecord(null)}
        type="coupon"
        id={shareRecord?.id}
        name={pick(shareRecord?.name)}
      />

      <Modal
        title={isEdit ? t('couponManage.editTitle') : t('couponManage.createTitle')}
        open={formVisible} onOk={handleFormOk} onCancel={() => { if (!saving) setFormVisible(false) }}
        confirmLoading={saving}
        width={680} destroyOnClose
      >
        <Form form={form} layout="vertical">
          {isEdit && <Form.Item name="id" hidden><Input /></Form.Item>}
          <Form.Item name="name" label={t('couponManage.formName')} rules={[{ required: true, message: t('couponManage.formName') + ' 必填' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="_sourceLang" label="输入语言 / Input Language" initialValue="zh">
            <Select options={LANG_OPTIONS} style={{ width: 160 }} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="couponType" label={t('couponManage.formType')} rules={[{ required: true }]}>
                <Select options={Object.entries(couponTypeMap).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="itemType" label="商品类型" initialValue="digital" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'digital', label: '🎟 数字券（充电/折扣）' },
                  { value: 'physical', label: '📦 实物礼品（需配送）' },
                ]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="discountType" label={t('couponManage.formDiscountType')} rules={[{ required: true }]}>
                <Select options={Object.entries(discountTypeMap).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="benefitActionType" label="权益动作" initialValue="benefit_detail">
                <Select options={benefitActionOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                shouldUpdate={(prev, next) =>
                  prev.benefitActionType !== next.benefitActionType ||
                  prev.linkedMallItemId !== next.linkedMallItemId
                }
                noStyle
              >
                {({ getFieldValue }) => {
                  const actionType = getFieldValue('benefitActionType')
                  return (
                    <Form.Item
                      name="linkedMallItemId"
                      label="关联兑换商品"
                      extra={actionType === 'product_exchange' ? '商品兑换券请选择一个积分商城商品' : '非商品兑换动作可留空'}
                      rules={actionType === 'product_exchange'
                        ? [{ required: true, message: '商品兑换券必须绑定一个积分商城商品' }]
                        : []}
                    >
                      <Select
                        allowClear
                        disabled={actionType !== 'product_exchange'}
                        showSearch
                        optionFilterProp="label"
                        options={mallItemOptions}
                        placeholder={actionType === 'product_exchange' ? '请选择必须绑定的商品' : '当前动作无需绑定商品'}
                      />
                    </Form.Item>
                  )
                }}
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="discountValue" label={t('couponManage.formDiscountValue')} rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="minAmount" label={t('couponManage.formMinAmount')}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="totalCount" label={t('couponManage.formTotalCount')} rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="validFrom" label={t('couponManage.formValidFrom')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="validTo" label={t('couponManage.formValidTo')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label={t('couponManage.formStatus')}>
            <Select options={[
              { value: 1, label: t('couponManage.statusActive') },
              { value: 0, label: t('couponManage.statusDisabled') },
            ]} />
          </Form.Item>

          <Form.Item label=" " colon={false} style={{ marginBottom: 4 }}>
            <StationScopeSelect value={stationScope} onChange={setStationScope} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0}>
            <span style={{ fontSize: 13, color: '#555' }}>{t('couponManage.dividerMedia')}</span>
          </Divider>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label={<span><PictureOutlined style={{ marginRight: 4 }} />{t('couponManage.labelCoverImage')}</span>} style={{ marginBottom: 8 }}>
                <MediaUploadField
                  type="image"
                  value={coverImage}
                  onChange={setCoverImage}
                  placeholder={t('couponManage.placeholderCoverImage')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label={<span><VideoCameraOutlined style={{ marginRight: 4 }} />{t('couponManage.labelCoverVideo')}</span>} style={{ marginBottom: 8 }}>
                <MediaUploadField
                  type="video"
                  value={coverVideo}
                  onChange={setCoverVideo}
                  placeholder={t('couponManage.placeholderCoverVideo')}
                  poster={coverImage}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
