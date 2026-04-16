import React, { useEffect, useMemo, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber,
  Popconfirm, message, Divider, Tooltip, Row, Col,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EnvironmentOutlined,
  LinkOutlined, SyncOutlined, ApiOutlined,
} from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
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
  // 新增字段
  station_code?: string
  station_type?: string
  venue_name?: string
  venue_type?: string
  entry_code?: string
  landing_code?: string
  default_activity_id?: string
  a_system_station_id?: string
  device_code?: string
  device_group_code?: string
  a_system_device_id?: string
  source_channel_id?: string
  activity_count?: number
  coupon_count?: number
  benefit_count?: number
  has_benefits?: boolean
  primary_benefit_label?: string
  activities?: Array<{ id: string; name: string; status: string; type: string; match_mode: string }>
  coupons?: Array<{ id: string; name: string; status: string; coupon_type: string; benefit_action_type: string }>
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  active:      { color: 'green',  label: '运营中' },
  maintenance: { color: 'orange', label: '维护中' },
  offline:     { color: 'red',    label: '已下线' },
}

export default function StationManage() {
  const location = useLocation()
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
  const isBenefitView = location.pathname === '/admin/growth/station-benefits'
  const benefitSummary = useMemo(() => {
    if (!isBenefitView) return null
    return {
      stationCount: list.length,
      stationWithBenefitsCount: list.filter(item => item.has_benefits).length,
      activityHitCount: list.reduce((sum, item) => sum + Number(item.activity_count || 0), 0),
      couponHitCount: list.reduce((sum, item) => sum + Number(item.coupon_count || 0), 0),
    }
  }, [isBenefitView, list])

  const pageCopy = useMemo(() => (
    isBenefitView
      ? {
          title: '站点福利',
          subtitle: '从站点视角查看福利承接基础信息，便于核对活动挂载、默认活动和展示入口配置。',
        }
      : {
          title: '站点管理',
          subtitle: '管理充电宝站点位置与状态 · 已落 PostgreSQL · A系统旁路预留字段已开放',
        }
  ), [isBenefitView])

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
    request.get(isBenefitView ? '/stations/benefits' : '/stations', { params }).then((res: any) => {
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
      source: row.source,
      // A系统预留字段（a_system_station_id 向后兼容 external_id）
      a_system_station_id: row.a_system_station_id || row.external_id || '',
      device_code:         row.device_code        || '',
      device_group_code:   row.device_group_code  || '',
      a_system_device_id:  row.a_system_device_id || '',
      // 增长主链路绑定
      entry_code:          row.entry_code          || '',
      landing_code:        row.landing_code        || '',
      default_activity_id: row.default_activity_id || '',
      source_channel_id:   row.source_channel_id   || '',
      venue_name:          row.venue_name           || '',
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
        source: vals.source || 'manual',
        // A系统预留字段
        a_system_station_id: vals.a_system_station_id || '',
        device_code:         vals.device_code         || '',
        device_group_code:   vals.device_group_code   || '',
        a_system_device_id:  vals.a_system_device_id  || '',
        // 增长主链路绑定
        entry_code:          vals.entry_code          || '',
        landing_code:        vals.landing_code        || '',
        default_activity_id: vals.default_activity_id || '',
        source_channel_id:   vals.source_channel_id   || '',
        venue_name:          vals.venue_name           || '',
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
      // request.ts 拦截器已自动弹出后端返回的具体错误信息（含 409 A_SYSTEM_FIELD_DUPLICATE 等）
      // 此处无需重复 message.error，避免双重 toast
    } finally {
      setSaving(false)
    }
  }

  const columns: any[] = [
    {
      title: '站点名称',
      dataIndex: 'name',
      render: (name: Station['name'], row: Station) => (
        <div>
          <div style={{ fontWeight: 700 }}>{name.zh}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{name.en}</div>
          <div style={{ fontSize: 11, color: '#2CDBCE', marginTop: 2 }}>
            站点码：{row.station_code || row.id}
          </div>
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
    isBenefitView
      ? {
          title: '命中福利',
          render: (_: any, row: Station) => (
            <div style={{ minWidth: 180 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <Tag color="geekblue" style={{ marginInlineEnd: 0 }}>活动 {row.activity_count || 0}</Tag>
                <Tag color="purple" style={{ marginInlineEnd: 0 }}>卡券 {row.coupon_count || 0}</Tag>
                <Tag color={row.has_benefits ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
                  {row.has_benefits ? '已命中福利' : '暂无命中'}
                </Tag>
              </div>
              <div style={{ fontSize: 12, color: row.primary_benefit_label ? '#555' : '#bbb' }}>
                {row.primary_benefit_label || '当前无活动/卡券承接'}
              </div>
            </div>
          ),
        }
      : {
          title: '容量 / 可用',
          render: (_: any, row: Station) => (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#2CDBCE' }}>{row.available}</span>
              <span style={{ color: '#999' }}> / {row.capacity}</span>
            </div>
          ),
        },
    isBenefitView
      ? {
          title: '活动命中预览',
          render: (_: any, row: Station) => {
            const activities = row.activities || []
            if (!activities.length) return <span style={{ color: '#bbb' }}>无活动命中</span>
            return (
              <div style={{ display: 'grid', gap: 6 }}>
                {activities.slice(0, 3).map((activity) => (
                  <div key={activity.id} style={{ fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: '#334155' }}>{activity.name}</div>
                    <Space size={4} wrap>
                      <Tag color={activity.match_mode === 'default_activity' ? 'gold' : 'blue'} style={{ marginInlineEnd: 0 }}>
                        {activity.match_mode === 'default_activity' ? '默认活动' : '范围命中'}
                      </Tag>
                      <Tag style={{ marginInlineEnd: 0 }}>{activity.status || 'unknown'}</Tag>
                    </Space>
                  </div>
                ))}
                {activities.length > 3 && <span style={{ fontSize: 12, color: '#999' }}>另有 {activities.length - 3} 个活动命中</span>}
              </div>
            )
          },
        }
      : {
          title: '状态',
          dataIndex: 'status',
          render: (status: string) => {
            const s = STATUS_MAP[status] || { color: 'default', label: status }
            return <Tag color={s.color}>{s.label}</Tag>
          },
        },
    isBenefitView && {
      title: '卡券命中预览',
      render: (_: any, row: Station) => {
        const coupons = row.coupons || []
        if (!coupons.length) return <span style={{ color: '#bbb' }}>无卡券命中</span>
        return (
          <div style={{ display: 'grid', gap: 6 }}>
            {coupons.slice(0, 3).map((coupon) => (
              <div key={coupon.id} style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: '#334155' }}>{coupon.name}</div>
                <Space size={4} wrap>
                  <Tag color="purple" style={{ marginInlineEnd: 0 }}>{coupon.coupon_type || 'coupon'}</Tag>
                  <Tag style={{ marginInlineEnd: 0 }}>{coupon.benefit_action_type || 'benefit_detail'}</Tag>
                </Space>
              </div>
            ))}
            {coupons.length > 3 && <span style={{ fontSize: 12, color: '#999' }}>另有 {coupons.length - 3} 张卡券命中</span>}
          </div>
        )
      },
    },
    {
      title: '增长链路绑定',
      render: (_: any, row: Station) => (
        <div style={{ fontSize: 12 }}>
          {row.entry_code && <div><Tag color="cyan" style={{ fontSize: 11 }}>入口 {row.entry_code}</Tag></div>}
          {row.landing_code && <div><Tag color="geekblue" style={{ fontSize: 11 }}>落地页 {row.landing_code}</Tag></div>}
          {row.default_activity_id && <div><Tag color="purple" style={{ fontSize: 11 }}>活动 {row.default_activity_id}</Tag></div>}
          {!row.entry_code && !row.landing_code && !row.default_activity_id &&
            <span style={{ color: '#d9d9d9' }}>-</span>}
        </div>
      ),
    },
    {
      title: 'A系统预留',
      render: (_: any, row: Station) => (
        <div style={{ fontSize: 12 }}>
          <Tag color={row.source === 'a_system' ? 'purple' : 'default'}>
            {row.source === 'a_system' ? 'A系统' : '手动'}
          </Tag>
          {(row.a_system_station_id || row.external_id) && (
            <div style={{ color: '#999', marginTop: 2 }}>
              <ApiOutlined /> {row.a_system_station_id || row.external_id}
            </div>
          )}
          {row.device_code && (
            <div style={{ color: '#aaa', fontSize: 11 }}>设备: {row.device_code}</div>
          )}
        </div>
      ),
    },
  ].filter(Boolean) as any[]

  if (!isBenefitView) {
    columns.push({
      title: '操作',
      render: (_: any, row: Station) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
          <Popconfirm title="确认删除这个站点？" onConfirm={() => handleDelete(row.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    })
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            <EnvironmentOutlined style={{ color: '#2CDBCE', marginRight: 8 }} />
            {pageCopy.title}
          </h2>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            {pageCopy.subtitle}
          </div>
        </div>
        {!isBenefitView && (
          <Space>
            <Tooltip title="预留：将来从 A 系统同步站点数据">
              <Button icon={<SyncOutlined />} disabled>同步 A 系统</Button>
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增站点</Button>
          </Space>
        )}
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

      {isBenefitView && benefitSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>站点总数</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>{benefitSummary.stationCount}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>有福利站点</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#16a34a' }}>{benefitSummary.stationWithBenefitsCount}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>活动命中总数</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#2563eb' }}>{benefitSummary.activityHitCount}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>卡券命中总数</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#7c3aed' }}>{benefitSummary.couponHitCount}</div>
          </div>
        </div>
      )}

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
        width={760}
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
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item name="address" label="详细地址">
                <Input placeholder="例：Siam Square One, Pathum Wan, Bangkok" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="venue_name" label="场地名称（商场/楼宇）">
                <Input placeholder="例：Siam Paragon" />
              </Form.Item>
            </Col>
          </Row>
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
                  { value: 'active',      label: '运营中' },
                  { value: 'maintenance', label: '维护中' },
                  { value: 'offline',     label: '已下线' },
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

          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>增长主链路绑定（软引用）</span></Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="entry_code" label="绑定入口 (entry_code)">
                <Input placeholder="例：entry_001" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="landing_code" label="默认落地页 (landing_code)">
                <Input placeholder="例：lt_001" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="default_activity_id" label="默认活动 (activity_id)">
                <Input placeholder="例：act_001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="source_channel_id" label="来源渠道">
                <Input placeholder="例：wechat / line / tiktok" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>A 系统旁路连接预留</span></Divider>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="source" label="数据来源" initialValue="manual">
                <Select options={[
                  { value: 'manual',   label: '手动录入' },
                  { value: 'a_system', label: 'A系统同步' },
                ]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="a_system_station_id" label="A系统站点ID (a_system_station_id)">
                <Input placeholder="待与A系统对接后填写" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="device_code" label="设备编码 (device_code)">
                <Input placeholder="例：DEV_BKK_001" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="device_group_code" label="设备组编码 (device_group_code)">
                <Input placeholder="例：GRP_BKK_SIAM" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="a_system_device_id" label="A系统设备ID (a_system_device_id)">
                <Input placeholder="待与A系统对接后填写" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
