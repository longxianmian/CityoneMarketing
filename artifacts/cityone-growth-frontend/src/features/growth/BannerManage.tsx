import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, InputNumber,
  Select, Switch, message, Image
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons'
import request from '../../api/request'
import MediaUploadField from '../../components/MediaUploadField'
import { useI18n } from '../../i18n'

const LANG_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'th', label: 'ภาษาไทย' },
  { value: 'en', label: 'English' },
]

const LINK_TYPE_OPTIONS = [
  { value: 'internal', label: '站内链接' },
  { value: 'external', label: '站外链接' },
]

function pickText(v: any, lang = 'zh'): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  return v[lang] || v.zh || v.th || v.en || ''
}

export default function BannerManage() {
  const { t, language } = useI18n()
  const bm = (key: string) => t(`admin.banner.${key}`)

  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form] = Form.useForm()
  const [imageUrl, setImageUrl] = useState('')
  const [linkType, setLinkType] = useState<'internal' | 'external'>('internal')

  const loadItems = async () => {
    setLoading(true)
    try {
      const { data } = await request.get('/growth/banners')
      setItems(data.list || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadItems() }, [])

  const handleAdd = () => {
    setEditItem(null)
    form.resetFields()
    form.setFieldsValue({
      _sourceLang: language || 'zh',
      link_type: 'internal',
      sort_order: items.length,
      enabled: true,
    })
    setImageUrl('')
    setLinkType('internal')
    setModalOpen(true)
  }

  const handleEdit = (record: any) => {
    setEditItem(record)
    const sl = (language === 'zh' || language === 'th' || language === 'en') ? language : 'zh'
    form.setFieldsValue({
      ...record,
      _sourceLang: sl,
      title: pickText(record.title, sl),
      sub_title: pickText(record.sub_title, sl),
    })
    setImageUrl(record.image_url || '')
    setLinkType(record.link_type || 'internal')
    setModalOpen(true)
  }

  const handleSave = async () => {
    let values: any
    try { values = await form.validateFields() } catch { return }

    setSaving(true)
    try {
      const sourceLang = values._sourceLang || 'zh'
      const mlFields = ['title', 'sub_title'] as const
      const mlValues: Record<string, any> = {}
      mlFields.forEach(f => {
        const raw = values[f] || ''
        mlValues[f] = { zh: '', th: '', en: '', [sourceLang]: raw }
      })

      // 自动翻译
      const textsToTranslate: Record<string, string> = {}
      mlFields.forEach(f => {
        const src = mlValues[f][sourceLang]?.trim()
        if (src && ['zh', 'th', 'en'].some(l => l !== sourceLang && !mlValues[f][l]?.trim())) {
          textsToTranslate[f] = src
        }
      })
      if (Object.keys(textsToTranslate).length > 0) {
        try {
          const res: any = await request.post('/translate', { texts: textsToTranslate, sourceLang }, { timeout: 8000, silentError: true } as any)
          const result = res.data?.result ?? {}
          mlFields.forEach(f => { if (result[f]) mlValues[f] = { ...mlValues[f], ...result[f] } })
        } catch {}
      }

      const payload = {
        ...values,
        image_url: imageUrl,
        title: mlValues.title,
        sub_title: mlValues.sub_title,
      }
      delete payload._sourceLang

      if (editItem) {
        await request.put(`/growth/banners/${editItem.id}`, payload)
        message.success(bm('updateSuccess'))
      } else {
        await request.post('/growth/banners', payload)
        message.success(bm('addSuccess'))
      }
      setModalOpen(false)
      loadItems()
    } catch (err: any) {
      message.error(err?.message || bm('saveFail'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (record: any) => {
    Modal.confirm({
      title: bm('confirmDelete'),
      onOk: async () => {
        try {
          await request.delete(`/growth/banners/${record.id}`)
          message.success(bm('deleteSuccess'))
          loadItems()
        } catch { message.error(bm('deleteFail')) }
      },
    })
  }

  const lang = (language === 'zh' || language === 'th' || language === 'en') ? language : 'zh'

  const columns = [
    {
      title: bm('colImage'), dataIndex: 'image_url', key: 'image', width: 80,
      render: (v: string) => v
        ? <Image src={v} width={56} height={40} style={{ objectFit: 'cover', borderRadius: 6 }} preview={false} />
        : <div style={{ width: 56, height: 40, background: '#f0f0f0', borderRadius: 6 }} />,
    },
    {
      title: bm('colTitle'), key: 'title', width: 200,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{pickText(r.title, lang) || '--'}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{pickText(r.sub_title, lang)}</div>
        </div>
      ),
    },
    {
      title: bm('colLink'), key: 'link', width: 220,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Tag color={r.link_type === 'external' ? 'purple' : 'blue'} style={{ fontSize: 11 }}>
            {r.link_type === 'external' ? bm('linkExternal') : bm('linkInternal')}
          </Tag>
          <span style={{ fontSize: 12, color: '#555', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
            {r.link_url || '--'}
          </span>
        </Space>
      ),
    },
    {
      title: bm('colSort'), dataIndex: 'sort_order', key: 'sort_order', width: 60,
      render: (v: number) => <span style={{ color: '#888' }}>{v ?? '--'}</span>,
    },
    {
      title: bm('colEnabled'), dataIndex: 'enabled', key: 'enabled', width: 70,
      render: (v: boolean) => <Tag color={v !== false ? 'green' : 'default'}>{v !== false ? bm('statusOn') : bm('statusOff')}</Tag>,
    },
    {
      title: bm('colAction'), key: 'action', width: 120,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>{bm('btnEdit')}</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)} />
        </Space>
      ),
    },
  ]

  return (
    <Card title={bm('pageTitle')} extra={
      <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{bm('btnAdd')}</Button>
    }>
      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
      />

      <Modal
        title={editItem ? bm('modalEdit') : bm('modalAdd')}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { if (!saving) setModalOpen(false) }}
        confirmLoading={saving}
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="_sourceLang" label={bm('formInputLang')} initialValue="zh">
            <Select options={LANG_OPTIONS} style={{ width: 160 }} />
          </Form.Item>

          <Form.Item label={bm('formImage')}>
            <MediaUploadField
              type="image"
              value={imageUrl}
              onChange={setImageUrl}
              placeholder={bm('formImageHint')}
            />
          </Form.Item>

          <Form.Item name="title" label={bm('formTitle')}>
            <Input placeholder={bm('formTitleHint')} />
          </Form.Item>

          <Form.Item name="sub_title" label={bm('formSubTitle')}>
            <Input placeholder={bm('formSubTitleHint')} />
          </Form.Item>

          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="link_type" label={bm('formLinkType')} style={{ flex: 1 }}>
              <Select
                options={LINK_TYPE_OPTIONS}
                onChange={(v) => setLinkType(v)}
              />
            </Form.Item>
            <Form.Item name="sort_order" label={bm('formSortOrder')} style={{ width: 100 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="enabled" label={bm('formEnabled')} valuePropName="checked" style={{ width: 80 }}>
              <Switch checkedChildren={bm('statusOn')} unCheckedChildren={bm('statusOff')} />
            </Form.Item>
          </div>

          <Form.Item
            name="link_url"
            label={bm('formLinkUrl')}
            help={linkType === 'internal' ? bm('linkInternalHint') : bm('linkExternalHint')}
          >
            <Input
              prefix={<LinkOutlined />}
              placeholder={linkType === 'internal' ? '/welfare  /activity/xxx  /mine' : 'https://example.com'}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
