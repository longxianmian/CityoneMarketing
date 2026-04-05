import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Divider, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, FileTextOutlined } from '@ant-design/icons'
import request from '../../api/request'
import MediaUploadField from '../../components/MediaUploadField'
import MultiLangInput from '../../components/MultiLangInput'
import { useI18n } from '../../i18n'

function toMultiLang(v: any): { zh: string; th: string; en: string } {
  if (v && typeof v === 'object' && ('zh' in v || 'th' in v || 'en' in v)) return { zh: v.zh || '', th: v.th || '', en: v.en || '' }
  return { zh: typeof v === 'string' ? v : '', th: '', en: '' }
}

const MULTI_LANG_FIELDS = ['title', 'subTitle', 'description', 'highlights', 'participationGuide', 'rewardGuide', 'noticeText', 'buttonText']

export default function ActivityTemplateManage() {
  const { t, language } = useI18n()

  const BUTTON_TYPES = [
    { value: 'join', label: t('adminTemplate.activity.btnJoin') },
    { value: 'wheel', label: t('adminTemplate.activity.btnWheel') },
    { value: 'scratch', label: t('adminTemplate.activity.btnScratch') },
    { value: 'fortune', label: t('adminTemplate.activity.btnFortune') },
    { value: 'follow', label: t('adminTemplate.activity.btnFollow') },
    { value: 'redeem', label: t('adminTemplate.activity.btnRedeem') },
  ]

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [formVisible, setFormVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [editingId, setEditingId] = useState<any>(null)
  const [form] = Form.useForm()
  const [coverImage, setCoverImage] = useState('')
  const [coverVideo, setCoverVideo] = useState('')

  const fetchData = async (p = page) => {
    setLoading(true)
    try {
      const res: any = await request.get('/api/activity-templates', { params: { page: p, pageSize } })
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
      title: t('adminTemplate.activity.confirmDelete'),
      onOk: async () => {
        try {
          await request.delete(`/api/activity-templates/${r.id}`)
          message.success(t('adminTemplate.common.deleteSuccess')); fetchData()
        } catch { message.error(t('adminTemplate.common.deleteFail')) }
      },
    })
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()

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
        const hide = message.loading(t('adminTemplate.common.translating'), 0)
        try {
          const res: any = await request.post('/api/translate', { texts: textsToTranslate, sourceLang })
          const result = res.data?.result ?? {}
          const patch: any = {}
          Object.entries(result).forEach(([key, translated]) => {
            const cur = values[key] || {}
            patch[key] = { ...cur, ...(translated as any) }
            values[key] = patch[key]
          })
          form.setFieldsValue(patch)
          hide()
          message.success(t('adminTemplate.common.translateDone'))
        } catch {
          hide()
          message.warning(t('adminTemplate.common.translateFail'))
        }
      }

      const payload = { ...values, coverImage, coverVideo }
      if (isEdit) {
        await request.put(`/api/activity-templates/${editingId}`, payload)
        message.success(t('adminTemplate.common.updateSuccess'))
      } else {
        await request.post('/api/activity-templates', payload)
        message.success(t('adminTemplate.common.createSuccess'))
      }
      setFormVisible(false); fetchData()
    } catch {}
  }

  const handleAutoTranslate = () => {
    const vals = form.getFieldsValue(MULTI_LANG_FIELDS)
    const texts: Record<string, string> = {}
    MULTI_LANG_FIELDS.forEach((f) => { const v = vals[f]; if (v?.zh?.trim()) texts[f] = v.zh })
    return texts
  }

  const applyTranslation = (result: Record<string, any>) => {
    const patch: any = {}
    MULTI_LANG_FIELDS.forEach((f) => {
      if (result[f]) {
        const cur = form.getFieldValue(f) || {}
        patch[f] = { ...cur, ...result[f] }
      }
    })
    form.setFieldsValue(patch)
  }

  const displayTitle = (v: any) => typeof v === 'string' ? v : (v?.zh || v?.th || v?.en || '')

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: t('adminTemplate.common.templateName'), dataIndex: 'name', key: 'name', width: 200 },
    { title: t('adminTemplate.activity.columnTitle'), dataIndex: 'title', key: 'title', width: 200, render: displayTitle },
    { title: t('adminTemplate.activity.columnButtonType'), dataIndex: 'buttonType', key: 'buttonType', width: 140,
      render: (v: string) => BUTTON_TYPES.find(b => b.value === v)?.label || v },
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
      title={<Space><FileTextOutlined />{t('adminTemplate.activity.cardTitle')}</Space>}
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
        title={isEdit ? t('adminTemplate.activity.modalEdit') : t('adminTemplate.activity.modalNew')}
        open={formVisible} onOk={handleOk} onCancel={() => setFormVisible(false)}
        width={720} destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t('adminTemplate.common.templateName')} rules={[{ required: true }]}>
            <Input placeholder={t('adminTemplate.common.internalName')} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{t('adminTemplate.activity.sectionMain')}</Divider>
          <Form.Item name="title" label={t('adminTemplate.activity.formTitle')} rules={[{ required: true, message: t('adminTemplate.common.requiredChTitle') }]}>
            <MultiLangInput />
          </Form.Item>
          <Form.Item name="subTitle" label={t('adminTemplate.activity.formSubTitle')}>
            <MultiLangInput />
          </Form.Item>
          <Form.Item label={t('adminTemplate.activity.formCoverImage')}>
            <MediaUploadField type="image" value={coverImage} onChange={setCoverImage} placeholder={t('adminTemplate.activity.uploadCoverImage')} />
          </Form.Item>
          <Form.Item label={t('adminTemplate.activity.formCoverVideo')}>
            <MediaUploadField type="video" value={coverVideo} onChange={setCoverVideo} placeholder={t('adminTemplate.activity.uploadCoverVideo')} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{t('adminTemplate.activity.sectionDesc')}</Divider>
          <Form.Item name="description" label={t('adminTemplate.activity.formDescription')}>
            <MultiLangInput textarea rows={3} />
          </Form.Item>
          <Form.Item name="highlights" label={t('adminTemplate.activity.formHighlights')}>
            <MultiLangInput textarea rows={2} placeholder={t('adminTemplate.activity.placeholderHighlights')} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{t('adminTemplate.activity.sectionSteps')}</Divider>
          <Form.Item name="participationGuide" label={t('adminTemplate.activity.formParticipationGuide')}>
            <MultiLangInput textarea rows={3} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{t('adminTemplate.activity.sectionReward')}</Divider>
          <Form.Item name="rewardGuide" label={t('adminTemplate.activity.formRewardGuide')}>
            <MultiLangInput textarea rows={2} />
          </Form.Item>
          <Form.Item name="linkedProductIds" label={t('adminTemplate.activity.formLinkedProducts')}>
            <Input placeholder="e.g. 1,2,3" />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{t('adminTemplate.activity.sectionNotice')}</Divider>
          <Form.Item name="noticeText" label={t('adminTemplate.activity.formNoticeText')}>
            <MultiLangInput textarea rows={2} />
          </Form.Item>
          <Form.Item name="buttonType" label={t('adminTemplate.activity.formButtonType')} rules={[{ required: true }]}>
            <Select options={BUTTON_TYPES} />
          </Form.Item>
          <Form.Item name="buttonText" label={t('adminTemplate.activity.formButtonText')}>
            <MultiLangInput placeholder={t('adminTemplate.activity.placeholderButtonText')} />
          </Form.Item>
          <Form.Item name="enabled" label={t('adminTemplate.common.isEnabled')} valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
