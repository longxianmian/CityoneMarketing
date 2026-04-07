import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, message, Divider, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, ShopOutlined } from '@ant-design/icons'
import request from '../../api/request'
import MediaUploadField from '../../components/MediaUploadField'
import MultiLangInput from '../../components/MultiLangInput'
import { useI18n } from '../../i18n'

function toMultiLang(v: any): { zh: string; th: string; en: string } {
  if (v && typeof v === 'object' && ('zh' in v || 'th' in v || 'en' in v)) return { zh: v.zh || '', th: v.th || '', en: v.en || '' }
  return { zh: typeof v === 'string' ? v : '', th: '', en: '' }
}

const MULTI_LANG_FIELDS = ['title', 'subTitle', 'benefitContent', 'usageRules', 'redeemNotice', 'actionText']

export default function ProductTemplateManage() {
  const { t, language } = useI18n()

  const ACTION_TYPES = [
    { value: 'free_claim', label: t('adminTemplate.product.actionFreeClaim') },
    { value: 'points_redeem', label: t('adminTemplate.product.actionPointsRedeem') },
    { value: 'cash_buy', label: t('adminTemplate.product.actionCashBuy') },
    { value: 'use_now', label: t('adminTemplate.product.actionUseNow') },
  ]

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [formVisible, setFormVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [editingId, setEditingId] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [coverImage, setCoverImage] = useState('')
  const [coverVideo, setCoverVideo] = useState('')

  const fetchData = async (p = page) => {
    setLoading(true)
    try {
      const res: any = await request.get('/product-templates', { params: { page: p, pageSize } })
      setData(res.data?.list || [])
      setTotal(res.data?.total || 0)
    } catch { setData([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleAdd = () => {
    setIsEdit(false); setEditingId(null)
    form.resetFields(); setCoverImage(''); setCoverVideo('')
    setFormVisible(true)
  }

  const handleEdit = (r: any) => {
    setIsEdit(true); setEditingId(r.id)
    const patch: any = {}
    MULTI_LANG_FIELDS.forEach((f) => { patch[f] = toMultiLang(r[f]) })
    form.setFieldsValue({ ...r, ...patch })
    setCoverImage(r.coverImage || ''); setCoverVideo(r.coverVideo || '')
    setFormVisible(true)
  }

  const handleDelete = (r: any) => {
    Modal.confirm({
      title: t('adminTemplate.product.confirmDelete'),
      onOk: async () => {
        try {
          await request.delete(`/product-templates/${r.id}`)
          message.success(t('adminTemplate.common.deleteSuccess')); fetchData()
        } catch { message.error(t('adminTemplate.common.deleteFail')) }
      },
    })
  }

  const handleOk = async () => {
    let values: any
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setSaving(true)
    try {
      const sourceLang = (language === 'zh' || language === 'th' || language === 'en') ? language : 'zh'
      const textsToTranslate: Record<string, string> = {}
      MULTI_LANG_FIELDS.forEach((f) => {
        const v = values[f] || {}
        const srcText = v[sourceLang]?.trim()
        const hasEmpty = ['zh','th','en'].some((l) => l !== sourceLang && !v[l]?.trim())
        if (srcText && hasEmpty) textsToTranslate[f] = srcText
      })

      if (Object.keys(textsToTranslate).length > 0) {
        try {
          const res: any = await request.post('/translate', { texts: textsToTranslate, sourceLang }, { timeout: 8000, silentError: true } as any)
          const result = res.data?.result ?? {}
          const patch: any = {}
          Object.entries(result).forEach(([key, translated]) => {
            const cur = values[key] || {}
            patch[key] = { ...cur, ...(translated as any) }
            values[key] = patch[key]
          })
          form.setFieldsValue(patch)
        } catch {
          // 翻译失败静默降级，继续保存
        }
      }

      const payload = { ...values, coverImage, coverVideo }
      if (isEdit) {
        await request.put(`/product-templates/${editingId}`, payload)
        message.success(t('adminTemplate.common.updateSuccess'))
      } else {
        await request.post('/product-templates', payload)
        message.success(t('adminTemplate.common.createSuccess'))
      }
      setFormVisible(false)
      fetchData()
    } catch (err: any) {
      message.error(err?.message || '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const displayTitle = (v: any) => typeof v === 'string' ? v : (v?.[language] || v?.zh || v?.th || v?.en || '')

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: t('adminTemplate.common.templateName'), dataIndex: 'name', key: 'name', width: 200 },
    { title: t('adminTemplate.product.columnTitle'), dataIndex: 'title', key: 'title', width: 200, render: displayTitle },
    { title: t('adminTemplate.product.columnPointsPrice'), dataIndex: 'pointsPrice', key: 'pointsPrice', width: 100,
      render: (v: number) => v ? `${v} pts` : '—' },
    { title: t('adminTemplate.product.columnCashPrice'), dataIndex: 'cashPrice', key: 'cashPrice', width: 100,
      render: (v: number) => v ? `฿${v}` : '—' },
    { title: t('adminTemplate.product.columnActionType'), dataIndex: 'actionType', key: 'actionType', width: 120,
      render: (v: string) => ACTION_TYPES.find(a => a.value === v)?.label || v },
    { title: t('adminTemplate.common.status'), dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('adminTemplate.common.enable') : t('adminTemplate.common.disable')}</Tag> },
    { title: t('adminTemplate.common.action'), key: 'action', width: 140,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>{t('adminTemplate.common.edit')}</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)}>{t('adminTemplate.common.delete')}</Button>
        </Space>
      ) },
  ]

  return (
    <Card
      title={<Space><ShopOutlined />{t('adminTemplate.product.cardTitle')}</Space>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>{t('adminTemplate.common.refresh')}</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{t('adminTemplate.common.newTemplate')}</Button>
        </Space>
      }
    >
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="small"
        pagination={{ current: page, pageSize, total, showTotal: (n) => t('adminTemplate.common.totalCount').replace('{n}', String(n)), onChange: p => { setPage(p); fetchData(p) } }}
      />

      <Modal
        title={isEdit ? t('adminTemplate.product.modalEdit') : t('adminTemplate.product.modalNew')}
        open={formVisible} onOk={handleOk} onCancel={() => { if (!saving) setFormVisible(false) }}
        confirmLoading={saving}
        width={720} destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t('adminTemplate.product.formTemplateName')} rules={[{ required: true }]}><Input /></Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{t('adminTemplate.product.sectionMain')}</Divider>
          <Form.Item name="title" label={t('adminTemplate.product.formTitle')} rules={[{ required: true, message: t('adminTemplate.common.requiredChTitle') }]}>
            <MultiLangInput />
          </Form.Item>
          <Form.Item name="subTitle" label={t('adminTemplate.product.formSubTitle')}>
            <MultiLangInput />
          </Form.Item>
          <Form.Item label={t('adminTemplate.product.formCoverImage')}>
            <MediaUploadField type="image" value={coverImage} onChange={setCoverImage} />
          </Form.Item>
          <Form.Item label={t('adminTemplate.product.formCoverVideo')}>
            <MediaUploadField type="video" value={coverVideo} onChange={setCoverVideo} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{t('adminTemplate.product.sectionPrice')}</Divider>
          <Form.Item name="pointsPrice" label={t('adminTemplate.product.formPointsPrice')}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0 = free" />
          </Form.Item>
          <Form.Item name="cashPrice" label={t('adminTemplate.product.formCashPrice')}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="0 = free" />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{t('adminTemplate.product.sectionBenefit')}</Divider>
          <Form.Item name="benefitContent" label={t('adminTemplate.product.formBenefitContent')}>
            <MultiLangInput textarea rows={3} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{t('adminTemplate.product.sectionRules')}</Divider>
          <Form.Item name="usageRules" label={t('adminTemplate.product.formUsageRules')}>
            <MultiLangInput textarea rows={3} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{t('adminTemplate.product.sectionRedeem')}</Divider>
          <Form.Item name="redeemNotice" label={t('adminTemplate.product.formRedeemNotice')}>
            <MultiLangInput textarea rows={2} />
          </Form.Item>

          <Form.Item name="linkedActivityIds" label={t('adminTemplate.product.formLinkedActivities')}>
            <Input placeholder={t('adminTemplate.product.placeholderLinkedIds')} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{t('adminTemplate.product.sectionAction')}</Divider>
          <Form.Item name="actionType" label={t('adminTemplate.product.formActionType')} rules={[{ required: true }]}>
            <Select options={ACTION_TYPES} />
          </Form.Item>
          <Form.Item name="actionText" label={t('adminTemplate.product.formActionText')}>
            <MultiLangInput placeholder={t('adminTemplate.product.placeholderActionText')} />
          </Form.Item>
          <Form.Item name="enabled" label={t('adminTemplate.common.isEnabled')} valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
