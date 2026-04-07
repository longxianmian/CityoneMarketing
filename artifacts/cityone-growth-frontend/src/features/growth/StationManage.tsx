import React, { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber,
  Popconfirm, message, Divider, Tooltip, Row, Col,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EnvironmentOutlined,
  LinkOutlined, SyncOutlined,
} from '@ant-design/icons'
import request from '../../api/request'

interface District { code: string; zh: string; th: string; en: string }
interface CityItem { code: string; zh: string; th: string; en: string; districts: District[] }
interface Station {
  id: string
  name: { zh: string; th?: string; en?: string }
  city: string; district: string; address: string
  lat: number; lng: number
  status: string; capacity: number; available: number
  source: string; external_id: string
  createdAt?: string; updatedAt?: string
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '运营中' },
  maintenance: { color: 'orange', label: '维护中' },
  offline: { color: 'red', label: '已下线' },
}

export default function StationManage() {
  const [list, setList] = useState<Station[]>([])
  const [loading, setLoading] = useState(false)
  const [cityDistricts, setCityDistricts] = useState<CityItem[]>([])
  const [filterCity, setFilterCity] = useState<string>('')
  const [filterDistrict, setFilterDistrict] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [formVisible, setFormVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState('')
  const [form] = Form.useForm()

  const selectedCity = Form.useWatch('city', form)

  useEffect(() => {
    request.get('/stations/city-districts').then((res: any) => {
      const data = res?.data || res
      if (Array.isArray(data)) setCityDistricts(data)
    }).catch(() => {})
    loadList()
  }, [])

  const loadList = (city?: string, district?: string, status?: string) => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (city ?? filterCity) params.city = city ?? filterCity
    if (district ?? filterDistrict) params.district = district ?? filterDistrict
    if (status ?? filterStatus) params.status = status ?? filterStatus
    request.get('/stations', { params }).then((res: any) => {
      const data = res?.data || res
      if (data?.list) setList(data.list)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  const cityOptions = cityDistricts.map(c => ({ value: c.code, label: `${c.zh} · ${c.en}` }))
  const districtOptions = (cityDistricts.find(c => c.code === (filterCity || selectedCity))?.districts || [])
    .map(d => ({ value: d.code, label: `${d.zh} · ${d.en}` }))

  const formDistrictOptions = (cityDistricts.find(c => c.code === selectedCity)?.districts || [])
    .map(d => ({ value: d.code, label: `${d.zh} · ${d.en}` }))

  const getCityLabel = (code: string) => cityDistricts.find(c => c.code === code)?.zh || code
  const getDistrictLabel = (city: string, code: string) =>
    cityDistricts.find(c => c.code === city)?.districts.find(d => d.code === code)?.zh || code

  const openCreate = () => {
    setIsEdit(false); setEditId('')
    form.resetFields()
    setFormVisible(true)
  }

  const openEdit = (row: Station) => {
    setIsEdit(true); setEditId(row.id)
    form.setFieldsValue({
      nameZh: row.name.zh, nameTh: row.name.th || '', nameEn: row.name.en || '',
      city: row.city, district: row.district, address: row.address,
      lat: row.lat, lng: row.lng,
      status: row.status, capacity: row.capacity, available: row.available,
      source: row.source, external_id: row.external_id,
    })
    setFormVisible(true)
  }

  const handleDelete = async (id: string) => {
    await request.delete(`/stations/${id}`)
    message.success('已删除')
    loadList()
  }

  const handleSave = async () => {
    try {
      const vals = await form.validateFields()
      setSaving(true)
      const body = {
        name: { zh: vals.nameZh || '', th: vals.nameTh || '', en: vals.nameEn || '' },
        city: vals.city, district: vals.district, address: vals.address || '',
        lat: vals.lat, lng: vals.lng,
        status: vals.status || 'active',
        capacity: vals.capacity || 0, available: vals.available || 0,
        source: vals.source || 'manual', external_id: vals.external_id || '',
      }
      if (isEdit) {
        await request.put(`/stations/${editId}`, body)
        message.success('已更新')
      } else {
        await request.post('/stations', body)
        message.success('已创建')
      }
      setFormVisible(false)
      loadList()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: '站点名称',
      dataIndex: 'name',
      render: (name: Station['name'], row: Station) => (
        <div>
          <div style={{ fontWeight: 700 }}>{name.zh}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{name.en}</div>
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{row.id}</div>
        </div>
      ),
    },
    {
      title: '城市 / 区域',
      render: (_: any, row: Station) => (
        <Space direction="vertical" size={2}>
          <Tag color="blue">{getCityLabel(row.city)}</Tag>
          <Tag>{getDistrictLabel(row.city, row.district)}</Tag>
        </Space>
      ),
    },
    {
      title: '坐标',
      render: (_: any, row: Station) => (
        <div style={{ fontSize: 12, color: '#666' }}>
          <div>纬 {row.lat}</div>
          <div>经 {row.lng}</div>
        </div>
      ),
    },
    {
      title: '容量 / 可用',
      render: (_: any, row: Station) => (
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#2CDBCE' }}>{row.available}</span>
          <span style={{ color: '#999' }}> / {row.capacity}</span>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => {
        const s = STATUS_MAP[status] || { color: 'default', label: status }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '数据来源',
      dataIndex: 'source',
      render: (source: string, row: Station) => (
        <div style={{ fontSize: 12 }}>
          <Tag color={source === 'a_system' ? 'purple' : 'default'}>
            {source === 'a_system' ? 'A系统' : '手动录入'}
          </Tag>
          {row.external_id && (
            <div style={{ color: '#999', marginTop: 2 }}>
              <LinkOutlined /> {row.external_id}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '操作',
      render: (_: any, row: Station) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
          <Popconfirm title="确认删除这个站点？" onConfirm={() => handleDelete(row.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            <EnvironmentOutlined style={{ color: '#2CDBCE', marginRight: 8 }} />
            站点管理
          </h2>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            管理充电宝站点位置与状态 · 未来可对接 A 系统同步站点数据
          </div>
        </div>
        <Space>
          <Tooltip title="预留：将来从 A 系统同步站点数据">
            <Button icon={<SyncOutlined />} disabled>同步 A 系统</Button>
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增站点</Button>
        </Space>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Select
          allowClear placeholder="城市筛选" style={{ width: 160 }}
          options={cityOptions}
          value={filterCity || undefined}
          onChange={v => { setFilterCity(v || ''); setFilterDistrict(''); loadList(v || '', '', filterStatus) }}
        />
        <Select
          allowClear placeholder="区域筛选" style={{ width: 180 }}
          options={districtOptions}
          value={filterDistrict || undefined}
          disabled={!filterCity}
          onChange={v => { setFilterDistrict(v || ''); loadList(filterCity, v || '', filterStatus) }}
        />
        <Select
          allowClear placeholder="状态筛选" style={{ width: 140 }}
          options={[
            { value: 'active', label: '运营中' },
            { value: 'maintenance', label: '维护中' },
            { value: 'offline', label: '已下线' },
          ]}
          value={filterStatus || undefined}
          onChange={v => { setFilterStatus(v || ''); loadList(filterCity, filterDistrict, v || '') }}
        />
        <Button onClick={() => { setFilterCity(''); setFilterDistrict(''); setFilterStatus(''); loadList('', '', '') }}>
          重置
        </Button>
        <div style={{ marginLeft: 'auto', color: '#888', alignSelf: 'center', fontSize: 13 }}>
          共 {list.length} 个站点
        </div>
      </div>

      <Table
        dataSource={list}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        style={{ background: '#fff', borderRadius: 12 }}
      />

      <Modal
        title={isEdit ? '编辑站点' : '新增站点'}
        open={formVisible}
        onOk={handleSave}
        onCancel={() => { if (!saving) setFormVisible(false) }}
        confirmLoading={saving}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>站点名称（多语言）</span></Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="nameZh" label="中文名称" rules={[{ required: true, message: '请填写中文名称' }]}>
                <Input placeholder="例：暹罗广场站点 A" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="nameTh" label="泰文名称">
                <Input placeholder="สยามสแควร์ A" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="nameEn" label="英文名称">
                <Input placeholder="Siam Square A" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>位置信息</span></Divider>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="city" label="城市" rules={[{ required: true, message: '请选择城市' }]}>
                <Select
                  placeholder="选择城市"
                  options={cityOptions}
                  onChange={() => form.setFieldValue('district', undefined)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="district" label="区域" rules={[{ required: true, message: '请选择区域' }]}>
                <Select
                  placeholder="选择区域"
                  options={formDistrictOptions}
                  disabled={!selectedCity}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="详细地址">
            <Input placeholder="例：Siam Square One, Pathum Wan, Bangkok" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="lat" label="纬度 (Latitude)" rules={[{ required: true, message: '请填写纬度' }]}>
                <InputNumber style={{ width: '100%' }} placeholder="例：13.7455" step={0.0001} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="lng" label="经度 (Longitude)" rules={[{ required: true, message: '请填写经度' }]}>
                <InputNumber style={{ width: '100%' }} placeholder="例：100.5341" step={0.0001} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>运营状态</span></Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="status" label="状态" initialValue="active">
                <Select options={[
                  { value: 'active', label: '运营中' },
                  { value: 'maintenance', label: '维护中' },
                  { value: 'offline', label: '已下线' },
                ]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="capacity" label="总容量（槽位数）">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="8" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="available" label="当前可借数量">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="5" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>A 系统对接（预留）</span></Divider>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="source" label="数据来源" initialValue="manual">
                <Select options={[
                  { value: 'manual', label: '手动录入' },
                  { value: 'a_system', label: 'A系统同步' },
                ]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="external_id" label="A系统站点ID（预留）">
                <Input placeholder="待与A系统对接后填写" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
