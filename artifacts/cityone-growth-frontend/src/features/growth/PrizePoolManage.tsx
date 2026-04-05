import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, message, Switch, Divider, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, TrophyOutlined, ReloadOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import request from '../../api/request'
import MediaUploadField from '../../components/MediaUploadField'
import { useI18n } from '../../i18n'

export default function PrizePoolManage() {
  const { t } = useI18n()
  const pp = (key: string) => t(`admin.prizePool.${key}`)

  const PRIZE_TYPES = [
    { value: 'coupon', label: pp('typeCoupon') },
    { value: 'points', label: pp('typePoints') },
    { value: 'cash', label: pp('typeCash') },
    { value: 'physical', label: pp('typePhysical') },
    { value: 'empty', label: pp('typeEmpty') },
  ]

  const [searchParams] = useSearchParams()
  const activityId = searchParams.get('activityId')
  const [prizes, setPrizes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [formVisible, setFormVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [editingId, setEditingId] = useState<any>(null)
  const [form] = Form.useForm()
  const [coverImage, setCoverImage] = useState('')

  const fetchPrizes = async () => {
    if (!activityId) { setPrizes([]); return }
    setLoading(true)
    try {
      const res: any = await request.get(`/api/activities/${activityId}/prizes`)
      setPrizes(res.data || [])
    } catch { setPrizes([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPrizes() }, [activityId])

  const handleAdd = () => { setIsEdit(false); setEditingId(null); form.resetFields(); setCoverImage(''); setFormVisible(true) }
  const handleEdit = (r: any) => { setIsEdit(true); setEditingId(r.id); form.setFieldsValue(r); setCoverImage(r.coverImage || ''); setFormVisible(true) }

  const handleDelete = (r: any) => {
    Modal.confirm({
      title: pp('confirmDelete'),
      onOk: async () => {
        try {
          await request.delete(`/api/activities/${activityId}/prizes/${r.id}`)
          message.success(pp('deleteSuccess')); fetchPrizes()
        } catch { message.error(pp('deleteFail')) }
      },
    })
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const payload = { ...values, coverImage }
      if (isEdit) {
        await request.put(`/api/activities/${activityId}/prizes/${editingId}`, payload)
        message.success(pp('updateSuccess'))
      } else {
        await request.post(`/api/activities/${activityId}/prizes`, payload)
        message.success(pp('addSuccess'))
      }
      setFormVisible(false); fetchPrizes()
    } catch {}
  }

  const totalProb = prizes.reduce((s, p) => s + (p.probability || 0), 0)

  const columns = [
    { title: pp('colName'), dataIndex: 'name', key: 'name', width: 160 },
    { title: pp('colPrizeType'), dataIndex: 'prizeType', key: 'prizeType', width: 100, render: (v: string) => PRIZE_TYPES.find(x => x.value === v)?.label || v },
    { title: pp('colPrizeValue'), dataIndex: 'prizeValue', key: 'prizeValue', width: 120, render: (v: any, r: any) => r.prizeType === 'empty' ? '—' : v },
    { title: pp('colProbability'), dataIndex: 'probability', key: 'probability', width: 120, render: (v: number) => <span style={{ color: '#1677ff', fontWeight: 500 }}>{v}%</span> },
    { title: pp('colStock'), dataIndex: 'stock', key: 'stock', width: 100, render: (v: any) => v === -1 ? pp('unlimited') : v },
    { title: pp('colEnabled'), dataIndex: 'enabled', key: 'enabled', width: 80, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? pp('statusOn') : pp('statusOff')}</Tag> },
    {
      title: pp('colAction'), key: 'action', width: 120,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>{pp('btnEdit')}</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)}>{pp('btnDelete')}</Button>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title={<Space><TrophyOutlined />{pp('pageTitle')}{activityId ? ` — #${activityId}` : ` (${pp('noActivity')})`}</Space>}
      extra={
        <Space>
          <Tooltip title={`${pp('probTotal')}：${totalProb.toFixed(1)}%`}>
            <Tag color={Math.abs(totalProb - 100) < 0.1 ? 'green' : 'orange'}>{pp('probTotal')} {totalProb.toFixed(1)}%</Tag>
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={fetchPrizes}>{pp('btnRefresh')}</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={!activityId}>{pp('btnAdd')}</Button>
        </Space>
      }
    >
      <Table columns={columns} dataSource={prizes} rowKey="id" loading={loading} pagination={false} size="small"
        locale={{ emptyText: activityId ? pp('emptyPrizes') : pp('noActivity') }}
      />
      <Modal title={isEdit ? pp('modalEdit') : pp('modalAdd')} open={formVisible} onOk={handleOk} onCancel={() => setFormVisible(false)} width={560} destroyOnHidden>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={pp('formName')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="prizeType" label={pp('formPrizeType')} rules={[{ required: true }]}>
            <Select options={PRIZE_TYPES} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.prizeType !== c.prizeType}>
            {({ getFieldValue }) => getFieldValue('prizeType') !== 'empty' && (
              <Form.Item name="prizeValue" label={pp('formPrizeValue')} rules={[{ required: true }]}><Input /></Form.Item>
            )}
          </Form.Item>
          <Form.Item name="probability" label={pp('formProbability')} rules={[{ required: true }]}>
            <InputNumber min={0} max={100} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stock" label={pp('formStock')}>
            <InputNumber min={-1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sortOrder" label={pp('formSortOrder')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13 }}>{pp('dividerMedia')}</Divider>
          <Form.Item label={pp('formCoverImage')}>
            <MediaUploadField type="image" value={coverImage} onChange={setCoverImage} placeholder={pp('formCoverImageHint')} />
          </Form.Item>
          <Form.Item name="enabled" label={pp('formEnabled')} valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
