import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Divider, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, FileTextOutlined } from '@ant-design/icons'
import request from '../../api/request'
import MediaUploadField from '../../components/MediaUploadField'
import MultiLangInput, { AutoTranslateButton } from '../../components/MultiLangInput'

const BUTTON_TYPES = [
  { value: 'join', label: '立即参与' },
  { value: 'wheel', label: '点击抽奖（转盘）' },
  { value: 'scratch', label: '立即刮卡' },
  { value: 'fortune', label: '求签祈福' },
  { value: 'follow', label: '关注领取' },
  { value: 'redeem', label: '立即兑换' },
]

function toMultiLang(v: any): { zh: string; th: string; en: string } {
  if (v && typeof v === 'object' && ('zh' in v || 'th' in v || 'en' in v)) return { zh: v.zh || '', th: v.th || '', en: v.en || '' }
  return { zh: typeof v === 'string' ? v : '', th: '', en: '' }
}

const MULTI_LANG_FIELDS = ['title', 'subTitle', 'description', 'highlights', 'participationGuide', 'rewardGuide', 'noticeText', 'buttonText']

export default function ActivityTemplateManage() {
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
      title: '确认删除该活动详情模板？',
      onOk: async () => {
        try {
          await request.delete(`/api/activity-templates/${r.id}`)
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

      const payload = { ...values, coverImage, coverVideo }
      if (isEdit) {
        await request.put(`/api/activity-templates/${editingId}`, payload)
        message.success('更新成功')
      } else {
        await request.post('/api/activity-templates', payload)
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
    { title: '活动标题', dataIndex: 'title', key: 'title', width: 200, render: displayTitle },
    { title: '底部按钮', dataIndex: 'buttonType', key: 'buttonType', width: 140,
      render: (v: string) => BUTTON_TYPES.find(b => b.value === v)?.label || v },
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
      title={<Space><FileTextOutlined />活动详情模板管理</Space>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建模板</Button>
        </Space>
      }
    >
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="small"
        pagination={{ current: page, pageSize, total, showTotal: t => `共 ${t} 条`, onChange: p => { setPage(p); fetchData(p) } }}
      />

      <Modal
        title={isEdit ? '编辑活动详情模板' : '新建活动详情模板'}
        open={formVisible} onOk={handleOk} onCancel={() => setFormVisible(false)}
        width={720} destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="内部管理用名称" />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>顶部主信息区</Divider>
          <AutoTranslateButton
            sourceLang="zh"
            getTexts={handleAutoTranslate}
            onResult={applyTranslation}
          />
          <Form.Item name="title" label="活动标题（三语）" rules={[{ required: true, message: '请填写中文标题' }]}>
            <MultiLangInput placeholder="活动标题" />
          </Form.Item>
          <Form.Item name="subTitle" label="活动副标题（三语）">
            <MultiLangInput placeholder="活动副标题" />
          </Form.Item>
          <Form.Item label="封面图">
            <MediaUploadField type="image" value={coverImage} onChange={setCoverImage} placeholder="上传活动封面图" />
          </Form.Item>
          <Form.Item label="宣传视频">
            <MediaUploadField type="video" value={coverVideo} onChange={setCoverVideo} placeholder="上传宣传视频（可选）" />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>简介区</Divider>
          <Form.Item name="description" label="活动说明（三语）">
            <MultiLangInput textarea rows={3} />
          </Form.Item>
          <Form.Item name="highlights" label="活动亮点（三语）">
            <MultiLangInput textarea rows={2} placeholder="用换行分隔多个亮点" />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>步骤区</Divider>
          <Form.Item name="participationGuide" label="参与说明（三语）">
            <MultiLangInput textarea rows={3} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>奖励预告区</Divider>
          <Form.Item name="rewardGuide" label="奖励说明（三语）">
            <MultiLangInput textarea rows={2} />
          </Form.Item>
          <Form.Item name="linkedProductIds" label="关联数字商品ID（逗号分隔）">
            <Input placeholder="如：1,2,3" />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>注意事项 / 底部</Divider>
          <Form.Item name="noticeText" label="注意事项（三语）">
            <MultiLangInput textarea rows={2} />
          </Form.Item>
          <Form.Item name="buttonType" label="底部按钮类型" rules={[{ required: true }]}>
            <Select options={BUTTON_TYPES} />
          </Form.Item>
          <Form.Item name="buttonText" label="按钮自定义文案（三语，覆盖默认）">
            <MultiLangInput placeholder="留空使用按钮类型默认文案" />
          </Form.Item>
          <Form.Item name="enabled" label="是否启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
