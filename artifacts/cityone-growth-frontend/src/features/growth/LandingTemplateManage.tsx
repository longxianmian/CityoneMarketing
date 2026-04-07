import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Divider, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, LinkOutlined } from '@ant-design/icons'
import request from '../../api/request'
import MediaUploadField from '../../components/MediaUploadField'
import MultiLangInput from '../../components/MultiLangInput'
import { useI18n } from '../../i18n'

function toMultiLang(v: any): { zh: string; th: string; en: string } {
  if (v && typeof v === 'object' && ('zh' in v || 'th' in v || 'en' in v)) return { zh: v.zh || '', th: v.th || '', en: v.en || '' }
  return { zh: typeof v === 'string' ? v : '', th: '', en: '' }
}

const MULTI_LANG_FIELDS = ['title', 'subTitle', 'benefitText', 'supportText', 'buttonText']

export default function LandingTemplateManage() {
  const { t, language } = useI18n()

  const TEMPLATE_TYPES = [
    { value: 'video_ad', label: t('adminTemplate.landing.typeVideoAd') },
    { value: 'social', label: t('adminTemplate.landing.typeSocial') },
    { value: 'organic', label: t('adminTemplate.landing.typeOrganic') },
    { value: 'event', label: t('adminTemplate.landing.typeEvent') },
  ]

  const AUTO_ACTIONS = [
    { value: 'open_welfare', label: t('adminTemplate.landing.actionOpenWelfare') },
    { value: 'open_activity', label: t('adminTemplate.landing.actionOpenActivity') },
    { value: 'open_product', label: t('adminTemplate.landing.actionOpenProduct') },
    { value: 'open_nearby', label: t('adminTemplate.landing.actionOpenNearby') },
    { value: 'none', label: t('adminTemplate.landing.actionNone') },
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

  const fetchData = async (p = page) => {
    setLoading(true)
    try {
      const res: any = await request.get('/landing-templates', { params: { page: p, pageSize } })
      setData(res.data?.list || [])
      setTotal(res.data?.total || 0)
    } catch { setData([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleAdd = () => {
    setIsEdit(false); setEditingId(null)
    form.resetFields(); setCoverImage('')
    setFormVisible(true)
  }

  const handleEdit = (r: any) => {
    setIsEdit(true); setEditingId(r.id)
    const patch: any = {}
    MULTI_LANG_FIELDS.forEach((f) => { patch[f] = toMultiLang(r[f]) })
    form.setFieldsValue({ ...r, ...patch })
    setCoverImage(r.coverImage || '')
    setFormVisible(true)
  }

  const handleDelete = (r: any) => {
    Modal.confirm({
      title: t('adminTemplate.landing.confirmDelete'),
      onOk: async () => {
        try {
          await request.delete(`/landing-templates/${r.id}`)
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
      const langs = ['zh', 'th', 'en']
      const sourceLang = (language === 'zh' || language === 'th' || language === 'en') ? language : 'zh'
      const textsToTranslate: Record<string, string> = {}
      MULTI_LANG_FIELDS.forEach((f) => {
        const v = values[f] || {}
        const srcText = v[sourceLang]?.trim()
        const hasEmpty = langs.some((l) => l !== sourceLang && !v[l]?.trim())
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

      const payload = { ...values, coverImage }
      if (isEdit) {
        await request.put(`/landing-templates/${editingId}`, payload)
        message.success(t('adminTemplate.common.updateSuccess'))
      } else {
        await request.post('/landing-templates', payload)
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
    { title: t('adminTemplate.landing.columnType'), dataIndex: 'templateType', key: 'templateType', width: 140,
      render: (v: string) => TEMPLATE_TYPES.find(tp => tp.value === v)?.label || v },
    { title: t('adminTemplate.landing.columnMainTitle'), dataIndex: 'title', key: 'title', width: 200, render: displayTitle },
    { title: t('adminTemplate.landing.columnAutoAction'), dataIndex: 'autoAction', key: 'autoAction', width: 140,
      render: (v: string) => AUTO_ACTIONS.find(a => a.value === v)?.label || v },
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
      title={<Space><LinkOutlined />{t('adminTemplate.landing.cardTitle')}</Space>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>{t('adminTemplate.common.refresh')}</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{t('adminTemplate.common.newTemplate')}</Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ current: page, pageSize, total, showTotal: (n) => t('adminTemplate.common.totalCount').replace('{n}', String(n)), onChange: p => { setPage(p); fetchData(p) } }}
      />

      <Modal
        title={isEdit ? t('adminTemplate.landing.modalEdit') : t('adminTemplate.landing.modalNew')}
        open={formVisible}
        onOk={handleOk}
        onCancel={() => { if (!saving) setFormVisible(false) }}
        confirmLoading={saving}
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t('adminTemplate.common.templateName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="templateType" label={t('adminTemplate.landing.formTemplateType')} rules={[{ required: true }]}>
            <Select options={TEMPLATE_TYPES} placeholder={t('adminTemplate.landing.placeholderTemplateType')} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{t('adminTemplate.landing.sectionContent')}</Divider>
          <Form.Item name="title" label={t('adminTemplate.landing.formMainTitle')} rules={[{ required: true, message: t('adminTemplate.common.requiredChTitle') }]}>
            <MultiLangInput />
          </Form.Item>
          <Form.Item name="subTitle" label={t('adminTemplate.landing.formSubTitle')}>
            <MultiLangInput />
          </Form.Item>
          <Form.Item name="benefitText" label={t('adminTemplate.landing.formBenefitText')}>
            <MultiLangInput />
          </Form.Item>
          <Form.Item name="supportText" label={t('adminTemplate.landing.formSupportText')}>
            <MultiLangInput textarea rows={2} />
          </Form.Item>
          <Form.Item name="buttonText" label={t('adminTemplate.landing.formButtonText')} rules={[{ required: true, message: t('adminTemplate.common.requiredChTitle') }]}>
            <MultiLangInput />
          </Form.Item>
          <Form.Item label={t('adminTemplate.landing.formCoverImage')}>
            <MediaUploadField type="image" value={coverImage} onChange={setCoverImage} placeholder={t('adminTemplate.landing.uploadCoverImage')} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{t('adminTemplate.landing.sectionAutoAction')}</Divider>
          <Form.Item name="autoAction" label={t('adminTemplate.landing.formAutoAction')} rules={[{ required: true }]}>
            <Select options={AUTO_ACTIONS} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.autoAction !== c.autoAction}>
            {({ getFieldValue }) => {
              const action = getFieldValue('autoAction')
              if (action === 'open_activity') return (
                <Form.Item name="targetActivityId" label={t('adminTemplate.landing.formTargetActivityId')} rules={[{ required: true }]}>
                  <Input placeholder={t('adminTemplate.landing.placeholderActivityId')} />
                </Form.Item>
              )
              if (action === 'open_product') return (
                <Form.Item name="targetProductId" label={t('adminTemplate.landing.formTargetProductId')} rules={[{ required: true }]}>
                  <Input placeholder={t('adminTemplate.landing.placeholderProductId')} />
                </Form.Item>
              )
              return null
            }}
          </Form.Item>
          <Form.Item name="enabled" label={t('adminTemplate.common.isEnabled')} valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
