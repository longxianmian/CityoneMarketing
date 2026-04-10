/**
 * 核销管理 — 店员/管理员核销用户卡券
 * 两个 Tab：
 *   1. 快捷核销 — 输入券码立即查询并核销
 *   2. 核销记录 — 分页浏览所有用户券，可按状态过滤
 */
import React, { useState, useCallback, useEffect } from 'react'
import {
  Card, Tabs, Input, Button, Tag, Descriptions, Spin, Alert,
  Table, Select, Space, message, Modal, Popconfirm, Row, Col, Statistic,
} from 'antd'
import {
  SearchOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, ScanOutlined, ReloadOutlined,
} from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'

/* ─── 工具 ──────────────────────────────────────────────────────────────── */
function pickML(field: any): string {
  if (!field) return '-'
  if (typeof field === 'string') return field
  if (typeof field === 'object' && !Array.isArray(field))
    return field.zh || field.en || field.th || '-'
  return '-'
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  claimed:   { label: '未使用',  color: 'blue',    icon: <ClockCircleOutlined /> },
  used:      { label: '已核销',  color: 'green',   icon: <CheckCircleOutlined /> },
  expired:   { label: '已过期',  color: 'default', icon: <CloseCircleOutlined /> },
  cancelled: { label: '已作废',  color: 'red',     icon: <CloseCircleOutlined /> },
}

const DISCOUNT_TYPE_MAP: Record<string, string> = {
  fixed: '固定减免', percent: '折扣', free_time: '免费时长', free_order: '免单',
}

function fmtDiscount(r: any) {
  const val = Number(r.discount_value || 0)
  if (r.discount_type === 'percent') return `-${Math.round((1 - val) * 100)}% OFF`
  if (r.discount_type === 'free_time') return `${val} 分钟`
  if (r.discount_type === 'free_order') return '免单'
  return `฿${val}`
}

function StatusTag({ status }: { status: string }) {
  const m = STATUS_MAP[status] || { label: status, color: 'default', icon: null }
  return <Tag color={m.color} icon={m.icon}>{m.label}</Tag>
}

/* ─── 核销详情卡 ─────────────────────────────────────────────────────────── */
function VerifyCard({
  uc, onVerify, verifying,
}: {
  uc: any
  onVerify: () => void
  verifying: boolean
}) {
  const canVerify = uc.product_status === 'claimed'
  return (
    <Card
      style={{ borderRadius: 16, border: `2px solid ${canVerify ? '#1677ff' : '#e8e8e8'}` }}
      styles={{ body: { padding: '20px 24px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{pickML(uc.coupon_name)}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{uc.id}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusTag status={uc.product_status} />
          <span style={{ fontSize: 22, fontWeight: 900, color: '#1677ff' }}>{fmtDiscount(uc)}</span>
        </div>
      </div>

      <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered>
        <Descriptions.Item label="用户ID">{uc.user_id || uc.line_user_id || '-'}</Descriptions.Item>
        <Descriptions.Item label="券类型">{DISCOUNT_TYPE_MAP[uc.discount_type] || uc.discount_type}</Descriptions.Item>
        <Descriptions.Item label="领取时间">{uc.claimed_at ? dayjs(uc.claimed_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
        <Descriptions.Item label="有效期">
          {uc.valid_to ? dayjs(uc.valid_to).format('YYYY-MM-DD') : '长期有效'}
        </Descriptions.Item>
        {uc.product_status === 'used' && (
          <Descriptions.Item label="核销时间" span={2}>
            {uc.used_at ? dayjs(uc.used_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
        )}
      </Descriptions>

      {canVerify && (
        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <Popconfirm
            title="确认核销此券？"
            description={`将核销「${pickML(uc.coupon_name)}」，操作不可撤销。`}
            onConfirm={onVerify}
            okText="确认核销"
            cancelText="取消"
            okButtonProps={{ danger: false }}
          >
            <Button type="primary" size="large" loading={verifying} icon={<CheckCircleOutlined />}
              style={{ borderRadius: 10, fontWeight: 700, padding: '0 32px' }}>
              核销此券
            </Button>
          </Popconfirm>
        </div>
      )}
      {!canVerify && (
        <Alert
          style={{ marginTop: 16, borderRadius: 10 }}
          type={uc.product_status === 'used' ? 'success' : 'warning'}
          message={STATUS_MAP[uc.product_status]?.label || uc.product_status}
          description={uc.product_status === 'used'
            ? `已于 ${dayjs(uc.used_at).format('YYYY-MM-DD HH:mm')} 核销`
            : '此券不可核销'}
          showIcon
        />
      )}
    </Card>
  )
}

/* ─── Tab1：快捷核销 ──────────────────────────────────────────────────────── */
function QuickVerify() {
  const [inputVal, setInputVal] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [uc, setUc] = useState<any>(null)
  const [errMsg, setErrMsg] = useState('')

  const handleLookup = async () => {
    const code = inputVal.trim()
    if (!code) return
    setLoading(true)
    setUc(null)
    setErrMsg('')
    try {
      const res: any = await request.get('/growth/coupon/verify/lookup', { params: { uc_id: code } })
      setUc(res.data)
    } catch (e: any) {
      const msg = e?.response?.data?.msg || '未找到该券，请检查券码是否正确'
      setErrMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!uc) return
    setVerifying(true)
    try {
      const res: any = await request.post('/growth/coupon/verify/use', { uc_id: uc.id })
      message.success('核销成功！')
      setUc(res.data)
      setInputVal('')
    } catch (e: any) {
      message.error(e?.response?.data?.msg || '核销失败')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>输入用户券码</div>
        <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
          请输入用户出示的券码（如 uc_xxxxx），系统自动查询并核销。
        </div>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            size="large"
            placeholder="例如：uc_a1b2c3d4"
            value={inputVal}
            onChange={e => { setInputVal(e.target.value); setUc(null); setErrMsg('') }}
            onPressEnter={handleLookup}
            prefix={<ScanOutlined style={{ color: '#1677ff' }} />}
            allowClear
          />
          <Button type="primary" size="large" loading={loading} onClick={handleLookup} icon={<SearchOutlined />}>
            查询
          </Button>
        </Space.Compact>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>}
      {errMsg && <Alert type="error" message={errMsg} showIcon style={{ borderRadius: 10 }} />}
      {uc && !loading && (
        <VerifyCard uc={uc} onVerify={handleVerify} verifying={verifying} />
      )}
    </div>
  )
}

/* ─── Tab2：核销记录 ──────────────────────────────────────────────────────── */
function VerifyList() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [status, setStatus] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [verifying, setVerifying] = useState<string | null>(null)
  const [detailUc, setDetailUc] = useState<any>(null)

  const fetchList = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const res: any = await request.get('/growth/coupon/verify/list', {
        params: { pageNum: p, pageSize, status, keyword: keyword || undefined },
      })
      setRows(res.data?.rows || [])
      setTotal(res.data?.total || 0)
      setPage(p)
    } catch { setRows([]); setTotal(0) }
    setLoading(false)
  }, [status, keyword, pageSize])

  useEffect(() => { fetchList(1) }, [fetchList])

  const handleVerifyRow = async (ucId: string) => {
    setVerifying(ucId)
    try {
      const res: any = await request.post('/growth/coupon/verify/use', { uc_id: ucId })
      message.success('核销成功！')
      // 刷新该行
      setRows(prev => prev.map(r => r.id === ucId ? { ...r, ...res.data } : r))
      if (detailUc?.id === ucId) setDetailUc(res.data)
    } catch (e: any) {
      message.error(e?.response?.data?.msg || '核销失败')
    } finally {
      setVerifying(null)
    }
  }

  // 汇总
  const claimed   = rows.filter(r => r.product_status === 'claimed').length
  const used      = rows.filter(r => r.product_status === 'used').length

  const columns = [
    {
      title: '券码', dataIndex: 'id', key: 'id', width: 160, ellipsis: true,
      render: (v: string) => (
        <Button type="link" size="small" onClick={() => setDetailUc(
          rows.find(r => r.id === v)
        )} style={{ padding: 0, fontFamily: 'monospace', fontSize: 12 }}>
          {v}
        </Button>
      ),
    },
    {
      title: '卡券', dataIndex: 'coupon_name', key: 'coupon_name', ellipsis: true,
      render: (v: any) => pickML(v),
    },
    {
      title: '用户', dataIndex: 'user_id', key: 'user_id', width: 120, ellipsis: true,
      render: (v: string, r: any) => v || r.line_user_id || '-',
    },
    {
      title: '折扣', key: 'discount', width: 100,
      render: (_: any, r: any) => <span style={{ color: '#1677ff', fontWeight: 700 }}>{fmtDiscount(r)}</span>,
    },
    {
      title: '领取时间', dataIndex: 'claimed_at', key: 'claimed_at', width: 140,
      render: (v: string) => v ? dayjs(v).format('MM-DD HH:mm') : '-',
    },
    {
      title: '状态', dataIndex: 'product_status', key: 'product_status', width: 90,
      render: (v: string) => <StatusTag status={v} />,
    },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right' as const,
      render: (_: any, r: any) =>
        r.product_status === 'claimed' ? (
          <Popconfirm
            title={`确认核销「${pickML(r.coupon_name)}」？`}
            onConfirm={() => handleVerifyRow(r.id)}
            okText="核销" cancelText="取消"
          >
            <Button type="primary" size="small" loading={verifying === r.id}>
              核销
            </Button>
          </Popconfirm>
        ) : (
          <span style={{ color: '#bbb', fontSize: 12 }}>{STATUS_MAP[r.product_status]?.label}</span>
        ),
    },
  ]

  return (
    <div>
      {/* 快速汇总 */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={8}><Card size="small"><Statistic title="当页未核销" value={claimed} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="当页已核销" value={used} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="总记录数" value={total} /></Card></Col>
      </Row>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select
          value={status}
          onChange={v => { setStatus(v); fetchList(1) }}
          style={{ width: 130 }}
          options={[
            { value: 'all',       label: '全部状态' },
            { value: 'claimed',   label: '未使用' },
            { value: 'used',      label: '已核销' },
            { value: 'expired',   label: '已过期' },
            { value: 'cancelled', label: '已作废' },
          ]}
        />
        <Input.Search
          placeholder="搜索用户ID/券码"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onSearch={() => fetchList(1)}
          style={{ width: 220 }}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={() => fetchList(1)}>刷新</Button>
      </div>

      <Table
        loading={loading}
        dataSource={rows}
        columns={columns}
        rowKey="id"
        scroll={{ x: 900 }}
        size="small"
        pagination={{
          current: page, pageSize, total, showSizeChanger: false,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p) => fetchList(p),
        }}
      />

      {/* 详情弹窗 */}
      <Modal
        open={!!detailUc}
        title="用户券详情"
        onCancel={() => setDetailUc(null)}
        footer={null}
        width={560}
        destroyOnHidden
      >
        {detailUc && (
          <VerifyCard
            uc={detailUc}
            onVerify={() => handleVerifyRow(detailUc.id)}
            verifying={verifying === detailUc.id}
          />
        )}
      </Modal>
    </div>
  )
}

/* ─── 主页面 ─────────────────────────────────────────────────────────────── */
export default function CouponVerifyPage() {
  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>核销管理</div>
        <div style={{ color: '#888', fontSize: 13 }}>输入用户出示的券码进行快捷核销，或在记录列表中查询批量核销</div>
      </div>

      <Tabs
        defaultActiveKey="quick"
        size="large"
        items={[
          { key: 'quick',  label: '⚡ 快捷核销', children: <QuickVerify /> },
          { key: 'list',   label: '📋 核销记录', children: <VerifyList /> },
        ]}
      />
    </div>
  )
}
