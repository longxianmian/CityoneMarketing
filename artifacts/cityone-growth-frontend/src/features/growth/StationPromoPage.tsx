/**
 * 站点推广码管理
 * 功能：为每个站点创建桌贴码、海报码、店员码；查看各类入口带来的流量数据
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  Select, Button, Card, Row, Col, Modal, Form, Input,
  Popconfirm, message, Tag, Spin, Divider, Tooltip, Empty,
} from 'antd'
import {
  QrcodeOutlined, PlusOutlined, DeleteOutlined,
  DownloadOutlined, PrinterOutlined, UserOutlined,
  TeamOutlined, FileImageOutlined, ThunderboltOutlined,
  EditOutlined, TrophyOutlined,
} from '@ant-design/icons'
import QRCode from 'qrcode'
import request from '../../api/request'

/* ─── 类型 ────────────────────────────────────────────────────────────────── */
type Station = { station_code: string; station_name: string; city_name?: string }
type PromoEntry = {
  id: number
  entry_code: string
  station_code: string
  entry_type: string
  staff_name: string
  staff_no: string
  scan_count: number
  status: string
  created_at: string
}
type StatsByType = Record<string, { total_events: number; unique_users: number }>
type StaffStat = {
  entry_code: string
  staff_name: string
  staff_no: string
  unique_users: number
  total_events: number
}

/* ─── 工具 ────────────────────────────────────────────────────────────────── */
function pickML(v: any): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  return v.zh || v.en || v.th || ''
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  device_qr:     { label: '设备码',   icon: <ThunderboltOutlined />, color: '#1677ff', desc: '设备自带，A系统管理' },
  table_sticker: { label: '桌贴码',   icon: <QrcodeOutlined />,      color: '#52c41a', desc: '桌面/台卡贴纸' },
  poster_qr:     { label: '海报码',   icon: <FileImageOutlined />,   color: '#fa8c16', desc: '门店海报/易拉宝' },
  staff_qr:      { label: '店员码',   icon: <UserOutlined />,        color: '#722ed1', desc: '店员个人推广' },
}

function buildQrUrl(entryCode: string, stationCode: string, entryType: string) {
  const base = window.location.origin
  return `${base}/welfare?ec=${entryCode}&station_id=${stationCode}&src=${entryType}`
}

async function downloadQr(entryCode: string, stationCode: string, entryType: string, label: string) {
  const url = buildQrUrl(entryCode, stationCode, entryType)
  const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `cityone_${entryType}_${entryCode}.png`
  a.click()
}

async function printQr(entryCode: string, stationCode: string, entryType: string, label: string, subLabel: string) {
  const url = buildQrUrl(entryCode, stationCode, entryType)
  const dataUrl = await QRCode.toDataURL(url, { width: 500, margin: 2 })
  const pw = window.open('', '_blank', 'width=600,height=700')
  if (!pw) return
  pw.document.write(`
    <html><head><title>二维码打印</title>
    <style>
      body { display:flex; flex-direction:column; align-items:center; justify-content:center;
             font-family:sans-serif; padding:32px; }
      img { width:280px; height:280px; }
      .label { font-size:22px; font-weight:700; margin-top:16px; }
      .sub   { font-size:14px; color:#666; margin-top:6px; }
      .code  { font-size:11px; color:#aaa; margin-top:4px; }
      @media print { button { display:none } }
    </style></head><body>
    <img src="${dataUrl}" />
    <div class="label">${label}</div>
    <div class="sub">${subLabel}</div>
    <div class="code">${entryCode}</div>
    <button onclick="window.print()" style="margin-top:24px;padding:10px 28px;font-size:15px;cursor:pointer">打印</button>
    </body></html>
  `)
  pw.document.close()
}

/* ─── 单张推广码卡片 ─────────────────────────────────────────────────────── */
function PromoCard({
  item, stationCode, stationName, onDelete, onEdit,
}: {
  item: PromoEntry
  stationCode: string
  stationName: string
  onDelete: () => void
  onEdit?: () => void
}) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const meta = TYPE_META[item.entry_type] || { label: item.entry_type, color: '#999', icon: <QrcodeOutlined />, desc: '' }
  const isDevice = item.entry_type === 'device_qr'

  useEffect(() => {
    const url = buildQrUrl(item.entry_code, stationCode, item.entry_type)
    QRCode.toDataURL(url, { width: 180, margin: 1 }).then(setQrDataUrl)
  }, [item.entry_code])

  const subLabel = item.entry_type === 'staff_qr'
    ? (item.staff_name || '店员') + (item.staff_no ? `（${item.staff_no}）` : '')
    : meta.label

  return (
    <Card
      size="small"
      style={{ borderRadius: 14, border: `1.5px solid ${meta.color}22`, background: `${meta.color}08` }}
      styles={{ body: { padding: 16 } }}
    >
      <div style={{ display: 'flex', gap: 14 }}>
        {/* 二维码图片 */}
        <div style={{ flexShrink: 0 }}>
          {qrDataUrl
            ? <img src={qrDataUrl} alt="QR" style={{ width: 88, height: 88, borderRadius: 8, border: '1px solid #eee' }} />
            : <div style={{ width: 88, height: 88, background: '#f5f5f5', borderRadius: 8 }} />}
        </div>
        {/* 信息 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Tag color={meta.color} style={{ borderRadius: 6, fontWeight: 600 }}>
              {meta.icon} {meta.label}
            </Tag>
          </div>
          {item.entry_type === 'staff_qr' && (
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              {item.staff_name || '—'}{item.staff_no ? ` · ${item.staff_no}` : ''}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8, wordBreak: 'break-all' }}>
            {item.entry_code}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button size="small" icon={<DownloadOutlined />}
              onClick={() => downloadQr(item.entry_code, stationCode, item.entry_type, subLabel)}>
              下载
            </Button>
            <Button size="small" icon={<PrinterOutlined />}
              onClick={() => printQr(item.entry_code, stationCode, item.entry_type, stationName, subLabel)}>
              打印
            </Button>
            {!isDevice && onEdit && item.entry_type === 'staff_qr' && (
              <Button size="small" icon={<EditOutlined />} onClick={onEdit}>编辑</Button>
            )}
            {!isDevice && (
              <Popconfirm title="确认删除此推广码？" onConfirm={onDelete} okText="删除" cancelText="取消">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ─── 流量统计卡片 ───────────────────────────────────────────────────────── */
function StatCard({ type, stat }: { type: string; stat?: { total_events: number; unique_users: number } }) {
  const meta = TYPE_META[type]
  return (
    <Card size="small" style={{ borderRadius: 14, textAlign: 'center', border: `1.5px solid ${meta.color}33` }}
      styles={{ body: { padding: '16px 12px' } }}>
      <div style={{ fontSize: 22, color: meta.color, marginBottom: 4 }}>{meta.icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{meta.label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: meta.color }}>{stat?.unique_users ?? 0}</div>
          <div style={{ fontSize: 11, color: '#888' }}>访客数</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: meta.color }}>{stat?.total_events ?? 0}</div>
          <div style={{ fontSize: 11, color: '#888' }}>转化数</div>
        </div>
      </div>
    </Card>
  )
}

/* ─── 主页面 ─────────────────────────────────────────────────────────────── */
export default function StationPromoPage() {
  const [stations, setStations] = useState<Station[]>([])
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [entries, setEntries] = useState<PromoEntry[]>([])
  const [stats, setStats] = useState<StatsByType>({})
  const [staffStats, setStaffStats] = useState<StaffStat[]>([])
  const [loading, setLoading] = useState(false)

  // 新建弹窗
  const [createType, setCreateType] = useState<string>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [saving, setSaving] = useState(false)

  // 编辑店员弹窗
  const [editEntry, setEditEntry] = useState<PromoEntry | null>(null)
  const [editForm] = Form.useForm()
  const [editOpen, setEditOpen] = useState(false)

  // 加载站点列表
  useEffect(() => {
    ;(request.get('/stations') as any).then((res: any) => {
      // /stations 返回 { data: { list: [...] } }
      const list: any[] = res?.data?.list || res?.data || []
      setStations(list.map((s: any) => ({
        station_code: s.station_code || s.id || '',
        station_name: pickML(s.name) || s.station_name || s.station_code || s.id || '',
        city_name: s.city_name || s.city || '',
      })))
    }).catch(() => {})
  }, [])

  // 加载推广码和统计
  const loadData = useCallback(async (stationCode: string) => {
    setLoading(true)
    try {
      const [listRes, statsRes]: any[] = await Promise.all([
        request.get(`/growth/station-promo/list?station_code=${stationCode}`),
        request.get(`/growth/station-promo/stats?station_code=${stationCode}`),
      ])
      setEntries(listRes?.data || [])
      setStats((statsRes?.data?.by_type) || {})
      setStaffStats((statsRes?.data?.by_staff) || [])
    } catch {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleStationChange = (code: string) => {
    const st = stations.find(s => s.station_code === code) || null
    setSelectedStation(st)
    if (st) loadData(st.station_code)
  }

  // 按类型过滤
  const entriesByType = (type: string) => entries.filter(e => e.entry_type === type)

  // 创建推广码
  const handleCreate = async () => {
    let vals: any = {}
    try { vals = await createForm.validateFields() } catch { return }
    if (!selectedStation) return
    setSaving(true)
    try {
      await request.post('/growth/station-promo/create', {
        station_code: selectedStation.station_code,
        site_name: selectedStation.station_name,
        entry_type: createType,
        staff_name: vals.staff_name || '',
        staff_no: vals.staff_no || '',
      })
      message.success('创建成功')
      setCreateOpen(false)
      createForm.resetFields()
      loadData(selectedStation.station_code)
    } catch (e: any) {
      message.error(e?.response?.data?.msg || '创建失败')
    } finally {
      setSaving(false)
    }
  }

  // 删除推广码
  const handleDelete = async (entryCode: string) => {
    if (!selectedStation) return
    try {
      await request.post('/growth/station-promo/delete', { entry_code: entryCode })
      message.success('已删除')
      loadData(selectedStation.station_code)
    } catch {
      message.error('删除失败')
    }
  }

  // 编辑店员信息
  const handleEditSave = async () => {
    if (!editEntry || !selectedStation) return
    let vals: any = {}
    try { vals = await editForm.validateFields() } catch { return }
    setSaving(true)
    try {
      await request.post('/growth/station-promo/update', {
        entry_code: editEntry.entry_code,
        staff_name: vals.staff_name,
        staff_no: vals.staff_no || '',
      })
      message.success('已更新')
      setEditOpen(false)
      loadData(selectedStation.station_code)
    } catch {
      message.error('更新失败')
    } finally {
      setSaving(false)
    }
  }

  /* ─── 渲染一个推广码区块 ─── */
  function PromoSection({
    type, title, canMultiple = true,
  }: { type: string; title: string; canMultiple?: boolean }) {
    const list = entriesByType(type)
    const meta = TYPE_META[type]
    const limitReached = !canMultiple && list.length >= 1

    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 16, color: meta.color }}>{meta.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
          <Tag style={{ borderRadius: 20 }}>{list.length} 张</Tag>
          {!limitReached && (
            <Button size="small" type="primary" icon={<PlusOutlined />}
              onClick={() => { setCreateType(type); createForm.resetFields(); setCreateOpen(true) }}>
              新建
            </Button>
          )}
          {limitReached && <span style={{ fontSize: 12, color: '#aaa' }}>每站点限 1 张</span>}
        </div>
        {list.length === 0
          ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无推广码" style={{ padding: '16px 0' }} />
          : (
            <Row gutter={[12, 12]}>
              {list.map(item => (
                <Col key={item.entry_code} xs={24} sm={12} lg={8}>
                  <PromoCard
                    item={item}
                    stationCode={selectedStation!.station_code}
                    stationName={selectedStation!.station_name}
                    onDelete={() => handleDelete(item.entry_code)}
                    onEdit={() => {
                      setEditEntry(item)
                      editForm.setFieldsValue({ staff_name: item.staff_name, staff_no: item.staff_no })
                      setEditOpen(true)
                    }}
                  />
                </Col>
              ))}
            </Row>
          )}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
      {/* ─── 页头 ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>站点推广码</h2>
          <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
            为每个站点生成桌贴码、海报码、店员码，精准统计各渠道带来的流量
          </div>
        </div>
        <Select
          style={{ width: 280 }}
          placeholder="选择站点..."
          showSearch
          optionFilterProp="label"
          onChange={handleStationChange}
          options={stations.map(s => ({
            value: s.station_code,
            label: `${s.station_name}${s.city_name ? ` · ${s.city_name}` : ''}`,
          }))}
        />
      </div>

      {!selectedStation && (
        <Card style={{ textAlign: 'center', borderRadius: 16, padding: '40px 0', border: '2px dashed #e0e0e0' }}>
          <QrcodeOutlined style={{ fontSize: 48, color: '#c0c0c0', marginBottom: 12 }} />
          <div style={{ color: '#888', fontSize: 15 }}>请先选择一个站点，查看和管理该站点的推广码</div>
        </Card>
      )}

      {selectedStation && (
        <Spin spinning={loading}>
          {/* ─── 流量统计卡片 ── */}
          <Card style={{ borderRadius: 16, marginBottom: 24 }} styles={{ body: { padding: '20px 20px 12px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <TrophyOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
              <span style={{ fontWeight: 700, fontSize: 16 }}>流量来源统计 · {selectedStation.station_name}</span>
            </div>
            <Row gutter={[12, 12]}>
              {['device_qr', 'table_sticker', 'poster_qr', 'staff_qr'].map(t => (
                <Col key={t} xs={12} sm={6}>
                  <StatCard type={t} stat={stats[t]} />
                </Col>
              ))}
            </Row>
          </Card>

          {/* ─── 店员排行 ── */}
          {staffStats.length > 0 && (
            <Card style={{ borderRadius: 16, marginBottom: 24 }} styles={{ body: { padding: '20px' } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <TeamOutlined style={{ color: '#722ed1', fontSize: 18 }} />
                <span style={{ fontWeight: 700, fontSize: 16 }}>店员引流排行</span>
                <span style={{ fontSize: 12, color: '#888' }}>（按访客数降序）</span>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {staffStats.map((s, i) => (
                  <div key={s.entry_code} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: i === 0 ? '#fff7e6' : i === 1 ? '#f9f0ff' : '#f5f5f5',
                    borderRadius: 10, padding: '10px 14px',
                    border: `1.5px solid ${i === 0 ? '#ffd591' : i === 1 ? '#d3adf7' : '#e8e8e8'}`,
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: i === 0 ? '#fa8c16' : i === 1 ? '#722ed1' : '#aaa', width: 24, textAlign: 'center' }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.staff_name || '未命名店员'}</div>
                      {s.staff_no && <div style={{ fontSize: 11, color: '#888' }}>{s.staff_no}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#722ed1' }}>{s.unique_users}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>访客</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 48 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#52c41a' }}>{s.total_events}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>转化</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ─── 三类推广码区块 ── */}
          <Card style={{ borderRadius: 16 }} styles={{ body: { padding: '24px 20px' } }}>
            <PromoSection type="table_sticker" title="桌贴码" canMultiple />
            <Divider style={{ margin: '20px 0' }} />
            <PromoSection type="poster_qr" title="海报码 / 易拉宝码" canMultiple={false} />
            <Divider style={{ margin: '20px 0' }} />
            <PromoSection type="staff_qr" title="店员码" canMultiple />
          </Card>
        </Spin>
      )}

      {/* ─── 创建弹窗 ── */}
      <Modal
        open={createOpen}
        title={`新建${TYPE_META[createType]?.label || '推广码'}`}
        onCancel={() => { setCreateOpen(false); createForm.resetFields() }}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnHidden
      >
        <div style={{ paddingTop: 8 }}>
          {createType === 'table_sticker' && (
            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              📋 桌贴码贴在台面/吧台/桌角，顾客扫码即可进入福利中心，可创建多张（区分不同桌位）
            </div>
          )}
          {createType === 'poster_qr' && (
            <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              🪧 每个站点仅限 1 张海报码，用于门店海报或易拉宝，尺寸建议 ≥ 3cm×3cm
            </div>
          )}
          {createType === 'staff_qr' && (
            <Form form={createForm} layout="vertical">
              <div style={{ background: '#f9f0ff', border: '1px solid #d3adf7', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                👤 店员码绑定到具体店员，每人一码，可统计个人引流量，后期可作为奖励依据
              </div>
              <Form.Item name="staff_name" label="店员姓名" rules={[{ required: true, message: '请填写店员姓名' }]}>
                <Input placeholder="如：小明" />
              </Form.Item>
              <Form.Item name="staff_no" label="工号（选填）">
                <Input placeholder="如：S001" />
              </Form.Item>
            </Form>
          )}
          {createType !== 'staff_qr' && (
            <div style={{ color: '#888', fontSize: 13 }}>
              点击"创建"即可生成专属二维码，创建后可下载或打印。
            </div>
          )}
        </div>
      </Modal>

      {/* ─── 编辑店员信息弹窗 ── */}
      <Modal
        open={editOpen}
        title="编辑店员信息"
        onCancel={() => setEditOpen(false)}
        onOk={handleEditSave}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" style={{ paddingTop: 8 }}>
          <Form.Item name="staff_name" label="店员姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="staff_no" label="工号（选填）">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
