import React, { useEffect, useMemo, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber,
  Popconfirm, message, Divider, Tooltip, Row, Col,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EnvironmentOutlined,
  SyncOutlined, ApiOutlined,
} from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import request from '../../api/request'
import { useI18n } from '../../i18n'

interface District { code: string; zh: string; th: string; en: string }
interface CityItem { code: string; zh: string; th: string; en: string; districts: District[] }
interface Station {
  id: string
  name: { zh: string; th?: string; en?: string }
  city: string
  district: string
  address: string
  lat: number
  lng: number
  status: string
  capacity: number
  available: number
  source: string
  external_id: string
  createdAt?: string
  updatedAt?: string
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

type LocalCopy = {
  titleBenefits: string
  subtitleBenefits: string
  titleManage: string
  subtitleManage: string
  stationCount: string
  stationWithBenefitsCount: string
  activityHitCount: string
  couponHitCount: string
  deleted: string
  updated: string
  created: string
  colStationName: string
  colCityDistrict: string
  colCoord: string
  colCapacity: string
  colStatus: string
  colBenefits: string
  colActivityPreview: string
  colCouponPreview: string
  colGrowthBinding: string
  colASystem: string
  colAction: string
  stationCode: string
  lat: string
  lng: string
  activityCount: string
  couponCount: string
  benefitsMatched: string
  noBenefitsMatched: string
  noBenefitHint: string
  noActivityMatched: string
  noCouponMatched: string
  defaultActivity: string
  scopeMatched: string
  moreActivities: string
  moreCoupons: string
  entryTag: string
  landingTag: string
  activityTag: string
  sourceASystem: string
  sourceManual: string
  devicePrefix: string
  edit: string
  delete: string
  deleteConfirm: string
  syncReserved: string
  syncASystem: string
  addStation: string
  cityFilter: string
  districtFilter: string
  statusFilter: string
  reset: string
  totalStations: string
  modalEdit: string
  modalCreate: string
  sectionName: string
  sectionLocation: string
  sectionOps: string
  sectionGrowth: string
  sectionASystem: string
  nameZh: string
  nameTh: string
  nameEn: string
  nameZhRequired: string
  city: string
  cityRequired: string
  district: string
  districtRequired: string
  selectCity: string
  selectDistrict: string
  address: string
  addressPlaceholder: string
  venueName: string
  venuePlaceholder: string
  latitude: string
  latitudeRequired: string
  longitude: string
  longitudeRequired: string
  status: string
  capacity: string
  available: string
  statusActive: string
  statusMaint: string
  statusOffline: string
  entryCode: string
  landingCode: string
  defaultActivityId: string
  sourceChannelId: string
  sourceChannelPlaceholder: string
  aSystemStationId: string
  deviceCode: string
  deviceGroupCode: string
  aSystemDeviceId: string
  sourceType: string
  sourceTypeManual: string
  sourceTypeASystem: string
}

const COPY: Record<'zh' | 'th' | 'en', LocalCopy> = {
  zh: {
    titleBenefits: '站点福利',
    subtitleBenefits: '从站点视角查看福利承接基础信息，便于核对活动挂载、默认活动和展示入口配置。',
    titleManage: '站点管理',
    subtitleManage: '管理充电宝站点位置与状态，当前已接入 PostgreSQL，并预留 A 系统旁路字段。',
    stationCount: '站点总数',
    stationWithBenefitsCount: '有福利站点',
    activityHitCount: '活动命中总数',
    couponHitCount: '卡券命中总数',
    deleted: '已删除',
    updated: '已更新',
    created: '已创建',
    colStationName: '站点名称',
    colCityDistrict: '城市 / 区域',
    colCoord: '坐标',
    colCapacity: '容量 / 可用',
    colStatus: '状态',
    colBenefits: '命中福利',
    colActivityPreview: '活动命中预览',
    colCouponPreview: '卡券命中预览',
    colGrowthBinding: '增长链路绑定',
    colASystem: 'A系统预留',
    colAction: '操作',
    stationCode: '站点码',
    lat: '纬',
    lng: '经',
    activityCount: '活动',
    couponCount: '卡券',
    benefitsMatched: '已命中福利',
    noBenefitsMatched: '暂无命中',
    noBenefitHint: '当前无活动/卡券承接',
    noActivityMatched: '无活动命中',
    noCouponMatched: '无卡券命中',
    defaultActivity: '默认活动',
    scopeMatched: '范围命中',
    moreActivities: '另有 {count} 个活动命中',
    moreCoupons: '另有 {count} 张卡券命中',
    entryTag: '入口',
    landingTag: '落地页',
    activityTag: '活动',
    sourceASystem: 'A系统',
    sourceManual: '手动',
    devicePrefix: '设备',
    edit: '编辑',
    delete: '删除',
    deleteConfirm: '确认删除这个站点？',
    syncReserved: '预留：将来从 A 系统同步站点数据',
    syncASystem: '同步 A 系统',
    addStation: '新增站点',
    cityFilter: '城市筛选',
    districtFilter: '区域筛选',
    statusFilter: '状态筛选',
    reset: '重置',
    totalStations: '共 {count} 个站点',
    modalEdit: '编辑站点',
    modalCreate: '新增站点',
    sectionName: '站点名称（多语言）',
    sectionLocation: '位置信息',
    sectionOps: '运营状态',
    sectionGrowth: '增长主链路绑定（软引用）',
    sectionASystem: 'A系统关联（可选）',
    nameZh: '中文名称',
    nameTh: '泰文名称',
    nameEn: '英文名称',
    nameZhRequired: '请填写中文名称',
    city: '城市',
    cityRequired: '请选择城市',
    district: '区域',
    districtRequired: '请选择区域',
    selectCity: '选择城市',
    selectDistrict: '选择区域',
    address: '详细地址',
    addressPlaceholder: '例：Siam Square One, Pathum Wan, Bangkok',
    venueName: '场地名称（商场/楼宇）',
    venuePlaceholder: '例：Siam Paragon',
    latitude: '纬度 (Latitude)',
    latitudeRequired: '请填写纬度',
    longitude: '经度 (Longitude)',
    longitudeRequired: '请填写经度',
    status: '状态',
    capacity: '总容量（槽位数）',
    available: '当前可借数量',
    statusActive: '运营中',
    statusMaint: '维护中',
    statusOffline: '已下线',
    entryCode: '绑定入口 (entry_code)',
    landingCode: '默认落地页 (landing_code)',
    defaultActivityId: '默认活动 (activity_id)',
    sourceChannelId: '来源渠道',
    sourceChannelPlaceholder: '例：wechat / line / tiktok',
    aSystemStationId: 'A系统站点ID',
    deviceCode: '设备编码',
    deviceGroupCode: '设备组编码',
    aSystemDeviceId: 'A系统设备ID',
    sourceType: '数据来源',
    sourceTypeManual: '手动创建',
    sourceTypeASystem: 'A系统同步',
  },
  th: {
    titleBenefits: 'สวัสดิการสถานี',
    subtitleBenefits: 'ดูผลการรับสวัสดิการจากมุมมองสถานี เพื่อตรวจสอบการผูกกิจกรรม กิจกรรมเริ่มต้น และการตั้งค่าหน้าแสดงผล',
    titleManage: 'จัดการสถานี',
    subtitleManage: 'จัดการตำแหน่งและสถานะของสถานีแชร์พาวเวอร์แบงก์ ปัจจุบันใช้ PostgreSQL และเปิดช่องไว้สำหรับการเชื่อม A System',
    stationCount: 'จำนวนสถานีทั้งหมด',
    stationWithBenefitsCount: 'สถานีที่มีสวัสดิการ',
    activityHitCount: 'จำนวนกิจกรรมที่จับคู่ทั้งหมด',
    couponHitCount: 'จำนวนคูปองที่จับคู่ทั้งหมด',
    deleted: 'ลบแล้ว',
    updated: 'อัปเดตแล้ว',
    created: 'สร้างแล้ว',
    colStationName: 'ชื่อสถานี',
    colCityDistrict: 'เมือง / พื้นที่',
    colCoord: 'พิกัด',
    colCapacity: 'ความจุ / พร้อมให้ยืม',
    colStatus: 'สถานะ',
    colBenefits: 'สวัสดิการที่จับคู่',
    colActivityPreview: 'ตัวอย่างกิจกรรมที่จับคู่',
    colCouponPreview: 'ตัวอย่างคูปองที่จับคู่',
    colGrowthBinding: 'การผูกเส้นทางเติบโต',
    colASystem: 'ช่องสำรอง A System',
    colAction: 'การดำเนินการ',
    stationCode: 'รหัสสถานี',
    lat: 'ละติจูด',
    lng: 'ลองจิจูด',
    activityCount: 'กิจกรรม',
    couponCount: 'คูปอง',
    benefitsMatched: 'จับคู่สวัสดิการแล้ว',
    noBenefitsMatched: 'ยังไม่จับคู่',
    noBenefitHint: 'ขณะนี้ยังไม่มีกิจกรรม/คูปองรับต่อที่สถานีนี้',
    noActivityMatched: 'ไม่มีกิจกรรมที่จับคู่',
    noCouponMatched: 'ไม่มีคูปองที่จับคู่',
    defaultActivity: 'กิจกรรมเริ่มต้น',
    scopeMatched: 'จับคู่ตามขอบเขต',
    moreActivities: 'มีกิจกรรมที่จับคู่อีก {count} รายการ',
    moreCoupons: 'มีคูปองที่จับคู่อีก {count} ใบ',
    entryTag: 'ทางเข้า',
    landingTag: 'หน้า Landing',
    activityTag: 'กิจกรรม',
    sourceASystem: 'A System',
    sourceManual: 'สร้างเอง',
    devicePrefix: 'อุปกรณ์',
    edit: 'แก้ไข',
    delete: 'ลบ',
    deleteConfirm: 'ยืนยันการลบสถานีนี้?',
    syncReserved: 'สำรองไว้: ในอนาคตจะซิงก์ข้อมูลสถานีจาก A System',
    syncASystem: 'ซิงก์ A System',
    addStation: 'เพิ่มสถานี',
    cityFilter: 'กรองตามเมือง',
    districtFilter: 'กรองตามพื้นที่',
    statusFilter: 'กรองตามสถานะ',
    reset: 'รีเซ็ต',
    totalStations: 'ทั้งหมด {count} สถานี',
    modalEdit: 'แก้ไขสถานี',
    modalCreate: 'เพิ่มสถานี',
    sectionName: 'ชื่อสถานี (หลายภาษา)',
    sectionLocation: 'ข้อมูลตำแหน่ง',
    sectionOps: 'สถานะการดำเนินงาน',
    sectionGrowth: 'การผูกเส้นทางเติบโต (soft reference)',
    sectionASystem: 'เชื่อมกับ A System (ไม่บังคับ)',
    nameZh: 'ชื่อภาษาจีน',
    nameTh: 'ชื่อภาษาไทย',
    nameEn: 'ชื่อภาษาอังกฤษ',
    nameZhRequired: 'กรุณากรอกชื่อภาษาจีน',
    city: 'เมือง',
    cityRequired: 'กรุณาเลือกเมือง',
    district: 'พื้นที่',
    districtRequired: 'กรุณาเลือกพื้นที่',
    selectCity: 'เลือกเมือง',
    selectDistrict: 'เลือกพื้นที่',
    address: 'ที่อยู่โดยละเอียด',
    addressPlaceholder: 'เช่น Siam Square One, Pathum Wan, Bangkok',
    venueName: 'ชื่อสถานที่ (ห้าง/อาคาร)',
    venuePlaceholder: 'เช่น Siam Paragon',
    latitude: 'ละติจูด (Latitude)',
    latitudeRequired: 'กรุณากรอกละติจูด',
    longitude: 'ลองจิจูด (Longitude)',
    longitudeRequired: 'กรุณากรอกลองจิจูด',
    status: 'สถานะ',
    capacity: 'ความจุทั้งหมด',
    available: 'จำนวนที่ยืมได้ตอนนี้',
    statusActive: 'เปิดให้บริการ',
    statusMaint: 'อยู่ระหว่างบำรุงรักษา',
    statusOffline: 'ออฟไลน์',
    entryCode: 'ทางเข้าที่ผูกไว้ (entry_code)',
    landingCode: 'หน้า Landing เริ่มต้น (landing_code)',
    defaultActivityId: 'กิจกรรมเริ่มต้น (activity_id)',
    sourceChannelId: 'ช่องทางที่มา',
    sourceChannelPlaceholder: 'เช่น wechat / line / tiktok',
    aSystemStationId: 'A System Station ID',
    deviceCode: 'รหัสอุปกรณ์',
    deviceGroupCode: 'รหัสกลุ่มอุปกรณ์',
    aSystemDeviceId: 'A System Device ID',
    sourceType: 'แหล่งข้อมูล',
    sourceTypeManual: 'สร้างเอง',
    sourceTypeASystem: 'ซิงก์จาก A System',
  },
  en: {
    titleBenefits: 'Station Benefits',
    subtitleBenefits: 'Review benefit delivery from the station perspective to verify activity bindings, default activities, and presentation entry settings.',
    titleManage: 'Station Management',
    subtitleManage: 'Manage power bank station locations and statuses. PostgreSQL is live and A-system bridge fields are reserved.',
    stationCount: 'Total Stations',
    stationWithBenefitsCount: 'Stations With Benefits',
    activityHitCount: 'Total Activity Hits',
    couponHitCount: 'Total Coupon Hits',
    deleted: 'Deleted',
    updated: 'Updated',
    created: 'Created',
    colStationName: 'Station Name',
    colCityDistrict: 'City / District',
    colCoord: 'Coordinates',
    colCapacity: 'Capacity / Available',
    colStatus: 'Status',
    colBenefits: 'Matched Benefits',
    colActivityPreview: 'Activity Match Preview',
    colCouponPreview: 'Coupon Match Preview',
    colGrowthBinding: 'Growth Flow Binding',
    colASystem: 'A System Reserved',
    colAction: 'Action',
    stationCode: 'Station Code',
    lat: 'Lat',
    lng: 'Lng',
    activityCount: 'Activities',
    couponCount: 'Coupons',
    benefitsMatched: 'Benefits Matched',
    noBenefitsMatched: 'No Matches',
    noBenefitHint: 'No activities or coupons are currently routed to this station.',
    noActivityMatched: 'No matched activities',
    noCouponMatched: 'No matched coupons',
    defaultActivity: 'Default Activity',
    scopeMatched: 'Scope Match',
    moreActivities: '{count} more matched activities',
    moreCoupons: '{count} more matched coupons',
    entryTag: 'Entry',
    landingTag: 'Landing',
    activityTag: 'Activity',
    sourceASystem: 'A System',
    sourceManual: 'Manual',
    devicePrefix: 'Device',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirm: 'Delete this station?',
    syncReserved: 'Reserved: station sync from A System will be added later',
    syncASystem: 'Sync A System',
    addStation: 'Add Station',
    cityFilter: 'Filter by City',
    districtFilter: 'Filter by District',
    statusFilter: 'Filter by Status',
    reset: 'Reset',
    totalStations: '{count} stations',
    modalEdit: 'Edit Station',
    modalCreate: 'Add Station',
    sectionName: 'Station Name (Multilingual)',
    sectionLocation: 'Location',
    sectionOps: 'Operational Status',
    sectionGrowth: 'Growth Flow Binding (Soft Reference)',
    sectionASystem: 'A System Mapping (Optional)',
    nameZh: 'Chinese Name',
    nameTh: 'Thai Name',
    nameEn: 'English Name',
    nameZhRequired: 'Please enter the Chinese name',
    city: 'City',
    cityRequired: 'Please select a city',
    district: 'District',
    districtRequired: 'Please select a district',
    selectCity: 'Select city',
    selectDistrict: 'Select district',
    address: 'Address',
    addressPlaceholder: 'Example: Siam Square One, Pathum Wan, Bangkok',
    venueName: 'Venue Name (Mall / Building)',
    venuePlaceholder: 'Example: Siam Paragon',
    latitude: 'Latitude',
    latitudeRequired: 'Please enter latitude',
    longitude: 'Longitude',
    longitudeRequired: 'Please enter longitude',
    status: 'Status',
    capacity: 'Capacity',
    available: 'Available Units',
    statusActive: 'Active',
    statusMaint: 'Maintenance',
    statusOffline: 'Offline',
    entryCode: 'Bound Entry (entry_code)',
    landingCode: 'Default Landing (landing_code)',
    defaultActivityId: 'Default Activity (activity_id)',
    sourceChannelId: 'Source Channel',
    sourceChannelPlaceholder: 'Example: wechat / line / tiktok',
    aSystemStationId: 'A System Station ID',
    deviceCode: 'Device Code',
    deviceGroupCode: 'Device Group Code',
    aSystemDeviceId: 'A System Device ID',
    sourceType: 'Data Source',
    sourceTypeManual: 'Manual',
    sourceTypeASystem: 'Synced from A System',
  },
}

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  maintenance: 'orange',
  offline: 'red',
}

export default function StationManage() {
  const location = useLocation()
  const { language } = useI18n()
  const copy = COPY[language] || COPY.en
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

  const pickLocaleText = (value?: { zh?: string; th?: string; en?: string } | null) =>
    value?.[language] || value?.en || value?.th || value?.zh || ''

  const statusMap = useMemo<Record<string, { color: string; label: string }>>(() => ({
    active: { color: STATUS_COLORS.active, label: copy.statusActive },
    maintenance: { color: STATUS_COLORS.maintenance, label: copy.statusMaint },
    offline: { color: STATUS_COLORS.offline, label: copy.statusOffline },
  }), [copy])

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
      ? { title: copy.titleBenefits, subtitle: copy.subtitleBenefits }
      : { title: copy.titleManage, subtitle: copy.subtitleManage }
  ), [copy, isBenefitView])

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

  const cityOptions = cityDistricts.map(c => ({ value: c.code, label: pickLocaleText(c) || `${c.zh} · ${c.en}` }))
  const districtOptions = (cityDistricts.find(c => c.code === (filterCity || selectedCity))?.districts || [])
    .map(d => ({ value: d.code, label: pickLocaleText(d) || `${d.zh} · ${d.en}` }))
  const formDistrictOptions = (cityDistricts.find(c => c.code === selectedCity)?.districts || [])
    .map(d => ({ value: d.code, label: pickLocaleText(d) || `${d.zh} · ${d.en}` }))

  const getCityLabel = (code: string) => pickLocaleText(cityDistricts.find(c => c.code === code)) || code
  const getDistrictLabel = (city: string, code: string) =>
    pickLocaleText(cityDistricts.find(c => c.code === city)?.districts.find(d => d.code === code)) || code

  const openCreate = () => {
    setIsEdit(false)
    setEditId('')
    form.resetFields()
    setFormVisible(true)
  }

  const openEdit = (row: Station) => {
    setIsEdit(true)
    setEditId(row.id)
    form.setFieldsValue({
      nameZh: row.name.zh,
      nameTh: row.name.th || '',
      nameEn: row.name.en || '',
      city: row.city,
      district: row.district,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      status: row.status,
      capacity: row.capacity,
      available: row.available,
      source: row.source,
      a_system_station_id: row.a_system_station_id || row.external_id || '',
      device_code: row.device_code || '',
      device_group_code: row.device_group_code || '',
      a_system_device_id: row.a_system_device_id || '',
      entry_code: row.entry_code || '',
      landing_code: row.landing_code || '',
      default_activity_id: row.default_activity_id || '',
      source_channel_id: row.source_channel_id || '',
      venue_name: row.venue_name || '',
    })
    setFormVisible(true)
  }

  const handleDelete = async (id: string) => {
    await request.delete(`/stations/${id}`)
    message.success(copy.deleted)
    loadList()
  }

  const handleSave = async () => {
    try {
      const vals = await form.validateFields()
      setSaving(true)
      const body = {
        name: { zh: vals.nameZh || '', th: vals.nameTh || '', en: vals.nameEn || '' },
        city: vals.city,
        district: vals.district,
        address: vals.address || '',
        lat: vals.lat,
        lng: vals.lng,
        status: vals.status || 'active',
        capacity: vals.capacity || 0,
        available: vals.available || 0,
        source: vals.source || 'manual',
        a_system_station_id: vals.a_system_station_id || '',
        device_code: vals.device_code || '',
        device_group_code: vals.device_group_code || '',
        a_system_device_id: vals.a_system_device_id || '',
        entry_code: vals.entry_code || '',
        landing_code: vals.landing_code || '',
        default_activity_id: vals.default_activity_id || '',
        source_channel_id: vals.source_channel_id || '',
        venue_name: vals.venue_name || '',
      }
      if (isEdit) {
        await request.put(`/stations/${editId}`, body)
        message.success(copy.updated)
      } else {
        await request.post('/stations', body)
        message.success(copy.created)
      }
      setFormVisible(false)
      loadList()
    } catch (e: any) {
      if (e?.errorFields) return
    } finally {
      setSaving(false)
    }
  }

  const columns: any[] = [
    {
      title: copy.colStationName,
      dataIndex: 'name',
      render: (name: Station['name'], row: Station) => (
        <div>
          <div style={{ fontWeight: 700 }}>{pickLocaleText(name) || name.zh}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{name.en || name.th || name.zh}</div>
          <div style={{ fontSize: 11, color: '#2CDBCE', marginTop: 2 }}>
            {copy.stationCode}：{row.station_code || row.id}
          </div>
        </div>
      ),
    },
    {
      title: copy.colCityDistrict,
      render: (_: any, row: Station) => (
        <Space direction="vertical" size={2}>
          <Tag color="blue">{getCityLabel(row.city)}</Tag>
          <Tag>{getDistrictLabel(row.city, row.district)}</Tag>
        </Space>
      ),
    },
    {
      title: copy.colCoord,
      render: (_: any, row: Station) => (
        <div style={{ fontSize: 12, color: '#666' }}>
          <div>{copy.lat} {row.lat}</div>
          <div>{copy.lng} {row.lng}</div>
        </div>
      ),
    },
    isBenefitView
      ? {
          title: copy.colBenefits,
          render: (_: any, row: Station) => (
            <div style={{ minWidth: 180 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <Tag color="geekblue" style={{ marginInlineEnd: 0 }}>{copy.activityCount} {row.activity_count || 0}</Tag>
                <Tag color="purple" style={{ marginInlineEnd: 0 }}>{copy.couponCount} {row.coupon_count || 0}</Tag>
                <Tag color={row.has_benefits ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
                  {row.has_benefits ? copy.benefitsMatched : copy.noBenefitsMatched}
                </Tag>
              </div>
              <div style={{ fontSize: 12, color: row.primary_benefit_label ? '#555' : '#bbb' }}>
                {row.primary_benefit_label || copy.noBenefitHint}
              </div>
            </div>
          ),
        }
      : {
          title: copy.colCapacity,
          render: (_: any, row: Station) => (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#2CDBCE' }}>{row.available}</span>
              <span style={{ color: '#999' }}> / {row.capacity}</span>
            </div>
          ),
        },
    isBenefitView
      ? {
          title: copy.colActivityPreview,
          render: (_: any, row: Station) => {
            const activities = row.activities || []
            if (!activities.length) return <span style={{ color: '#bbb' }}>{copy.noActivityMatched}</span>
            return (
              <div style={{ display: 'grid', gap: 6 }}>
                {activities.slice(0, 3).map((activity) => (
                  <div key={activity.id} style={{ fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: '#334155' }}>{activity.name}</div>
                    <Space size={4} wrap>
                      <Tag color={activity.match_mode === 'default_activity' ? 'gold' : 'blue'} style={{ marginInlineEnd: 0 }}>
                        {activity.match_mode === 'default_activity' ? copy.defaultActivity : copy.scopeMatched}
                      </Tag>
                      <Tag style={{ marginInlineEnd: 0 }}>{activity.status || 'unknown'}</Tag>
                    </Space>
                  </div>
                ))}
                {activities.length > 3 && <span style={{ fontSize: 12, color: '#999' }}>{copy.moreActivities.replace('{count}', String(activities.length - 3))}</span>}
              </div>
            )
          },
        }
      : {
          title: copy.colStatus,
          dataIndex: 'status',
          render: (status: string) => {
            const item = statusMap[status] || { color: 'default', label: status }
            return <Tag color={item.color}>{item.label}</Tag>
          },
        },
    isBenefitView && {
      title: copy.colCouponPreview,
      render: (_: any, row: Station) => {
        const coupons = row.coupons || []
        if (!coupons.length) return <span style={{ color: '#bbb' }}>{copy.noCouponMatched}</span>
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
            {coupons.length > 3 && <span style={{ fontSize: 12, color: '#999' }}>{copy.moreCoupons.replace('{count}', String(coupons.length - 3))}</span>}
          </div>
        )
      },
    },
    {
      title: copy.colGrowthBinding,
      render: (_: any, row: Station) => (
        <div style={{ fontSize: 12 }}>
          {row.entry_code && <div><Tag color="cyan" style={{ fontSize: 11 }}>{copy.entryTag} {row.entry_code}</Tag></div>}
          {row.landing_code && <div><Tag color="geekblue" style={{ fontSize: 11 }}>{copy.landingTag} {row.landing_code}</Tag></div>}
          {row.default_activity_id && <div><Tag color="purple" style={{ fontSize: 11 }}>{copy.activityTag} {row.default_activity_id}</Tag></div>}
          {!row.entry_code && !row.landing_code && !row.default_activity_id && <span style={{ color: '#d9d9d9' }}>-</span>}
        </div>
      ),
    },
    {
      title: copy.colASystem,
      render: (_: any, row: Station) => (
        <div style={{ fontSize: 12 }}>
          <Tag color={row.source === 'a_system' ? 'purple' : 'default'}>
            {row.source === 'a_system' ? copy.sourceASystem : copy.sourceManual}
          </Tag>
          {(row.a_system_station_id || row.external_id) && (
            <div style={{ color: '#999', marginTop: 2 }}>
              <ApiOutlined /> {row.a_system_station_id || row.external_id}
            </div>
          )}
          {row.device_code && (
            <div style={{ color: '#aaa', fontSize: 11 }}>{copy.devicePrefix}: {row.device_code}</div>
          )}
        </div>
      ),
    },
  ].filter(Boolean) as any[]

  if (!isBenefitView) {
    columns.push({
      title: copy.colAction,
      render: (_: any, row: Station) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>{copy.edit}</Button>
          <Popconfirm title={copy.deleteConfirm} onConfirm={() => handleDelete(row.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>{copy.delete}</Button>
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
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{pageCopy.subtitle}</div>
        </div>
        {!isBenefitView && (
          <Space>
            <Tooltip title={copy.syncReserved}>
              <Button icon={<SyncOutlined />} disabled>{copy.syncASystem}</Button>
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{copy.addStation}</Button>
          </Space>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Select
          allowClear
          placeholder={copy.cityFilter}
          style={{ width: 160 }}
          options={cityOptions}
          value={filterCity || undefined}
          onChange={v => { setFilterCity(v || ''); setFilterDistrict(''); loadList(v || '', '', filterStatus) }}
        />
        <Select
          allowClear
          placeholder={copy.districtFilter}
          style={{ width: 180 }}
          options={districtOptions}
          value={filterDistrict || undefined}
          disabled={!filterCity}
          onChange={v => { setFilterDistrict(v || ''); loadList(filterCity, v || '', filterStatus) }}
        />
        <Select
          allowClear
          placeholder={copy.statusFilter}
          style={{ width: 140 }}
          options={[
            { value: 'active', label: copy.statusActive },
            { value: 'maintenance', label: copy.statusMaint },
            { value: 'offline', label: copy.statusOffline },
          ]}
          value={filterStatus || undefined}
          onChange={v => { setFilterStatus(v || ''); loadList(filterCity, filterDistrict, v || '') }}
        />
        <Button onClick={() => { setFilterCity(''); setFilterDistrict(''); setFilterStatus(''); loadList('', '', '') }}>
          {copy.reset}
        </Button>
        <div style={{ marginLeft: 'auto', color: '#888', alignSelf: 'center', fontSize: 13 }}>
          {copy.totalStations.replace('{count}', String(list.length))}
        </div>
      </div>

      {isBenefitView && benefitSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{copy.stationCount}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>{benefitSummary.stationCount}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{copy.stationWithBenefitsCount}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#16a34a' }}>{benefitSummary.stationWithBenefitsCount}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{copy.activityHitCount}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#2563eb' }}>{benefitSummary.activityHitCount}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{copy.couponHitCount}</div>
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
        title={isEdit ? copy.modalEdit : copy.modalCreate}
        open={formVisible}
        onOk={handleSave}
        onCancel={() => { if (!saving) setFormVisible(false) }}
        confirmLoading={saving}
        width={760}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>{copy.sectionName}</span></Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="nameZh" label={copy.nameZh} rules={[{ required: true, message: copy.nameZhRequired }]}>
                <Input placeholder="例：暹罗广场站点 A" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="nameTh" label={copy.nameTh}>
                <Input placeholder="สยามสแควร์ A" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="nameEn" label={copy.nameEn}>
                <Input placeholder="Siam Square A" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>{copy.sectionLocation}</span></Divider>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="city" label={copy.city} rules={[{ required: true, message: copy.cityRequired }]}>
                <Select
                  placeholder={copy.selectCity}
                  options={cityOptions}
                  onChange={() => form.setFieldValue('district', undefined)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="district" label={copy.district} rules={[{ required: true, message: copy.districtRequired }]}>
                <Select
                  placeholder={copy.selectDistrict}
                  options={formDistrictOptions}
                  disabled={!selectedCity}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item name="address" label={copy.address}>
                <Input placeholder={copy.addressPlaceholder} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="venue_name" label={copy.venueName}>
                <Input placeholder={copy.venuePlaceholder} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="lat" label={copy.latitude} rules={[{ required: true, message: copy.latitudeRequired }]}>
                <InputNumber style={{ width: '100%' }} placeholder="例：13.7455" step={0.0001} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="lng" label={copy.longitude} rules={[{ required: true, message: copy.longitudeRequired }]}>
                <InputNumber style={{ width: '100%' }} placeholder="例：100.5341" step={0.0001} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>{copy.sectionOps}</span></Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="status" label={copy.status} initialValue="active">
                <Select options={[
                  { value: 'active', label: copy.statusActive },
                  { value: 'maintenance', label: copy.statusMaint },
                  { value: 'offline', label: copy.statusOffline },
                ]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="capacity" label={copy.capacity}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="8" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="available" label={copy.available}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="5" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>{copy.sectionGrowth}</span></Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="entry_code" label={copy.entryCode}>
                <Input placeholder="例：entry_001" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="landing_code" label={copy.landingCode}>
                <Input placeholder="例：lt_001" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="default_activity_id" label={copy.defaultActivityId}>
                <Input placeholder="例：act_001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="source_channel_id" label={copy.sourceChannelId}>
                <Input placeholder={copy.sourceChannelPlaceholder} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>{copy.sectionASystem}</span></Divider>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="a_system_station_id" label={copy.aSystemStationId}>
                <Input placeholder="例：station_1001" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="device_code" label={copy.deviceCode}>
                <Input placeholder="例：dev_1001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="device_group_code" label={copy.deviceGroupCode}>
                <Input placeholder="例：group_01" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="a_system_device_id" label={copy.aSystemDeviceId}>
                <Input placeholder="例：device_1001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="source" label={copy.sourceType} initialValue="manual">
                <Select options={[
                  { value: 'manual', label: copy.sourceTypeManual },
                  { value: 'a_system', label: copy.sourceTypeASystem },
                ]} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
