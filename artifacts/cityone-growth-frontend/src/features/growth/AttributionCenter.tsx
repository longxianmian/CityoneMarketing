import React, { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Table,
  Row,
  Col,
  Statistic,
  Select,
  Tag,
  Tabs,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Progress,
  Badge,
  DatePicker,
} from 'antd'
import {
  FunnelPlotOutlined,
  EyeOutlined,
  UserAddOutlined,
  ShoppingCartOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  BarChartOutlined,
  SettingOutlined,
  SearchOutlined,
  CrownOutlined,
  TeamOutlined,
  ApartmentOutlined,
} from '@ant-design/icons'
import request from '../../api/request'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'

const { RangePicker } = DatePicker

const getChannelMeta = (at: (key: string) => string): Record<string, { color: string; label: string }> => ({
  line: { color: '#06C755', label: 'LINE' },
  tiktok: { color: '#010101', label: 'TikTok' },
  facebook: { color: '#1877F2', label: 'Facebook' },
  instagram: { color: '#E1306C', label: 'Instagram' },
  youtube: { color: '#FF0000', label: 'YouTube' },
  google: { color: '#4285F4', label: 'Google' },
  direct: { color: '#8c8c8c', label: at('channelMeta.direct') },
})

const channelTag = (ch: string, at: (key: string) => string) => {
  const channelMeta = getChannelMeta(at)
  const m = channelMeta[ch?.toLowerCase()] || { color: '#aaa', label: ch || at('channelMeta.direct') }
  return <Tag color={m.color} style={{ fontWeight: 600 }}>{m.label}</Tag>
}

const getSourceTypes = (at: (key: string) => string) => [
  { value: 'device', label: at('sourceTypes.device') },
  { value: 'shop', label: at('sourceTypes.shop') },
  { value: 'poster', label: at('sourceTypes.poster') },
  { value: 'online', label: at('sourceTypes.online') },
  { value: 'social', label: at('sourceTypes.social') },
]

function SourceConfigSection() {
  const { t } = useI18n('admin')
  const at = (key: string) => t(`admin.attribution.${key}`)
  const sourceTypes = getSourceTypes(at)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [src, camp] = await Promise.all([
        request.get('/growth/source/list'),
        request.get('/growth/activity/list'),
      ])
      setRows(src.data.data || [])
      setCampaigns(
        (camp.data.data?.rows || camp.data.data || []).filter(
          (c: any) => c.status === 'active' || c.status === 'draft'
        )
      )
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleSave = async () => {
    try {
      const vals = await form.validateFields()
      await request.post('/growth/source/bind', { ...vals, id: editing?.id })
      message.success(at('sourceConfig.saveSuccess'))
      setOpen(false)
      load()
    } catch (e: any) {
      if (e?.response?.data?.msg) message.error(e.response.data.msg)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await request.post('/growth/source/delete', { id })
      message.success(at('sourceConfig.deleteSuccess'))
      load()
    } catch (e) {
      message.error(at('sourceConfig.deleteError'))
    }
  }

  const openEdit = (row?: any) => {
    setEditing(row || null)
    form.setFieldsValue(
      row
        ? {
            sourceType: row.source_type,
            sourceId: row.source_id,
            campaignId: row.campaign_id,
          }
        : {}
    )
    setOpen(true)
  }

  const cols = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: at('detail.colSourceType'),
      dataIndex: 'source_type',
      render: (v: string) => {
        const st = sourceTypes.find((s) => s.value === v)
        return <Tag color="blue">{st?.label || v}</Tag>
      },
    },
    { title: at('sourceConfig.sourceIdCol'), dataIndex: 'source_id' },
    { title: at('sourceConfig.campaignCol'), dataIndex: 'campaign_name', render: (v: string) => v || '--' },
    {
      title: at('sourceConfig.statusCol'),
      dataIndex: 'status',
      render: (v: number) => <Badge status={v === 1 ? 'success' : 'default'} text={v === 1 ? at('sourceConfig.statusEnabled') : at('sourceConfig.statusDisabled')} />,
    },
    {
      title: at('sourceConfig.actionsCol'),
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>{at('sourceConfig.edit')}</Button>
          <Popconfirm title={at('sourceConfig.confirmDelete')} onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>{at('sourceConfig.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Card
        size="small"
        style={{ marginBottom: 12, background: '#FFFBEB', border: '1px solid #FDE68A' }}
      >
        <div style={{ fontSize: 12, color: '#92400E' }}>
          💡 <strong>{at('sourceConfig.introTitle')}</strong>：{at('sourceConfig.introDesc')}
        </div>
      </Card>

      <Card
        size="small"
        title={<span><LinkOutlined /> {at('sourceConfig.cardTitle')}</span>}
        extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openEdit()}>{at('sourceConfig.addButton')}</Button>}
      >
        <Table dataSource={rows} columns={cols} rowKey="id" loading={loading} size="small" pagination={false} />
      </Card>

      <Modal
        title={editing ? at('sourceConfig.editTitle') : at('sourceConfig.createTitle')}
        open={open}
        onOk={handleSave}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="sourceType" label={at('sourceConfig.sourceTypeLabel')} rules={[{ required: true }]}>
            <Select options={sourceTypes} />
          </Form.Item>
          <Form.Item
            name="sourceId"
            label={at('sourceConfig.sourceIdLabel')}
            rules={[{ required: true }]}
            help={at('sourceConfig.sourceIdHelp')}
          >
            <Input placeholder={at('sourceConfig.sourceIdPlaceholder')} />
          </Form.Item>
          <Form.Item name="campaignId" label={at('sourceConfig.campaignLabel')} rules={[{ required: true }]}>
            <Select
              options={campaigns.map((c: any) => ({
                value: c.id,
                label: `[${c.campaign_type || 'activity'}] ${c.name}`,
              }))}
              placeholder={at('sourceConfig.campaignPlaceholder')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default function AttributionCenter() {
  const { t } = useI18n('admin')
  const at = (key: string) => t(`admin.attribution.${key}`)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [channel, setChannel] = useState<string>('all')
  const [unitType, setUnitType] = useState<string>('all')
  const [keyword, setKeyword] = useState<string>('')

  const overview = {
    pageViews: 28630,
    clicks: 13280,
    follows: 5218,
    users: 2480,
    members: 1126,
    attributedOrders: 1392,
  }

  const attributionRows = [
    {
      key: '1',
      objectType: '活动',
      objectName: '扫码抽奖赢免费时长',
      channel: 'line',
      sourceType: 'online',
      sourceId: 'LINE-H5-001',
      pageViews: 12680,
      clicks: 6320,
      follows: 2110,
      users: 980,
      members: 456,
      attributedOrders: 688,
      ownerDept: '互联网推广部',
      partnerDept: '--',
    },
    {
      key: '2',
      objectType: '卡券',
      objectName: '关注 LINE 领 15 分钟券',
      channel: 'facebook',
      sourceType: 'online',
      sourceId: 'FB-AD-008',
      pageViews: 8230,
      clicks: 3880,
      follows: 1620,
      users: 762,
      members: 318,
      attributedOrders: 356,
      ownerDept: '互联网推广部',
      partnerDept: '--',
    },
    {
      key: '3',
      objectType: '活动',
      objectName: '站点首借免单',
      channel: 'direct',
      sourceType: 'device',
      sourceId: 'CTO20251125011',
      pageViews: 4210,
      clicks: 1850,
      follows: 920,
      users: 612,
      members: 252,
      attributedOrders: 208,
      ownerDept: '运营部',
      partnerDept: '--',
    },
    {
      key: '4',
      objectType: '卡券',
      objectName: '线上领券 + 到站核销券',
      channel: 'tiktok',
      sourceType: 'social',
      sourceId: 'TK-SHARE-020',
      pageViews: 3510,
      clicks: 1230,
      follows: 568,
      users: 314,
      members: 100,
      attributedOrders: 140,
      ownerDept: '互联网推广部',
      partnerDept: '运营部',
    },
  ]

  const filteredRows = useMemo(() => {
    return attributionRows.filter((item) => {
      const okChannel = channel === 'all' || item.channel === channel
      const okType = unitType === 'all' || item.objectType === unitType
      const okKeyword = !keyword.trim() || item.objectName.includes(keyword.trim()) || item.sourceId.includes(keyword.trim())
      return okChannel && okType && okKeyword
    })
  }, [channel, unitType, keyword])

  const activityRows = filteredRows.filter((item) => item.objectType === '活动')
  const couponRows = filteredRows.filter((item) => item.objectType === '卡券')

  const channelRows = useMemo(() => {
    const grouped: Record<string, any> = {}
    filteredRows.forEach((item) => {
      if (!grouped[item.channel]) {
        grouped[item.channel] = {
          key: item.channel,
          channel: item.channel,
          pageViews: 0,
          clicks: 0,
          follows: 0,
          users: 0,
          members: 0,
          attributedOrders: 0,
        }
      }
      grouped[item.channel].pageViews += item.pageViews
      grouped[item.channel].clicks += item.clicks
      grouped[item.channel].follows += item.follows
      grouped[item.channel].users += item.users
      grouped[item.channel].members += item.members
      grouped[item.channel].attributedOrders += item.attributedOrders
    })
    return Object.values(grouped)
  }, [filteredRows])

  const sourceRows = filteredRows.map((item) => ({
    key: item.key,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    channel: item.channel,
    objectName: item.objectName,
    pageViews: item.pageViews,
    clicks: item.clicks,
    follows: item.follows,
    users: item.users,
    members: item.members,
    attributedOrders: item.attributedOrders,
  }))

  const overviewStats = [
    { title: at('overview.pageViews'), value: overview.pageViews, icon: <EyeOutlined /> },
    { title: at('overview.clicks'), value: overview.clicks, icon: <FunnelPlotOutlined /> },
    { title: at('overview.follows'), value: overview.follows, icon: <UserAddOutlined /> },
    { title: at('overview.users'), value: overview.users, icon: <TeamOutlined /> },
    { title: at('overview.members'), value: overview.members, icon: <CrownOutlined /> },
    { title: at('overview.orders'), value: overview.attributedOrders, icon: <ShoppingCartOutlined /> },
  ]

  const overviewCols = [
    {
      title: at('detail.colObject'),
      dataIndex: 'objectName',
      key: 'objectName',
      render: (_: string, row: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.objectName}</div>
          <div style={{ marginTop: 4 }}>
            <Tag color={row.objectType === '活动' ? 'blue' : 'purple'}>{row.objectType}</Tag>
            {channelTag(row.channel, at)}
          </div>
        </div>
      ),
    },
    { title: at('detail.colSourceType'), dataIndex: 'sourceType', key: 'sourceType', render: (v: string) => <Tag>{v}</Tag> },
    { title: at('detail.colSourcePoint'), dataIndex: 'sourceId', key: 'sourceId' },
    { title: at('detail.colOwnerDept'), dataIndex: 'ownerDept', key: 'ownerDept' },
    { title: at('detail.colPartnerDept'), dataIndex: 'partnerDept', key: 'partnerDept' },
    { title: at('detail.colPageViews'), dataIndex: 'pageViews', key: 'pageViews' },
    { title: at('detail.colClicks'), dataIndex: 'clicks', key: 'clicks' },
    { title: at('detail.colFollows'), dataIndex: 'follows', key: 'follows' },
    { title: at('detail.colUsers'), dataIndex: 'users', key: 'users' },
    { title: at('detail.colMembers'), dataIndex: 'members', key: 'members' },
    { title: at('detail.colOrders'), dataIndex: 'attributedOrders', key: 'attributedOrders' },
  ]

  const channelCols = [
    {
      title: at('detail.colChannel'),
      dataIndex: 'channel',
      key: 'channel',
      render: (v: string) => channelTag(v, at),
    },
    { title: at('detail.colPageViews'), dataIndex: 'pageViews', key: 'pageViews' },
    { title: at('detail.colClicks'), dataIndex: 'clicks', key: 'clicks' },
    { title: at('detail.colFollows'), dataIndex: 'follows', key: 'follows' },
    { title: at('detail.colUsers'), dataIndex: 'users', key: 'users' },
    { title: at('detail.colMembers'), dataIndex: 'members', key: 'members' },
    { title: at('detail.colOrders'), dataIndex: 'attributedOrders', key: 'attributedOrders' },
  ]

  const sourceCols = [
    { title: at('detail.colSourceType'), dataIndex: 'sourceType', key: 'sourceType', render: (v: string) => <Tag>{v}</Tag> },
    { title: at('detail.colSourcePointCode'), dataIndex: 'sourceId', key: 'sourceId' },
    { title: at('detail.colObject'), dataIndex: 'objectName', key: 'objectName' },
    { title: at('detail.colChannel'), dataIndex: 'channel', key: 'channel', render: (v: string) => channelTag(v, at) },
    { title: at('detail.colPageViews'), dataIndex: 'pageViews', key: 'pageViews' },
    { title: at('detail.colClicks'), dataIndex: 'clicks', key: 'clicks' },
    { title: at('detail.colFollows'), dataIndex: 'follows', key: 'follows' },
    { title: at('detail.colUsers'), dataIndex: 'users', key: 'users' },
    { title: at('detail.colMembers'), dataIndex: 'members', key: 'members' },
    { title: at('detail.colOrders'), dataIndex: 'attributedOrders', key: 'attributedOrders' },
  ]

  const pageToClick = Number(((overview.clicks / overview.pageViews) * 100).toFixed(2))
  const clickToFollow = Number(((overview.follows / overview.clicks) * 100).toFixed(2))
  const followToUser = Number(((overview.users / overview.follows) * 100).toFixed(2))
  const userToMember = Number(((overview.members / overview.users) * 100).toFixed(2))

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{at('page.title')}</h2>
        <RangePicker onChange={(v: any) => setDateRange(v)} />
        <Select
          value={channel}
          onChange={setChannel}
          style={{ width: 160 }}
          options={[
            { value: 'all', label: at('page.channelAll') },
            { value: 'line', label: 'LINE' },
            { value: 'tiktok', label: 'TikTok' },
            { value: 'facebook', label: 'Facebook' },
            { value: 'direct', label: at('channelMeta.direct') },
          ]}
        />
        <Select
          value={unitType}
          onChange={setUnitType}
          style={{ width: 180 }}
          options={[
            { value: 'all', label: at('page.objectAll') },
            { value: '活动', label: at('page.activity') },
            { value: '卡券', label: at('page.coupon') },
          ]}
        />
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={at('page.searchPlaceholder')}
          prefix={<SearchOutlined />}
          style={{ width: 240 }}
        />
        <Button type="primary" icon={<BarChartOutlined />}>{at('page.refresh')}</Button>
      </div>

      <Card title={at('overview.cardTitle')} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          {overviewStats.map((item, idx) => (
            <Col xs={12} sm={8} md={4} key={idx}>
              <Card>
                <Statistic title={item.title} value={item.value} prefix={item.icon} />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title={at('funnel.cardTitle')} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>{at('funnel.pvToClick')}</span>
                  <span>{pageToClick}%</span>
                </div>
                <Progress percent={pageToClick} showInfo={false} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>{at('funnel.clickToFollow')}</span>
                  <span>{clickToFollow}%</span>
                </div>
                <Progress percent={clickToFollow} showInfo={false} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>{at('funnel.followToUser')}</span>
                  <span>{followToUser}%</span>
                </div>
                <Progress percent={followToUser} showInfo={false} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>{at('funnel.userToMember')}</span>
                  <span>{userToMember}%</span>
                </div>
                <Progress percent={userToMember} showInfo={false} />
              </div>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title={at('funnel.noteTitle')}>
              <div style={{ color: '#666', lineHeight: 1.9 }}>
                {at('funnel.note1')}<br />
                {at('funnel.note2')}<br />
                {at('funnel.note3')}
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      <Card title={at('detail.cardTitle')} style={{ marginBottom: 16 }}>
        <Tabs
          items={[
            {
              key: 'activity',
              label: <span><ApartmentOutlined /> {at('detail.tabActivity')}</span>,
              children: <Table rowKey="key" columns={overviewCols} dataSource={activityRows} pagination={false} />,
            },
            {
              key: 'coupon',
              label: <span><LinkOutlined /> {at('detail.tabCoupon')}</span>,
              children: <Table rowKey="key" columns={overviewCols} dataSource={couponRows} pagination={false} />,
            },
            {
              key: 'channel',
              label: <span><FunnelPlotOutlined /> {at('detail.tabChannel')}</span>,
              children: <Table rowKey="key" columns={channelCols} dataSource={channelRows} pagination={false} />,
            },
            {
              key: 'source',
              label: <span><SettingOutlined /> {at('detail.tabSource')}</span>,
              children: <Table rowKey="key" columns={sourceCols} dataSource={sourceRows} pagination={false} />,
            },
          ]}
        />
      </Card>

      <SourceConfigSection />
    </div>
  )
}
