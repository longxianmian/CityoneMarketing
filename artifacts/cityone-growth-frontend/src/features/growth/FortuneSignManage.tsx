import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Divider, Tabs, Alert } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined, ReloadOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import request from '../../api/request'
import { useI18n } from '../../i18n'

export default function FortuneSignManage() {
  const { t } = useI18n()
  const fs = (key: string) => t(`fortuneSign.${key}`)

  const FORTUNE_TYPES = [
    { value: 'great', label: fs('fortuneGreat'), color: '#f5222d' },
    { value: 'good', label: fs('fortuneGood'), color: '#fa8c16' },
    { value: 'medium', label: fs('fortuneMedium'), color: '#1677ff' },
    { value: 'small', label: fs('fortuneSmall'), color: '#52c41a' },
    { value: 'bad', label: fs('fortuneBad'), color: '#8c8c8c' },
  ]

  const [searchParams] = useSearchParams()
  const activityId = searchParams.get('activityId')
  const [activeTab, setActiveTab] = useState('themes')
  const [themes, setThemes] = useState<any[]>([])
  const [signs, setSigns] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [formVisible, setFormVisible] = useState(false)
  const [formType, setFormType] = useState<'theme' | 'sign'>('theme')
  const [isEdit, setIsEdit] = useState(false)
  const [editingId, setEditingId] = useState<any>(null)
  const [form] = Form.useForm()

  const fetchData = async () => {
    if (!activityId) return
    setLoading(true)
    try {
      const [tRes, sRes]: any = await Promise.all([
        request.get(`/api/activities/${activityId}/fortune-themes`),
        request.get(`/api/activities/${activityId}/signs`),
      ])
      setThemes(tRes.data || [])
      setSigns(sRes.data || [])
    } catch { setThemes([]); setSigns([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [activityId])

  const openAdd = (type: 'theme' | 'sign') => {
    setFormType(type); setIsEdit(false); setEditingId(null)
    form.resetFields(); setFormVisible(true)
  }

  const openEdit = (type: 'theme' | 'sign', r: any) => {
    setFormType(type); setIsEdit(true); setEditingId(r.id)
    form.setFieldsValue(r); setFormVisible(true)
  }

  const handleDelete = (type: 'theme' | 'sign', r: any) => {
    Modal.confirm({
      title: type === 'theme' ? fs('deleteThemeConfirm') : fs('deleteSignConfirm'),
      onOk: async () => {
        const url = type === 'theme'
          ? `/api/activities/${activityId}/fortune-themes/${r.id}`
          : `/api/activities/${activityId}/signs/${r.id}`
        try {
          await request.delete(url)
          message.success(fs('deleteSuccess')); fetchData()
        } catch { message.error(fs('deleteError')) }
      },
    })
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      if (formType === 'theme') {
        if (isEdit) await request.put(`/api/activities/${activityId}/fortune-themes/${editingId}`, values)
        else await request.post(`/api/activities/${activityId}/fortune-themes`, values)
      } else {
        if (isEdit) await request.put(`/api/activities/${activityId}/signs/${editingId}`, values)
        else await request.post(`/api/activities/${activityId}/signs`, values)
      }
      message.success(isEdit ? fs('updateSuccess') : fs('addSuccess'))
      setFormVisible(false); fetchData()
    } catch {}
  }

  const themeColumns = [
    { title: fs('themeColName'), dataIndex: 'name', key: 'name', width: 160 },
    { title: fs('themeColDesc'), dataIndex: 'description', key: 'description' },
    { title: fs('themeColBgColor'), dataIndex: 'bgColor', key: 'bgColor', width: 100,
      render: (v: string) => v ? <span style={{ display: 'inline-block', width: 24, height: 24, background: v, borderRadius: 4, border: '1px solid #f0f0f0' }} /> : '—' },
    { title: fs('themeColStatus'), dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? fs('statusEnabled') : fs('statusDisabled')}</Tag> },
    { title: fs('themeColAction'), key: 'action', width: 120,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit('theme', r)}>{fs('actionEdit')}</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete('theme', r)}>{fs('actionDelete')}</Button>
        </Space>
      ) },
  ]

  const signColumns = [
    { title: fs('signColNo'), dataIndex: 'signNo', key: 'signNo', width: 80 },
    { title: fs('signColName'), dataIndex: 'name', key: 'name', width: 120 },
    { title: fs('signColType'), dataIndex: 'fortuneType', key: 'fortuneType', width: 100,
      render: (v: string) => {
        const ft = FORTUNE_TYPES.find(x => x.value === v)
        return ft ? <Tag color={ft.color}>{ft.label}</Tag> : v
      } },
    { title: fs('signColPoemZh'), dataIndex: 'poem_zh', key: 'poem_zh' },
    { title: fs('signColPoemTh'), dataIndex: 'poem_th', key: 'poem_th' },
    { title: fs('signColAction'), key: 'action', width: 120,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit('sign', r)}>{fs('actionEdit')}</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete('sign', r)}>{fs('actionDelete')}</Button>
        </Space>
      ) },
  ]

  return (
    <Card
      title={<Space><StarOutlined />{fs('pageTitle')}{activityId ? ` — #${activityId}` : ''}</Space>}
      extra={<Button icon={<ReloadOutlined />} onClick={fetchData} disabled={!activityId}>{fs('refreshBtn')}</Button>}
    >
      {!activityId && (
        <Alert
          type="info"
          showIcon
          message={fs('noActivityHint')}
          style={{ marginBottom: 16 }}
        />
      )}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openAdd(activeTab === 'themes' ? 'theme' : 'sign')} disabled={!activityId}>
            {activeTab === 'themes' ? fs('addThemeBtn') : fs('addSignBtn')}
          </Button>
        }
        items={[
          { key: 'themes', label: fs('tabThemes'), children: <Table columns={themeColumns} dataSource={themes} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 10 }} /> },
          { key: 'signs', label: fs('tabSigns'), children: <Table columns={signColumns} dataSource={signs} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 20 }} /> },
        ]}
      />
      <Modal
        title={isEdit ? (formType === 'theme' ? fs('modalEditTheme') : fs('modalEditSign')) : (formType === 'theme' ? fs('modalAddTheme') : fs('modalAddSign'))}
        open={formVisible} onOk={handleOk} onCancel={() => setFormVisible(false)} width={560} destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {formType === 'theme' ? (
            <>
              <Form.Item name="name" label={fs('formThemeName')} rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="description" label={fs('formThemeDesc')}><Input.TextArea rows={2} /></Form.Item>
              <Form.Item name="bgColor" label={fs('formBgColor')}><Input placeholder="#c62828" /></Form.Item>
              <Form.Item name="iconUrl" label={fs('formIconUrl')}><Input /></Form.Item>
              <Form.Item name="enabled" label={fs('formEnabled')} initialValue={true}>
                <Select options={[{ value: true, label: fs('statusEnabled') }, { value: false, label: fs('statusDisabled') }]} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="signNo" label={fs('formSignNo')} rules={[{ required: true }]}><Input placeholder="1" /></Form.Item>
              <Form.Item name="name" label={fs('formSignName')} rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="fortuneType" label={fs('formFortuneType')} rules={[{ required: true }]}>
                <Select options={FORTUNE_TYPES} />
              </Form.Item>
              <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{fs('dividerPoem')}</Divider>
              <Form.Item name="poem_zh" label={fs('formPoemZh')}><Input.TextArea rows={3} /></Form.Item>
              <Form.Item name="poem_th" label={fs('formPoemTh')}><Input.TextArea rows={3} /></Form.Item>
              <Form.Item name="poem_en" label={fs('formPoemEn')}><Input.TextArea rows={3} /></Form.Item>
              <Form.Item name="interpretation_zh" label={fs('formInterpretZh')}><Input.TextArea rows={2} /></Form.Item>
              <Form.Item name="interpretation_th" label={fs('formInterpretTh')}><Input.TextArea rows={2} /></Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </Card>
  )
}
