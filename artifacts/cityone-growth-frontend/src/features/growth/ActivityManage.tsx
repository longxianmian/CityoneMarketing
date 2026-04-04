import React, { useMemo, useState } from 'react'
import {
  Card,
  Table,
  Input,
  Button,
  Space,
  Tag,
  Row,
  Col,
  Modal,
  Form,
  message,
  Select,
  DatePicker,
  Tabs,
  Statistic,
  Divider,
  Switch,
  InputNumber,
  Tooltip,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  ShareAltOutlined,
  TrophyOutlined,
  TeamOutlined,
  UserOutlined,
  CrownOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  FireOutlined,
  GiftOutlined,
  StarOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import SharePromoModal from '../../components/SharePromoModal'
import MediaUploadField from '../../components/MediaUploadField'
import dayjs from 'dayjs'

const goalOptions = [
  { value: '拉新', label: '拉新' },
  { value: '促关注', label: '促关注' },
  { value: '转用户', label: '转用户' },
  { value: '转会员', label: '转会员' },
  { value: '复购', label: '复购' },
  { value: '召回', label: '召回' },
  { value: '联合活动', label: '联合活动' },
]

const activityTypeOptions = [
  { value: 'general', label: '普通活动', color: 'default' },
  { value: 'lucky_wheel', label: '大转盘', color: 'orange' },
  { value: 'scratch_card', label: '刮刮卡', color: 'blue' },
  { value: 'thai_fortune_draw', label: '泰式祈福抽签', color: 'purple' },
]

const modeOptions = [
  { value: 'acquire', label: '拉新' },
  { value: 'convert', label: '转化' },
  { value: 'mixed', label: '混合' },
]

const departmentOptions = [
  { value: '互联网推广部', label: '互联网推广部' },
  { value: '运营部', label: '运营部' },
  { value: '联合活动', label: '联合活动' },
]

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  active: { label: '进行中', color: 'green' },
  ended: { label: '已结束', color: 'red' },
}

const mockCoupons = [
  '关注 LINE 领 15 分钟券',
  '30分钟免费时长券',
  '首借免单券',
  '沉睡用户唤醒券',
  '线上领券 + 到站核销券',
]

const mockActivities = [
  {
    id: 1,
    name: '扫码抽奖赢免费时长',
    subTitle: '新用户扫码参与，完成关注即可抽奖',
    goal: '拉新',
    department: '互联网推广部',
    ownerDept: '互联网推广部',
    partnerDept: '--',
    couponName: '关注 LINE 领 15 分钟券',
    status: 'active',
    followCount: 2110,
    userCount: 980,
    memberCount: 456,
    start_at: '2026-03-01 00:00:00',
    end_at: '2026-03-31 23:59:59',
    description: '通过活动页承接流量，促进关注与首次参与。',
    highlights: '扫码即参与、抽奖激励强、适合线上快速扩散。',
    participationGuide: '扫码进入活动页 → 关注 OA → 点击抽奖 → 领取奖励。',
    rewardGuide: '奖品包含免费时长券、优惠券等奖励。',
    noticeText: '每位用户每日限参与一次，奖励以系统发放为准。',
    coverImage: '',
    coverVideo: '',
  },
  {
    id: 2,
    name: '站点首借免单',
    subTitle: '现场引导借电，推动新关注用户完成首次使用',
    goal: '转用户',
    department: '运营部',
    ownerDept: '运营部',
    partnerDept: '--',
    couponName: '首借免单券',
    status: 'active',
    followCount: 1320,
    userCount: 860,
    memberCount: 402,
    start_at: '2026-03-05 00:00:00',
    end_at: '2026-03-25 23:59:59',
    description: '现场引导关注后完成首次借电，推动转用户。',
    highlights: '适合站点现场海报与设备二维码联动承接。',
    participationGuide: '到站扫码 → 关注 OA → 借电成功 → 首借免单。',
    rewardGuide: '完成首次借电后自动生效免单优惠。',
    noticeText: '同一用户仅限首次借电享受本活动。',
    coverImage: '',
    coverVideo: '',
  },
  {
    id: 3,
    name: 'OA 唤醒返券活动',
    subTitle: '针对沉睡粉丝发券召回',
    goal: '召回',
    department: '运营部',
    ownerDept: '运营部',
    partnerDept: '--',
    couponName: '沉睡用户唤醒券',
    status: 'draft',
    followCount: 760,
    userCount: 438,
    memberCount: 186,
    start_at: '2026-03-10 00:00:00',
    end_at: '2026-03-20 23:59:59',
    description: '针对沉睡用户进行 OA 消息召回，发券促活。',
    highlights: '适合 OA 运营复购与召回场景。',
    participationGuide: '接收消息 → 点击活动页 → 领取卡券 → 到站借电。',
    rewardGuide: '用户可领取专属唤醒券并在线下核销。',
    noticeText: '仅限收到消息的目标人群参与。',
    coverImage: '',
    coverVideo: '',
  },
  {
    id: 4,
    name: '线上引流 + 线下首借转会员',
    subTitle: '联合玩法，线上引流线下承接',
    goal: '联合活动',
    department: '联合活动',
    ownerDept: '互联网推广部',
    partnerDept: '运营部',
    couponName: '线上领券 + 到站核销券',
    status: 'active',
    followCount: 1120,
    userCount: 760,
    memberCount: 356,
    start_at: '2026-03-03 00:00:00',
    end_at: '2026-03-30 23:59:59',
    description: '线上负责引流，线下负责承接转用户与转会员。',
    highlights: '最适合联合活动打法，便于归因与复盘。',
    participationGuide: '线上活动点击 → 关注 OA → 线下到站核销 → 首借转会员。',
    rewardGuide: '线上领取卡券，线下使用后沉淀为会员。',
    noticeText: '线上与线下数据统一归因到联合活动。',
    coverImage: '',
    coverVideo: '',
  },
  {
    id: 5,
    name: '关注 LINE 领券活动',
    subTitle: '低门槛关注活动',
    goal: '促关注',
    department: '互联网推广部',
    ownerDept: '互联网推广部',
    partnerDept: '--',
    couponName: '关注 LINE 领 15 分钟券',
    status: 'ended',
    followCount: 1620,
    userCount: 762,
    memberCount: 318,
    start_at: '2026-02-10 00:00:00',
    end_at: '2026-02-28 23:59:59',
    description: '内容触达后引导关注 LINE OA 并领券。',
    highlights: '目标明确，适合做拉关注承接页。',
    participationGuide: '点击活动页 → 关注 LINE → 自动领券。',
    rewardGuide: '成功关注后发放 15 分钟免费券。',
    noticeText: '卡券有效期以活动配置为准。',
    coverImage: '',
    coverVideo: '',
  },
]

export default function ActivityManage() {
  const nav = useNavigate()
  const [data, setData] = useState<any[]>(mockActivities)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [goalFilter, setGoalFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [modeFilter, setModeFilter] = useState<string | undefined>(undefined)
  const [requireFollowFilter, setRequireFollowFilter] = useState<boolean | undefined>(undefined)
  const [autoJoinFilter, setAutoJoinFilter] = useState<boolean | undefined>(undefined)
  const [formVisible, setFormVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [form] = Form.useForm()
  const [shareRecord, setShareRecord] = useState<any | null>(null)
  const [coverImage, setCoverImage] = useState('')
  const [coverVideo, setCoverVideo] = useState('')

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const okKeyword =
        !keyword.trim() ||
        item.name.includes(keyword.trim()) ||
        (item.couponName || '').includes(keyword.trim()) ||
        (item.subTitle || '').includes(keyword.trim())
      const okStatus = !statusFilter || item.status === statusFilter
      const okGoal = goalFilter === 'all' || item.goal === goalFilter
      const okType = !typeFilter || (item.activityType || 'general') === typeFilter
      const okMode = !modeFilter || item.mode === modeFilter
      const okRequireFollow = requireFollowFilter === undefined || item.requireFollow === requireFollowFilter
      const okAutoJoin = autoJoinFilter === undefined || item.autoJoin === autoJoinFilter
      return okKeyword && okStatus && okGoal && okType && okMode && okRequireFollow && okAutoJoin
    })
  }, [data, keyword, statusFilter, goalFilter, typeFilter, modeFilter, requireFollowFilter, autoJoinFilter])

  const activeCount = data.filter((i) => i.status === 'active').length
  const draftCount = data.filter((i) => i.status === 'draft').length
  const endedCount = data.filter((i) => i.status === 'ended').length
  const totalFollow = data.reduce((sum, item) => sum + item.followCount, 0)
  const totalUsers = data.reduce((sum, item) => sum + item.userCount, 0)
  const totalMembers = data.reduce((sum, item) => sum + item.memberCount, 0)

  const groupedByGoal = useMemo(() => {
    const groups: Record<string, any[]> = {
      拉新: [],
      促关注: [],
      转用户: [],
      转会员: [],
      复购: [],
      召回: [],
      联合活动: [],
    }
    filteredData.forEach((item) => {
      if (!groups[item.goal]) groups[item.goal] = []
      groups[item.goal].push(item)
    })
    return groups
  }, [filteredData])

  const handleSearch = () => {}

  const handleReset = () => {
    setKeyword('')
    setStatusFilter(undefined)
    setGoalFilter('all')
    setTypeFilter(undefined)
    setModeFilter(undefined)
    setRequireFollowFilter(undefined)
    setAutoJoinFilter(undefined)
  }

  const handleAdd = () => {
    setIsEdit(false)
    setEditingRecord(null)
    form.resetFields()
    setCoverImage('')
    setCoverVideo('')
    setFormVisible(true)
  }

  const handleEdit = (record: any) => {
    setIsEdit(true)
    setEditingRecord(record)
    form.setFieldsValue({
      ...record,
      dateRange:
        record.start_at && record.end_at
          ? [dayjs(record.start_at), dayjs(record.end_at)]
          : undefined,
    })
    setCoverImage(record.coverImage || '')
    setCoverVideo(record.coverVideo || '')
    setFormVisible(true)
  }

  const handleToggle = (record: any) => {
    const nextStatus =
      record.status === 'active'
        ? 'draft'
        : record.status === 'draft'
          ? 'active'
          : 'active'

    setData((prev) =>
      prev.map((item) =>
        item.id === record.id ? { ...item, status: nextStatus } : item
      )
    )
    message.success('活动状态已更新')
  }

  const handleFormOk = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        start_at: values.dateRange?.[0]?.format('YYYY-MM-DD HH:mm:ss'),
        end_at: values.dateRange?.[1]?.format('YYYY-MM-DD HH:mm:ss'),
        coverImage,
        coverVideo,
      }
      delete payload.dateRange

      if (isEdit && editingRecord) {
        setData((prev) =>
          prev.map((item) =>
            item.id === editingRecord.id
              ? {
                  ...item,
                  ...payload,
                }
              : item
          )
        )
        message.success('活动修改成功')
      } else {
        setData((prev) => [
          {
            id: Date.now(),
            ...payload,
            followCount: 0,
            userCount: 0,
            memberCount: 0,
            status: payload.status || 'draft',
          },
          ...prev,
        ])
        message.success('活动创建成功')
      }

      setFormVisible(false)
    } catch (e) {}
  }

  const columns = [
    {
      title: '活动名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (v: string, row: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ marginTop: 4, color: '#888', fontSize: 12 }}>{row.subTitle || '--'}</div>
        </div>
      ),
    },
    {
      title: '活动类型',
      dataIndex: 'activityType',
      key: 'activityType',
      width: 120,
      render: (v: string) => {
        const t = activityTypeOptions.find(x => x.value === (v || 'general'))
        return t ? <Tag color={t.color}>{t.label}</Tag> : <Tag>{v || '普通活动'}</Tag>
      },
    },
    {
      title: '使用模式',
      dataIndex: 'mode',
      key: 'mode',
      width: 90,
      render: (v: string) => modeOptions.find(x => x.value === v)?.label || '--',
    },
    {
      title: '活动目标',
      dataIndex: 'goal',
      key: 'goal',
      width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '归属部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
    },
    {
      title: '主责部门',
      dataIndex: 'ownerDept',
      key: 'ownerDept',
      width: 120,
    },
    {
      title: '协同部门',
      dataIndex: 'partnerDept',
      key: 'partnerDept',
      width: 120,
    },
    {
      title: '绑定卡券',
      dataIndex: 'couponName',
      key: 'couponName',
      width: 160,
      render: (v: string) => v || '--',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const s = statusMap[v]
        return s ? <Tag color={s.color}>{s.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: '关注数',
      dataIndex: 'followCount',
      key: 'followCount',
      width: 90,
    },
    {
      title: '用户数',
      dataIndex: 'userCount',
      key: 'userCount',
      width: 90,
    },
    {
      title: '会员数',
      dataIndex: 'memberCount',
      key: 'memberCount',
      width: 90,
      render: (v: number) => <span style={{ fontWeight: 600, color: '#722ed1' }}>{v}</span>,
    },
    {
      title: '活动时间',
      key: 'time',
      width: 220,
      render: (_: any, r: any) =>
        r.start_at && r.end_at
          ? `${dayjs(r.start_at).format('MM/DD HH:mm')} ~ ${dayjs(r.end_at).format('MM/DD HH:mm')}`
          : '--',
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      fixed: 'right' as const,
      render: (_: any, record: any) => {
        const aType = record.activityType || 'general'
        const isInteractive = ['lucky_wheel', 'scratch_card', 'thai_fortune_draw'].includes(aType)
        const isFortune = aType === 'thai_fortune_draw'
        return (
          <Space size="small" wrap>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
            <Button type="link" size="small" onClick={() => handleToggle(record)}>
              {record.status === 'active' ? '下线' : '上线'}
            </Button>
            <Button type="link" size="small" icon={<ShareAltOutlined />} onClick={() => setShareRecord(record)} style={{ color: '#06C755' }}>推广</Button>
            {isInteractive && !isFortune && (
              <Tooltip title="管理奖池">
                <Button type="link" size="small" icon={<GiftOutlined />} onClick={() => nav(`/admin/growth/prize-pool?activityId=${record.id}`)} style={{ color: '#fa8c16' }}>奖池</Button>
              </Tooltip>
            )}
            {isFortune && (
              <Tooltip title="管理签池">
                <Button type="link" size="small" icon={<StarOutlined />} onClick={() => nav(`/admin/growth/fortune-sign?activityId=${record.id}`)} style={{ color: '#722ed1' }}>签池</Button>
              </Tooltip>
            )}
            {isInteractive && (
              <>
                <Tooltip title="互动记录">
                  <Button type="link" size="small" icon={<FireOutlined />} onClick={() => nav(`/admin/growth/interaction-records?activityId=${record.id}`)} style={{ color: '#1677ff' }}>记录</Button>
                </Tooltip>
                <Tooltip title="次数账户">
                  <Button type="link" size="small" icon={<UserOutlined />} onClick={() => nav(`/admin/growth/user-chances?activityId=${record.id}`)}>次数</Button>
                </Tooltip>
              </>
            )}
          </Space>
        )
      },
    },
  ]

  const goalTabs = [
    {
      key: 'all',
      label: '全部活动',
      children: (
        <Table rowKey="id" columns={columns} dataSource={filteredData} pagination={false} scroll={{ x: 1500 }} />
      ),
    },
    ...goalOptions.map((goal) => ({
      key: goal.value,
      label: `${goal.label}（${groupedByGoal[goal.value]?.length || 0}）`,
      children: (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={groupedByGoal[goal.value] || []}
          pagination={false}
          scroll={{ x: 1500 }}
        />
      ),
    })),
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card title="活动总览" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={4}>
            <Card><Statistic title="进行中活动" value={activeCount} prefix={<TrophyOutlined />} /></Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card><Statistic title="草稿活动" value={draftCount} prefix={<EditOutlined />} /></Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card><Statistic title="已结束活动" value={endedCount} prefix={<ReloadOutlined />} /></Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card><Statistic title="活动带来关注数" value={totalFollow} prefix={<TeamOutlined />} /></Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card><Statistic title="活动带来用户数" value={totalUsers} prefix={<UserOutlined />} /></Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card><Statistic title="活动带来会员数" value={totalMembers} prefix={<CrownOutlined />} /></Card>
          </Col>
        </Row>
      </Card>

      <Card title="活动筛选与操作" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="搜索活动名称/卡券名称"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="状态"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              allowClear
              style={{ width: '100%' }}
              options={Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="活动类型"
              value={typeFilter}
              onChange={setTypeFilter}
              allowClear
              style={{ width: '100%' }}
              options={activityTypeOptions}
            />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Select
              placeholder="使用模式"
              value={modeFilter}
              onChange={setModeFilter}
              allowClear
              style={{ width: '100%' }}
              options={modeOptions}
            />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Select
              placeholder="需先关注OA"
              value={requireFollowFilter}
              onChange={v => setRequireFollowFilter(v)}
              allowClear
              style={{ width: '100%' }}
              options={[{ value: true, label: '需关注' }, { value: false, label: '无需关注' }]}
            />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Select
              placeholder="关注后自动参与"
              value={autoJoinFilter}
              onChange={v => setAutoJoinFilter(v)}
              allowClear
              style={{ width: '100%' }}
              options={[{ value: true, label: '自动参与' }, { value: false, label: '手动参与' }]}
            />
          </Col>
          <Col xs={24} sm={12} md={7}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>创建活动</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title="活动分类管理">
        <Tabs items={goalTabs} />
      </Card>

      <SharePromoModal
        open={!!shareRecord}
        onClose={() => setShareRecord(null)}
        type="activity"
        id={shareRecord?.id}
        name={shareRecord?.name || ''}
      />

      <Modal
        title={isEdit ? '编辑活动' : '创建活动'}
        open={formVisible}
        onOk={handleFormOk}
        onCancel={() => setFormVisible(false)}
        width={860}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left" orientationMargin={0}>
            <span style={{ fontSize: 13, color: '#555' }}>活动展示素材</span>
          </Divider>

          <Form.Item name="name" label="活动名称" rules={[{ required: true, message: '请输入活动名称' }]}>
            <Input placeholder="请输入活动名称" />
          </Form.Item>

          <Form.Item name="subTitle" label="活动副标题">
            <Input placeholder="请输入活动副标题，用于活动页展示" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label={<span><PictureOutlined style={{ marginRight: 4 }} />活动封面图</span>} style={{ marginBottom: 8 }}>
                <MediaUploadField
                  type="image"
                  value={coverImage}
                  onChange={setCoverImage}
                  placeholder="上传活动封面图"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label={<span><VideoCameraOutlined style={{ marginRight: 4 }} />活动宣传视频</span>} style={{ marginBottom: 8 }}>
                <MediaUploadField
                  type="video"
                  value={coverVideo}
                  onChange={setCoverVideo}
                  placeholder="上传活动宣传视频"
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" orientationMargin={0}>
            <span style={{ fontSize: 13, color: '#555' }}>活动内容配置</span>
          </Divider>

          <Form.Item name="description" label="活动说明">
            <Input.TextArea rows={3} placeholder="请输入活动整体说明" />
          </Form.Item>

          <Form.Item name="highlights" label="活动亮点">
            <Input.TextArea rows={2} placeholder="请输入活动亮点，例如：低门槛参与、到站可核销、适合社媒传播" />
          </Form.Item>

          <Form.Item name="participationGuide" label="参与说明">
            <Input.TextArea rows={2} placeholder="请输入参与路径，例如：扫码进入活动页 → 关注 OA → 领取奖励" />
          </Form.Item>

          <Form.Item name="rewardGuide" label="奖励说明">
            <Input.TextArea rows={2} placeholder="请输入奖励发放与使用说明" />
          </Form.Item>

          <Form.Item name="noticeText" label="注意事项">
            <Input.TextArea rows={2} placeholder="请输入活动注意事项，例如次数限制、有效期、参与条件" />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0}>
            <span style={{ fontSize: 13, color: '#555' }}>活动业务配置</span>
          </Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="goal" label="活动目标" rules={[{ required: true, message: '请选择活动目标' }]}>
                <Select options={goalOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="department" label="归属部门" rules={[{ required: true, message: '请选择归属部门' }]}>
                <Select options={departmentOptions} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="ownerDept" label="主责部门" rules={[{ required: true, message: '请选择主责部门' }]}>
                <Select options={departmentOptions.filter((d) => d.value !== '联合活动')} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="partnerDept" label="协同部门">
                <Select
                  allowClear
                  options={[
                    { value: '--', label: '无' },
                    ...departmentOptions.filter((d) => d.value !== '联合活动'),
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="activityType" label="活动类型" initialValue="general">
                <Select options={activityTypeOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="mode" label="使用模式">
                <Select allowClear options={modeOptions} placeholder="选择使用模式" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="status" label="活动状态" initialValue="draft">
                <Select
                  options={[
                    { value: 'draft', label: '草稿' },
                    { value: 'active', label: '进行中' },
                    { value: 'ended', label: '已结束' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="requireFollow" label="需先关注OA才可参与" valuePropName="checked" initialValue={false}>
                <Switch checkedChildren="需关注" unCheckedChildren="无需关注" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="autoJoin" label="关注后自动参与" valuePropName="checked" initialValue={false}>
                <Switch checkedChildren="自动参与" unCheckedChildren="手动参与" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="couponName" label="绑定卡券">
                <Select
                  allowClear
                  showSearch
                  options={mockCoupons.map((item) => ({ value: item, label: item }))}
                  placeholder="选择活动绑定卡券"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="dateRange" label="活动时间">
                <DatePicker.RangePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item noStyle shouldUpdate={(p, c) => p.activityType !== c.activityType}>
            {({ getFieldValue }) => {
              const aType = getFieldValue('activityType')
              if (aType === 'lucky_wheel') return (
                <>
                  <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#fa8c16' }}>🎡 大转盘互动配置</span></Divider>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item name="wheelSegments" label="转盘分格数">
                        <InputNumber min={4} max={12} step={2} style={{ width: '100%' }} placeholder="默认 8 格" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="defaultChances" label="默认赠送次数">
                        <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder="每用户默认次数" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="spinResultDelay" label="转盘动画时长（秒）">
                    <InputNumber min={2} max={10} step={0.5} style={{ width: '100%' }} placeholder="默认 4 秒" />
                  </Form.Item>
                </>
              )
              if (aType === 'scratch_card') return (
                <>
                  <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#1677ff' }}>🎴 刮刮卡互动配置</span></Divider>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item name="defaultChances" label="默认赠送次数">
                        <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder="每用户默认次数" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="scratchRevealThreshold" label="刮开阈值（%）">
                        <InputNumber min={30} max={90} style={{ width: '100%' }} placeholder="默认 60%" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )
              if (aType === 'thai_fortune_draw') return (
                <>
                  <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#722ed1' }}>🏮 泰式祈福抽签配置</span></Divider>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item name="defaultChances" label="默认赠送次数">
                        <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder="每用户默认次数" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="allowMultipleDraws" label="允许多次求签" valuePropName="checked" initialValue={false}>
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="defaultThemeId" label="默认主题ID">
                    <Input placeholder="留空则用户可自选主题" />
                  </Form.Item>
                </>
              )
              return null
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
