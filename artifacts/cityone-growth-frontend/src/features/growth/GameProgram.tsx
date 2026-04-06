import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Typography } from 'antd'
import { EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import request from '../../api/request'
import { useI18n } from '../../i18n'

const { Title, Text } = Typography

const GAME_TYPES = [
  {
    type: 'lucky_wheel',
    icon: '🎡',
    color: '#fa8c16',
    bg: 'linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%)',
    border: '#ffd591',
  },
  {
    type: 'scratch_card',
    icon: '🎴',
    color: '#1677ff',
    bg: 'linear-gradient(135deg, #e6f4ff 0%, #bae0ff 100%)',
    border: '#91caff',
  },
  {
    type: 'thai_fortune_draw',
    icon: '🏮',
    color: '#722ed1',
    bg: 'linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%)',
    border: '#d3adf7',
  },
]

export default function GameProgram() {
  const { t } = useI18n()
  const gp = (key: string) => t(`gameProgram.${key}`)

  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [programs, setPrograms] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [formVisible, setFormVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()

  const fetchPrograms = async (type: string) => {
    setLoading(true)
    try {
      const res: any = await request.get('/game-programs', { params: { type } })
      setPrograms((res.data as any[]) || [])
    } catch { setPrograms([]) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (selectedType) fetchPrograms(selectedType)
  }, [selectedType])

  const handleSelectType = (type: string) => {
    setSelectedType(type)
  }

  const handleBack = () => {
    setSelectedType(null)
    setPrograms([])
  }

  const handleAdd = () => {
    setIsEdit(false); setEditingId(null)
    form.resetFields()
    setFormVisible(true)
  }

  const handleEdit = (record: any) => {
    setIsEdit(true); setEditingId(record.id)
    form.setFieldsValue({ name: record.name, description: record.description, status: record.status })
    setFormVisible(true)
  }

  const handleDelete = (record: any) => {
    Modal.confirm({
      title: gp('btnDelete'),
      content: gp('confirmDelete'),
      okType: 'danger',
      onOk: async () => {
        try {
          await request.delete(`/game-programs/${record.id}`)
          message.success(gp('deleteSuccess'))
          if (selectedType) fetchPrograms(selectedType)
        } catch { message.error(gp('deleteFail')) }
      },
    })
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const payload = { ...values, type: selectedType }
      if (isEdit && editingId) {
        await request.put(`/game-programs/${editingId}`, payload)
      } else {
        await request.post('/game-programs', payload)
      }
      message.success(gp('saveSuccess'))
      setFormVisible(false)
      if (selectedType) fetchPrograms(selectedType)
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(gp('saveFail'))
    }
  }

  const selectedMeta = GAME_TYPES.find(g => g.type === selectedType)

  const columns = [
    { title: gp('colNo'), dataIndex: 'id', key: 'id', width: 130, render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
    { title: gp('colName'), dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: gp('colDesc'), dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: gp('colStatus'), dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? gp('statusOn') : gp('statusOff')}</Tag>,
    },
    {
      title: gp('colAction'), key: 'action', width: 120,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>{gp('btnEdit')}</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>{gp('btnDelete')}</Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '16px 20px' }}>
      {!selectedType ? (
        <>
          <div style={{ marginBottom: 20 }}>
            <Title level={4} style={{ margin: 0 }}>{gp('title')}</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>{gp('subtitle')}</Text>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {GAME_TYPES.map(gt => (
              <Card
                key={gt.type}
                hoverable
                onClick={() => handleSelectType(gt.type)}
                style={{
                  background: gt.bg,
                  border: `1.5px solid ${gt.border}`,
                  borderRadius: 16,
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                styles={{ body: { padding: '24px 20px' } }}
              >
                <div style={{ fontSize: 48, marginBottom: 12, textAlign: 'center' }}>{gt.icon}</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: gt.color, marginBottom: 6 }}>
                    {gp(`type${gt.type === 'lucky_wheel' ? 'Wheel' : gt.type === 'scratch_card' ? 'Scratch' : 'Fortune'}`)}
                  </div>
                  <div style={{ fontSize: 13, color: '#667085' }}>
                    {gp(`desc${gt.type === 'lucky_wheel' ? 'Wheel' : gt.type === 'scratch_card' ? 'Scratch' : 'Fortune'}`)}
                  </div>
                </div>
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <Button type="primary" size="small" style={{ background: gt.color, borderColor: gt.color }}>
                    {gp('selectType')} →
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>{gp('backToTypes')}</Button>
            <span style={{ fontSize: 16, fontWeight: 700, color: selectedMeta?.color }}>
              {selectedMeta?.icon}
              {gp(`type${selectedType === 'lucky_wheel' ? 'Wheel' : selectedType === 'scratch_card' ? 'Scratch' : 'Fortune'}`)}
              {gp('programsOf')}
            </span>
          </div>
          <Card>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{gp('btnAdd')}</Button>
            </div>
            <Table
              rowKey="id"
              dataSource={programs}
              columns={columns}
              loading={loading}
              pagination={false}
              locale={{ emptyText: gp('emptyText') }}
              size="middle"
            />
          </Card>

          <Modal
            open={formVisible}
            title={isEdit ? gp('modalEdit') : gp('modalAdd')}
            onOk={handleOk}
            onCancel={() => setFormVisible(false)}
            destroyOnClose
          >
            <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
              <Form.Item name="name" label={gp('formName')} rules={[{ required: true, message: gp('formNameRequired') }]}>
                <Input />
              </Form.Item>
              <Form.Item name="description" label={gp('formDesc')}>
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item name="status" label={gp('colStatus')} initialValue="active">
                <Select options={[
                  { value: 'active', label: gp('statusOn') },
                  { value: 'inactive', label: gp('statusOff') },
                ]} />
              </Form.Item>
            </Form>
          </Modal>
        </>
      )}
    </div>
  )
}
