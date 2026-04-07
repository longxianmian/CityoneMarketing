import React, { useMemo, useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, DatePicker, Button, Table, Tag, Select, Progress, Tabs, Input, Spin, Empty } from 'antd'
import {
  LineChartOutlined,
  EyeOutlined,
  LinkOutlined,
  HeartOutlined,
  UserOutlined,
  CrownOutlined,
  TeamOutlined,
  ApartmentOutlined,
  FundProjectionScreenOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'
import request from '../../api/request'

const { RangePicker } = DatePicker

interface ReportRow {
  id: string
  unitType: string
  unitName: string
  department: string
  ownerDept: string
  partnerDept: string
  goal: string
  reads: number
  clicks: number
  follows: number
  clickRate: number
  followRate: number
  users: number
  members: number
  userRate: number
  memberRate: number
  totalMemberRate: number
}

interface ReportData {
  promotionData: ReportRow[]
  onsiteData: ReportRow[]
  oaData: ReportRow[]
  jointData: ReportRow[]
}

export default function GrowthReport() {
  const { t } = useI18n()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [department, setDepartment] = useState<string>('all')
  const [unitType, setUnitType] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<string>('promotion')
  const [operationSubTab, setOperationSubTab] = useState<string>('onsite')
  const [keyword, setKeyword] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData>({
    promotionData: [], onsiteData: [], oaData: [], jointData: [],
  })

  const load = () => {
    setLoading(true)
    request.get('/dashboard/growth-report')
      .then((res: any) => {
        const d = res?.data || res
        if (d?.promotionData !== undefined) {
          setData({
            promotionData: d.promotionData || [],
            onsiteData: d.onsiteData || [],
            oaData: d.oaData || [],
            jointData: d.jointData || [],
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filterRows = (rows: ReportRow[]) =>
    rows.filter((item) => {
      const okDept = department === 'all' || item.department === department
      const okType = unitType === 'all' || item.unitType === unitType
      const okKeyword = !keyword.trim() || item.unitName.includes(keyword.trim())
      return okDept && okType && okKeyword
    })

  const filteredPromotion = useMemo(() => filterRows(data.promotionData), [data, department, unitType, keyword])
  const filteredOnsite = useMemo(() => filterRows(data.onsiteData), [data, department, unitType, keyword])
  const filteredOa = useMemo(() => filterRows(data.oaData), [data, department, unitType, keyword])
  const filteredJoint = useMemo(() => filterRows(data.jointData), [data, department, unitType, keyword])

  const ZERO_HINT = <span style={{ color: '#bbb', fontSize: 12 }}>--</span>
  const renderRate = (v: number, greenAt: number, blueAt: number) =>
    v === 0 ? ZERO_HINT : <Tag color={v >= greenAt ? 'green' : v >= blueAt ? 'blue' : 'default'}>{v}%</Tag>

  const promotionColumns = [
    {
      title: t('growthReport.colUnit'),
      dataIndex: 'unitName',
      key: 'unitName',
      render: (_: string, row: ReportRow) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.unitName || '--'}</div>
          <div style={{ marginTop: 4 }}>
            <Tag color="blue">{row.unitType}</Tag>
            {row.department !== '--' && <Tag>{row.department}</Tag>}
          </div>
        </div>
      ),
    },
    { title: t('growthReport.colGoal'), dataIndex: 'goal', key: 'goal',
      render: (v: string) => v === '--' ? ZERO_HINT : <Tag color="cyan">{v}</Tag> },
    { title: t('growthReport.colOwnerDept'), dataIndex: 'ownerDept', key: 'ownerDept',
      render: (v: string) => v === '--' ? ZERO_HINT : v },
    { title: t('growthReport.colPartnerDept'), dataIndex: 'partnerDept', key: 'partnerDept',
      render: (v: string) => v === '--' ? ZERO_HINT : v },
    { title: t('growthReport.colReads'), dataIndex: 'reads', key: 'reads' },
    { title: t('growthReport.colClicks'), dataIndex: 'clicks', key: 'clicks' },
    { title: t('growthReport.colFollows'), dataIndex: 'follows', key: 'follows' },
    { title: t('growthReport.colClickRate'), dataIndex: 'clickRate', key: 'clickRate',
      render: (v: number) => renderRate(v, 30, 20) },
    { title: t('growthReport.colFollowRate'), dataIndex: 'followRate', key: 'followRate',
      render: (v: number) => renderRate(v, 35, 25) },
  ]

  const operationColumns = [
    {
      title: t('growthReport.colUnit'),
      dataIndex: 'unitName',
      key: 'unitName',
      render: (_: string, row: ReportRow) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.unitName || '--'}</div>
          <div style={{ marginTop: 4 }}>
            <Tag color="purple">{row.unitType}</Tag>
            {row.department !== '--' && <Tag>{row.department}</Tag>}
          </div>
        </div>
      ),
    },
    { title: t('growthReport.colGoal'), dataIndex: 'goal', key: 'goal',
      render: (v: string) => v === '--' ? ZERO_HINT : <Tag color="gold">{v}</Tag> },
    { title: t('growthReport.colOwnerDept'), dataIndex: 'ownerDept', key: 'ownerDept',
      render: (v: string) => v === '--' ? ZERO_HINT : v },
    { title: t('growthReport.colPartnerDept'), dataIndex: 'partnerDept', key: 'partnerDept',
      render: (v: string) => v === '--' ? ZERO_HINT : v },
    { title: t('growthReport.colFollows'), dataIndex: 'follows', key: 'follows' },
    { title: t('growthReport.colUsers'), dataIndex: 'users', key: 'users' },
    { title: t('growthReport.colMembers'), dataIndex: 'members', key: 'members',
      render: (v: number) => <span>{v}<span style={{ fontSize: 11, color: '#bbb', marginLeft: 4 }}>估</span></span> },
    { title: t('growthReport.colUserRate'), dataIndex: 'userRate', key: 'userRate',
      render: (v: number) => renderRate(v, 60, 45) },
    { title: t('growthReport.colMemberRate'), dataIndex: 'memberRate', key: 'memberRate',
      render: (v: number) => renderRate(v, 45, 30) },
    { title: t('growthReport.colTotalMemberRate'), dataIndex: 'totalMemberRate', key: 'totalMemberRate',
      render: (v: number) => renderRate(v, 28, 20) },
  ]

  const renderSummaryCards = (rows: ReportRow[], mode: 'promo' | 'ops') => {
    if (mode === 'promo') {
      const totalReads = rows.reduce((s, r) => s + r.reads, 0)
      const totalClicks = rows.reduce((s, r) => s + r.clicks, 0)
      const totalFollows = rows.reduce((s, r) => s + r.follows, 0)
      const clickRate = totalReads > 0 ? Number(((totalClicks / totalReads) * 100).toFixed(2)) : 0
      const followRate = totalClicks > 0 ? Number(((totalFollows / totalClicks) * 100).toFixed(2)) : 0
      return (
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={t('growthReport.totalReads')} value={totalReads} prefix={<EyeOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={t('growthReport.totalClicks')} value={totalClicks} prefix={<LinkOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={t('growthReport.totalFollows')} value={totalFollows} prefix={<HeartOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={t('growthReport.clickRate')} value={clickRate} suffix="%" prefix={<LineChartOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={t('growthReport.followRate')} value={followRate} suffix="%" prefix={<FundProjectionScreenOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={t('growthReport.unitCount')} value={rows.length} prefix={<ApartmentOutlined />} /></Card></Col>
        </Row>
      )
    } else {
      const totalFollows = rows.reduce((s, r) => s + r.follows, 0)
      const totalUsers = rows.reduce((s, r) => s + r.users, 0)
      const totalMembers = rows.reduce((s, r) => s + r.members, 0)
      const userRate = totalFollows > 0 ? Number(((totalUsers / totalFollows) * 100).toFixed(2)) : 0
      const memberRate = totalUsers > 0 ? Number(((totalMembers / totalUsers) * 100).toFixed(2)) : 0
      const totalMemberRate = totalFollows > 0 ? Number(((totalMembers / totalFollows) * 100).toFixed(2)) : 0
      return (
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={t('growthReport.totalFollows')} value={totalFollows} prefix={<HeartOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={t('growthReport.totalUsers')} value={totalUsers} prefix={<UserOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={t('growthReport.totalMembers')} value={totalMembers} prefix={<CrownOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={t('growthReport.colUserRate')} value={userRate} suffix="%" prefix={<LineChartOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={t('growthReport.colMemberRate')} value={memberRate} suffix="%" prefix={<FundProjectionScreenOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={t('growthReport.colTotalMemberRate')} value={totalMemberRate} suffix="%" prefix={<TeamOutlined />} /></Card></Col>
        </Row>
      )
    }
  }

  const renderChainProgress = (rows: ReportRow[], mode: 'promo' | 'ops') => {
    if (mode === 'promo') {
      const totalReads = rows.reduce((s, r) => s + r.reads, 0)
      const totalClicks = rows.reduce((s, r) => s + r.clicks, 0)
      const totalFollows = rows.reduce((s, r) => s + r.follows, 0)
      const clickRate = totalReads > 0 ? Number(((totalClicks / totalReads) * 100).toFixed(2)) : 0
      const followRate = totalClicks > 0 ? Number(((totalFollows / totalClicks) * 100).toFixed(2)) : 0
      return (
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>{t('growthReport.readToClick')}</span><span>{clickRate}%</span>
            </div>
            <Progress percent={clickRate} showInfo={false} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>{t('growthReport.clickToFollow')}</span><span>{followRate}%</span>
            </div>
            <Progress percent={followRate} showInfo={false} />
          </div>
        </div>
      )
    } else {
      const totalFollows = rows.reduce((s, r) => s + r.follows, 0)
      const totalUsers = rows.reduce((s, r) => s + r.users, 0)
      const totalMembers = rows.reduce((s, r) => s + r.members, 0)
      const userRate = totalFollows > 0 ? Number(((totalUsers / totalFollows) * 100).toFixed(2)) : 0
      const memberRate = totalUsers > 0 ? Number(((totalMembers / totalUsers) * 100).toFixed(2)) : 0
      return (
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>{t('growthReport.followToUser')}</span><span>{userRate}%</span>
            </div>
            <Progress percent={userRate} showInfo={false} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>{t('growthReport.userToMember')}</span><span>{memberRate}%</span>
            </div>
            <Progress percent={memberRate} showInfo={false} />
          </div>
        </div>
      )
    }
  }

  const renderPanel = (
    rows: ReportRow[],
    columns: any[],
    mode: 'promo' | 'ops',
    summaryTitle: string,
    detailTitle: string,
    chainTitle: string,
    descKey: string,
  ) => (
    <>
      <Card title={summaryTitle} style={{ marginBottom: 16 }}>
        {renderSummaryCards(rows, mode)}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} md={12}>
            <Card size="small" title={chainTitle}>
              {renderChainProgress(rows, mode)}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title={t('growthReport.descTitle')}>
              <div style={{ color: '#666', lineHeight: 1.9 }}>{t(descKey as any)}</div>
            </Card>
          </Col>
        </Row>
      </Card>
      <Card title={detailTitle}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无数据，请在活动/卡券中配置目标字段" /> }}
          scroll={{ x: true }}
        />
      </Card>
    </>
  )

  const currentTitle =
    activeTab === 'promotion'
      ? t('growthReport.promotionTitle')
      : activeTab === 'operation'
        ? t('growthReport.operationTitle')
        : t('growthReport.jointTitle')

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{currentTitle}</h2>
        <RangePicker onChange={(v: any) => setDateRange(v)} />
        <Select
          value={department} onChange={setDepartment} style={{ width: 180 }}
          options={[
            { value: 'all', label: t('growthReport.deptAll') },
            { value: '互联网推广部', label: t('growthReport.deptInternet') },
            { value: '运营部', label: t('growthReport.deptOps') },
            { value: '联合活动', label: t('growthReport.deptJoint') },
          ]}
        />
        <Select
          value={unitType} onChange={setUnitType} style={{ width: 160 }}
          options={[
            { value: 'all', label: t('growthReport.unitAll') },
            { value: '活动', label: t('growthReport.unitActivity') },
            { value: '卡券', label: t('growthReport.unitCoupon') },
          ]}
        />
        <Input
          value={keyword} onChange={(e) => setKeyword(e.target.value)}
          placeholder={t('growthReport.searchPlaceholder')}
          prefix={<SearchOutlined />}
          style={{ width: 220 }}
        />
        <Button type="primary" icon={<ReloadOutlined />} onClick={load} loading={loading}>
          {t('growthReport.refreshBtn')}
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'promotion',
              label: (
                <span>
                  {t('growthReport.tabPromotion')}
                  <Tag color="blue" style={{ marginLeft: 8 }}>{filteredPromotion.length} 条</Tag>
                </span>
              ),
              children: renderPanel(
                filteredPromotion, promotionColumns, 'promo',
                t('growthReport.promotionSummaryTitle'),
                t('growthReport.promotionDetailTitle'),
                t('growthReport.promotionChainTitle'),
                'growthReport.promotionDesc',
              ),
            },
            {
              key: 'operation',
              label: (
                <span>
                  {t('growthReport.tabOperation')}
                  <Tag color="green" style={{ marginLeft: 8 }}>{(filteredOnsite.length + filteredOa.length)} 条</Tag>
                </span>
              ),
              children: (
                <Tabs
                  activeKey={operationSubTab}
                  onChange={setOperationSubTab}
                  items={[
                    {
                      key: 'onsite',
                      label: t('growthReport.onsiteLabel'),
                      children: renderPanel(
                        filteredOnsite, operationColumns, 'ops',
                        t('growthReport.onsiteLabel'),
                        t('growthReport.promotionDetailTitle'),
                        t('growthReport.onsiteLabel'),
                        'growthReport.onsiteDesc',
                      ),
                    },
                    {
                      key: 'oa',
                      label: t('growthReport.oaLabel'),
                      children: renderPanel(
                        filteredOa, operationColumns, 'ops',
                        t('growthReport.oaLabel'),
                        t('growthReport.promotionDetailTitle'),
                        t('growthReport.oaLabel'),
                        'growthReport.oaDesc',
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'joint',
              label: (
                <span>
                  {t('growthReport.tabJoint')}
                  <Tag color="purple" style={{ marginLeft: 8 }}>{filteredJoint.length} 条</Tag>
                </span>
              ),
              children: renderPanel(
                filteredJoint, operationColumns, 'ops',
                t('growthReport.jointSummaryTitle'),
                t('growthReport.jointDetailTitle'),
                t('growthReport.jointChainTitle'),
                'growthReport.jointDesc1',
              ),
            },
          ]}
        />
      )}
    </div>
  )
}
