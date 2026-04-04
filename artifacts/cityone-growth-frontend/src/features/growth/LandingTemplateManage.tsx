import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Divider, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, LinkOutlined } from '@ant-design/icons'
import request from '../../api/request'
import MediaUploadField from '../../components/MediaUploadField'
import MultiLangInput, { AutoTranslateButton } from '../../components/MultiLangInput'

const TEMPLATE_TYPES = [
  { value: 'video_ad', label: '视频广告落地页' },
  { value: 'social', label: '社群流量承接页' },
  { value: 'organic', label: '自然流落地页' },
  { value: 'event', label: '活动专属落地页' },
]

const AUTO_ACTIONS = [
  { value: 'open_welfare', label: '跳转福利中心' },
  { value: 'open_activity', label: '跳转活动详情' },
  { value: 'open_product', label: '跳转数字商品' },
  { value: 'open_nearby', label: '跳转附近站点' },
  { value: 'none', label: '无动作' },
]

function toMultiLang(v: any): { zh: string; th: string; en: string } {
  if (v && typeof v === 'object' && ('zh' in v || 'th' in v || 'en' in v)) return { zh: v.zh || '', th: v.th || '', en: v.en || '' }
  return { zh: typeof v === 'string' ? v : '', th: '', en: '' }
}

const MULTI_LANG_FIELDS = ['title', 'subTitle', 'benefitText', 'supportText', 'buttonText']

export default function LandingTemplateManage() {
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

  const fetchData = async (p = page) => {
    setLoading(true)
    try {
      const res: any = await request.get('/api/landing-templates', { params: { page: p, pageSize } })
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
      title: '确认删除该落地页模板？',
      onOk: async () => {
        try {
          await request.delete(`/api/landing-templates/${r.id}`)
          message.success('删除成功'); fetchData()
        } catch { message.error('删除失败') }
      },
    })
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()

      // Auto-translate: detect source lang + fields missing translation
      const langs = ['zh', 'th', 'en']
      const langCount: Record<string, number> = { zh: 0, th: 0, en: 0 }
      MULTI_LANG_FIELDS.forEach((f) => {
        const v = values[f] || {}
        langs.forEach((l) => { if (v[l]?.trim()) langCount[l]++ })
      })
      const sourceLang = Object.entries(langCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'zh'
      const textsToTranslate: Record<string, string> = {}
      MULTI_LANG_FIELDS.forEach((f) => {
        const v = values[f] || {}
        const srcText = v[sourceLang]?.trim()
        const hasEmpty = langs.some((l) => l !== sourceLang && !v[l]?.trim())
        if (srcText && hasEmpty) textsToTranslate[f] = srcText
      })

      if (Object.keys(textsToTranslate).length > 0) {
        const hide = message.loading('正在自动翻译成三语…', 0)
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
          message.success('✅ 翻译完成，正在保存…')
        } catch {
          hide()
          message.warning('自动翻译失败，将以当前内容保存')
        }
      }

      const payload = { ...values, coverImage }
      if (isEdit) {
        await request.put(`/api/landing-templates/${editingId}`, payload)
        message.success('更新成功')
      } else {
        await request.post('/api/landing-templates', payload)
        message.success('创建成功')
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
    { title: '模板名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '类型', dataIndex: 'templateType', key: 'templateType', width: 140,
      render: (v: string) => TEMPLATE_TYPES.find(t => t.value === v)?.label || v },
    { title: '主标题', dataIndex: 'title', key: 'title', width: 200, render: displayTitle },
    { title: '关注后动作', dataIndex: 'autoAction', key: 'autoAction', width: 140,
      render: (v: string) => AUTO_ACTIONS.find(a => a.value === v)?.label || v },
    { title: '状态', dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '禁用'}</Tag> },
    { title: '操作', key: 'action', width: 140,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)}>删除</Button>
        </Space>
      ) },
  ]

  return (
    <Card
      title={<Space><LinkOutlined />落地页模板管理</Space>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建模板</Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ current: page, pageSize, total, showTotal: t => `共 ${t} 条`, onChange: p => { setPage(p); fetchData(p) } }}
      />

      <Modal
        title={isEdit ? '编辑落地页模板' : '新建落地页模板'}
        open={formVisible}
        onOk={handleOk}
        onCancel={() => setFormVisible(false)}
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="如：视频广告-拉新落地页-v1" />
          </Form.Item>
          <Form.Item name="templateType" label="模板类型" rules={[{ required: true }]}>
            <Select options={TEMPLATE_TYPES} placeholder="选择模板类型" />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>页面内容</Divider>
          <AutoTranslateButton
            sourceLang="zh"
            getTexts={handleAutoTranslate}
            onResult={applyTranslation}
          />
          <Form.Item name="title" label="主标题（三语）" rules={[{ required: true, message: '请填写中文主标题' }]}>
            <MultiLangInput placeholder="页面大标题，如：限时福利！关注领15分钟免费时长" />
          </Form.Item>
          <Form.Item name="subTitle" label="副标题（三语）">
            <MultiLangInput placeholder="副标题，如：仅限新关注用户" />
          </Form.Item>
          <Form.Item name="benefitText" label="一句话利益点（三语）">
            <MultiLangInput placeholder="如：免费试用 · 到站即用 · 无需押金" />
          </Form.Item>
          <Form.Item name="supportText" label="支撑说明文案（三语）">
            <MultiLangInput textarea rows={2} placeholder="如：CityOne 是泰国领先的共享充电宝品牌，已覆盖 500+ 站点" />
          </Form.Item>
          <Form.Item name="buttonText" label="主按钮文案（三语）" rules={[{ required: true, message: '请填写中文按钮文案' }]}>
            <MultiLangInput placeholder="如：立即关注 LINE OA" />
          </Form.Item>
          <Form.Item label="封面图">
            <MediaUploadField type="image" value={coverImage} onChange={setCoverImage} placeholder="上传落地页封面图" />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>关注后动作</Divider>
          <Form.Item name="autoAction" label="关注成功后自动跳转" rules={[{ required: true }]}>
            <Select options={AUTO_ACTIONS} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.autoAction !== c.autoAction}>
            {({ getFieldValue }) => {
              const action = getFieldValue('autoAction')
              if (action === 'open_activity') return (
                <Form.Item name="targetActivityId" label="目标活动ID" rules={[{ required: true }]}>
                  <Input placeholder="活动 ID" />
                </Form.Item>
              )
              if (action === 'open_product') return (
                <Form.Item name="targetProductId" label="目标商品ID" rules={[{ required: true }]}>
                  <Input placeholder="数字商品 ID" />
                </Form.Item>
              )
              return null
            }}
          </Form.Item>
          <Form.Item name="enabled" label="是否启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
