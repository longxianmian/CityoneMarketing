import React, { useMemo, useState, useEffect } from 'react'
import {
  Card, Table, Input, Button, Space, Tag, Row, Col,
  Modal, Form, message, Select, DatePicker, Tabs,
  Statistic, Divider, Switch, InputNumber, Tooltip, Popconfirm,
} from 'antd'
import {
  SearchOutlined, ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  ShareAltOutlined, TrophyOutlined, TeamOutlined, UserOutlined,
  CrownOutlined, PictureOutlined, VideoCameraOutlined,
  FireOutlined, GiftOutlined, StarOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import SharePromoModal from '../../components/SharePromoModal'
import MediaUploadField from '../../components/MediaUploadField'
import MultiLangInput, { AutoTranslateButton, type MultiLangValue } from '../../components/MultiLangInput'
import dayjs from 'dayjs'
import { useI18n, pickLocalizedText } from '../../i18n'
import { getActivities, createActivity, updateActivity, deleteActivity } from '../../api/growth'
import request from '../../api/request'

const toMlObj = (v: any): MultiLangValue => {
  if (!v) return { zh: '', th: '', en: '' }
  if (typeof v === 'object') return { zh: v.zh || '', th: v.th || '', en: v.en || '' }
  return { zh: String(v), th: '', en: '' }
}

export default function ActivityManage() {
  const { t } = useI18n()
  const am = (key: string) => t(`admin.activity.${key}`)
  const nav = useNavigate()

  const goalOptions = [
    { value: '拉新', label: am('goalAcquire') },
    { value: '促关注', label: am('goalFollow') },
    { value: '转用户', label: am('goalConvertUser') },
    { value: '转会员', label: am('goalConvertMember') },
    { value: '复购', label: am('goalRepurchase') },
    { value: '召回', label: am('goalRecall') },
    { value: '联合活动', label: am('goalJoint') },
  ]

  const activityTypeOptions = [
    { value: 'general', label: am('typeGeneral'), color: 'default' },
    { value: 'lucky_wheel', label: am('typeWheel'), color: 'orange' },
    { value: 'scratch_card', label: am('typeScratch'), color: 'blue' },
    { value: 'thai_fortune_draw', label: am('typeFortune'), color: 'purple' },
  ]

  const modeOptions = [
    { value: 'acquire', label: am('modeAcquire') },
    { value: 'convert', label: am('modeConvert') },
    { value: 'mixed', label: am('modeMixed') },
  ]

  const departmentOptions = [
    { value: '互联网推广部', label: am('deptInternet') },
    { value: '运营部', label: am('deptOps') },
    { value: '联合活动', label: am('deptJoint') },
  ]

  const statusMap: Record<string, { label: string; color: string }> = {
    draft: { label: am('statusDraft'), color: 'default' },
    active: { label: am('statusActive'), color: 'green' },
    ended: { label: am('statusEnded'), color: 'red' },
  }

  const mockCoupons = [
    am('coupon1'), am('coupon2'), am('coupon3'), am('coupon4'), am('coupon5'),
  ]

  const toLocal = (a: any) => ({
    id: a.activity_id,
    name: toMlObj(a.activity_name || a.activity_title),
    subTitle: toMlObj(a.activity_subtitle),
    activityType: a.activity_type || 'general',
    description: toMlObj(a.activity_desc),
    start_at: a.start_time || '',
    end_at: a.end_time || '',
    status: a.status || 'draft',
    goal: a.goal || '',
    department: a.department || '',
    ownerDept: a.owner_dept || '',
    partnerDept: a.partner_dept || '',
    couponName: a.coupon_name || '',
    highlights: toMlObj(a.highlights),
    participationGuide: toMlObj(a.participation_guide),
    rewardGuide: toMlObj(a.reward_guide),
    noticeText: toMlObj(a.notice_text),
    coverImage: a.cover_image || '',
    coverVideo: a.cover_video || '',
    requireFollow: !!a.require_oa_follow,
    autoJoin: !!a.auto_join_after_follow,
    template_id: a.template_id || '',
    followCount: 0,
    userCount: 0,
    memberCount: 0,
  })

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadList = () => {
    setLoading(true)
    return getActivities().then(res => {
      const list: any[] = (res as any).data || []
      setData(list.map(toLocal))
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { loadList() }, [])

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
  const [gameProgramOptions, setGameProgramOptions] = useState<any[]>([])
  const [gameProgramLoading, setGameProgramLoading] = useState(false)
  const activityTypeInForm = Form.useWatch('activityType', form)

  const GAME_TYPES_SET = new Set(['lucky_wheel', 'scratch_card', 'thai_fortune_draw'])

  useEffect(() => {
    if (activityTypeInForm && GAME_TYPES_SET.has(activityTypeInForm)) {
      setGameProgramLoading(true)
      import('../../api/request').then(({ default: request }) => {
        request.get('/game-programs', { params: { type: activityTypeInForm } })
          .then((res: any) => {
            const list: any[] = (res.data as any[]) || []
            setGameProgramOptions(list.filter((p: any) => p.status === 'active').map((p: any) => ({
              value: p.id,
              label: p.name,
            })))
          })
          .catch(() => setGameProgramOptions([]))
          .finally(() => setGameProgramLoading(false))
      })
    } else {
      setGameProgramOptions([])
    }
  }, [activityTypeInForm])

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
      '拉新': [], '促关注': [], '转用户': [], '转会员': [], '复购': [], '召回': [], '联合活动': [],
    }
    filteredData.forEach((item) => {
      if (!groups[item.goal]) groups[item.goal] = []
      groups[item.goal].push(item)
    })
    return groups
  }, [filteredData])

  const handleReset = () => {
    setKeyword(''); setStatusFilter(undefined); setGoalFilter('all')
    setTypeFilter(undefined); setModeFilter(undefined)
    setRequireFollowFilter(undefined); setAutoJoinFilter(undefined)
  }

  const handleAdd = () => {
    setIsEdit(false); setEditingRecord(null)
    form.resetFields(); setCoverImage(''); setCoverVideo('')
    setFormVisible(true)
  }

  const handleEdit = (record: any) => {
    setIsEdit(true); setEditingRecord(record)
    form.setFieldsValue({
      ...record,
      dateRange: record.start_at && record.end_at ? [dayjs(record.start_at), dayjs(record.end_at)] : undefined,
    })
    setCoverImage(record.coverImage || ''); setCoverVideo(record.coverVideo || '')
    setFormVisible(true)
  }

  const handleToggle = async (record: any) => {
    const nextStatus = record.status === 'active' ? 'draft' : 'active'
    try {
      await updateActivity(record.id, { status: nextStatus })
      message.success(am('statusUpdated'))
      loadList()
    } catch {
      message.error('状态更新失败，请重试')
    }
  }

  const handleDelete = (record: any) => {
    Modal.confirm({
      title: am('btnDelete'),
      content: am('deleteConfirm'),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteActivity(record.id)
          message.success(am('deleteSuccess'))
          loadList()
        } catch {
          message.error('删除失败，请重试')
        }
      },
    })
  }

  const handleFormOk = async () => {
    try {
      const values = await form.validateFields()
      const ensureML = (v: any): MultiLangValue =>
        v && typeof v === 'object' ? v : { zh: v || '', th: '', en: '' }

      const ML_FIELDS = ['name','subTitle','description','highlights','participationGuide','rewardGuide','noticeText'] as const
      type MlKey = typeof ML_FIELDS[number]
      const mlValues: Record<MlKey, MultiLangValue> = {} as any
      ML_FIELDS.forEach(f => { mlValues[f] = ensureML(values[f]) })

      const needsTranslation = ML_FIELDS.filter(
        f => mlValues[f].zh?.trim() && (!mlValues[f].th?.trim() || !mlValues[f].en?.trim())
      )

      if (needsTranslation.length > 0) {
        const loadingKey = 'auto-translate'
        message.loading({ content: '🌐 正在自动翻译多语言字段…', key: loadingKey, duration: 0 })
        try {
          const texts: Record<string, string> = {}
          needsTranslation.forEach(f => { texts[f] = mlValues[f].zh || '' })
          const res: any = await request.post('/api/translate', { texts, sourceLang: 'zh' })
          const result: Record<string, MultiLangValue> = res.data?.result ?? {}
          needsTranslation.forEach(f => {
            if (result[f]) mlValues[f] = result[f]
          })
          message.success({ content: '✅ 翻译完成', key: loadingKey, duration: 2 })
        } catch {
          message.warning({ content: '自动翻译失败，将以中文保存其他语言字段', key: loadingKey, duration: 3 })
          needsTranslation.forEach(f => {
            mlValues[f] = { zh: mlValues[f].zh || '', th: mlValues[f].zh || '', en: mlValues[f].zh || '' }
          })
        }
      }

      const backendPayload: Record<string, unknown> = {
        activity_name: mlValues.name,
        activity_subtitle: mlValues.subTitle,
        activity_desc: mlValues.description,
        activity_type: values.activityType || 'general',
        start_time: values.dateRange?.[0]?.format('YYYY-MM-DD HH:mm:ss') || '',
        end_time: values.dateRange?.[1]?.format('YYYY-MM-DD HH:mm:ss') || '',
        require_oa_follow: !!values.requireFollow,
        auto_join_after_follow: !!values.autoJoin,
        goal: values.goal || '',
        department: values.department || '',
        owner_dept: values.ownerDept || '',
        partner_dept: values.partnerDept || '',
        coupon_name: values.couponName || '',
        highlights: mlValues.highlights,
        participation_guide: mlValues.participationGuide,
        reward_guide: mlValues.rewardGuide,
        notice_text: mlValues.noticeText,
        cover_image: coverImage,
        cover_video: coverVideo,
        template_id: values.template_id || '',
        status: values.status || 'draft',
      }
      if (isEdit && editingRecord) {
        await updateActivity(editingRecord.id, backendPayload)
        message.success(am('editSuccess'))
      } else {
        await createActivity(backendPayload)
        message.success(am('createSuccess'))
      }
      setFormVisible(false)
      loadList()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error('保存失败，请重试')
    }
  }

  const columns = [
    {
      title: am('colName'), dataIndex: 'name', key: 'name', width: 220,
      render: (v: any, row: any) => {
        const displayName = typeof v === 'object' ? (v?.zh || v?.en || v?.th || '—') : (v || '—')
        const displaySub = typeof row.subTitle === 'object' ? (row.subTitle?.zh || '') : (row.subTitle || '')
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{displayName}</div>
            <div style={{ marginTop: 4, color: '#888', fontSize: 12 }}>{displaySub || '--'}</div>
          </div>
        )
      },
    },
    {
      title: am('colType'), dataIndex: 'activityType', key: 'activityType', width: 120,
      render: (v: string) => {
        const opt = activityTypeOptions.find(x => x.value === (v || 'general'))
        return opt ? <Tag color={opt.color}>{opt.label}</Tag> : <Tag>{v || am('typeGeneral')}</Tag>
      },
    },
    {
      title: am('colMode'), dataIndex: 'mode', key: 'mode', width: 90,
      render: (v: string) => modeOptions.find(x => x.value === v)?.label || '--',
    },
    {
      title: am('colGoal'), dataIndex: 'goal', key: 'goal', width: 100,
      render: (v: string) => <Tag color="blue">{goalOptions.find(x => x.value === v)?.label || v}</Tag>,
    },
    { title: am('colDept'), dataIndex: 'department', key: 'department', width: 120 },
    { title: am('colOwnerDept'), dataIndex: 'ownerDept', key: 'ownerDept', width: 120 },
    { title: am('colPartnerDept'), dataIndex: 'partnerDept', key: 'partnerDept', width: 120 },
    {
      title: am('colCoupon'), dataIndex: 'couponName', key: 'couponName', width: 160,
      render: (v: string) => v || '--',
    },
    {
      title: am('colStatus'), dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => {
        const s = statusMap[v]
        return s ? <Tag color={s.color}>{s.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    { title: am('colFollowCount'), dataIndex: 'followCount', key: 'followCount', width: 90 },
    { title: am('colUserCount'), dataIndex: 'userCount', key: 'userCount', width: 90 },
    {
      title: am('colMemberCount'), dataIndex: 'memberCount', key: 'memberCount', width: 90,
      render: (v: number) => <span style={{ fontWeight: 600, color: '#722ed1' }}>{v}</span>,
    },
    {
      title: am('colTime'), key: 'time', width: 220,
      render: (_: any, r: any) =>
        r.start_at && r.end_at
          ? `${dayjs(r.start_at).format('MM/DD HH:mm')} ~ ${dayjs(r.end_at).format('MM/DD HH:mm')}`
          : '--',
    },
    {
      title: am('colAction'), key: 'action', width: 300, fixed: 'right' as const,
      render: (_: any, record: any) => {
        const aType = record.activityType || 'general'
        const isInteractive = ['lucky_wheel', 'scratch_card', 'thai_fortune_draw'].includes(aType)
        const isFortune = aType === 'thai_fortune_draw'
        return (
          <Space size="small" wrap>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>{am('btnEdit')}</Button>
            <Popconfirm
              title={am('btnDelete')}
              description={am('deleteConfirm')}
              okText={am('btnDelete')}
              cancelText={am('btnCancel') || '取消'}
              okButtonProps={{ danger: true }}
              onConfirm={async () => {
                try {
                  await deleteActivity(record.id)
                  message.success(am('deleteSuccess'))
                  loadList()
                } catch {
                  message.error('删除失败，请重试')
                }
              }}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>{am('btnDelete')}</Button>
            </Popconfirm>
            <Button type="link" size="small" onClick={() => handleToggle(record)}>
              {record.status === 'active' ? am('btnOffline') : am('btnOnline')}
            </Button>
            <Button type="link" size="small" icon={<ShareAltOutlined />} onClick={() => setShareRecord(record)} style={{ color: '#06C755' }}>{am('btnPromo')}</Button>
            {isInteractive && !isFortune && (
              <Tooltip title={am('tipPrizePool')}>
                <Button type="link" size="small" icon={<GiftOutlined />} onClick={() => nav(`/admin/growth/prize-pool?activityId=${record.id}`)} style={{ color: '#fa8c16' }}>{am('btnPrizePool')}</Button>
              </Tooltip>
            )}
            {isFortune && (
              <Tooltip title={am('tipFortunePool')}>
                <Button type="link" size="small" icon={<StarOutlined />} onClick={() => nav(`/admin/growth/fortune-sign?activityId=${record.id}`)} style={{ color: '#722ed1' }}>{am('btnFortunePool')}</Button>
              </Tooltip>
            )}
            {isInteractive && (
              <>
                <Tooltip title={am('tipInteraction')}>
                  <Button type="link" size="small" icon={<FireOutlined />} onClick={() => nav(`/admin/growth/interaction-records?activityId=${record.id}`)} style={{ color: '#1677ff' }}>{am('btnInteraction')}</Button>
                </Tooltip>
                <Tooltip title={am('tipChances')}>
                  <Button type="link" size="small" icon={<UserOutlined />} onClick={() => nav(`/admin/growth/user-chances?activityId=${record.id}`)}>{am('btnChances')}</Button>
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
      label: am('tabAll'),
      children: <Table rowKey="id" columns={columns} dataSource={filteredData} pagination={false} scroll={{ x: 1500 }} loading={loading} />,
    },
    ...goalOptions.map((goal) => ({
      key: goal.value,
      label: `${goal.label}（${groupedByGoal[goal.value]?.length || 0}）`,
      children: (
        <Table rowKey="id" columns={columns} dataSource={groupedByGoal[goal.value] || []} pagination={false} scroll={{ x: 1500 }} />
      ),
    })),
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card title={am('cardOverview')} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={am('statActive')} value={activeCount} prefix={<TrophyOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={am('statDraft')} value={draftCount} prefix={<EditOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={am('statEnded')} value={endedCount} prefix={<ReloadOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={am('statFollow')} value={totalFollow} prefix={<TeamOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={am('statUser')} value={totalUsers} prefix={<UserOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title={am('statMember')} value={totalMembers} prefix={<CrownOutlined />} /></Card></Col>
        </Row>
      </Card>

      <Card title={am('cardFilter')} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input placeholder={am('searchPlaceholder')} prefix={<SearchOutlined />} value={keyword}
              onChange={(e) => setKeyword(e.target.value)} allowClear />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select placeholder={am('filterStatus')} value={statusFilter} onChange={setStatusFilter}
              allowClear style={{ width: '100%' }}
              options={Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v.label }))} />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select placeholder={am('filterType')} value={typeFilter} onChange={setTypeFilter}
              allowClear style={{ width: '100%' }} options={activityTypeOptions} />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Select placeholder={am('filterMode')} value={modeFilter} onChange={setModeFilter}
              allowClear style={{ width: '100%' }} options={modeOptions} />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Select placeholder={am('filterRequireFollow')} value={requireFollowFilter} onChange={v => setRequireFollowFilter(v)}
              allowClear style={{ width: '100%' }}
              options={[{ value: true, label: am('requireFollow') }, { value: false, label: am('noRequireFollow') }]} />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Select placeholder={am('filterAutoJoin')} value={autoJoinFilter} onChange={v => setAutoJoinFilter(v)}
              allowClear style={{ width: '100%' }}
              options={[{ value: true, label: am('autoJoin') }, { value: false, label: am('manualJoin') }]} />
          </Col>
          <Col xs={24} sm={12} md={7}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} onClick={() => {}}>{am('btnSearch')}</Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>{am('btnReset')}</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{am('btnCreate')}</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title={am('cardList')}>
        <Tabs
          activeKey={goalFilter}
          onChange={setGoalFilter}
          items={goalTabs}
        />
      </Card>

      <SharePromoModal open={!!shareRecord} onClose={() => setShareRecord(null)} type="activity" id={shareRecord?.id} name={shareRecord?.name || ''} />

      <Modal
        title={isEdit ? am('modalEdit') : am('modalCreate')}
        open={formVisible} onOk={handleFormOk} onCancel={() => setFormVisible(false)}
        width={860} destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>{am('dividerMedia')}</span></Divider>

          <Form.Item name="name" label={am('formName')} rules={[{ required: true, validator: (_: any, val: any) => {
            const zh = typeof val === 'object' ? (val?.zh || '').trim() : (val || '').trim()
            return zh ? Promise.resolve() : Promise.reject(new Error(am('formNameRequired')))
          }}]}>
            <MultiLangInput placeholder={am('formNamePlaceholder')} />
          </Form.Item>

          <Form.Item name="subTitle" label={am('formSubTitle')}>
            <MultiLangInput placeholder={am('formSubTitlePlaceholder')} />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label={<span><PictureOutlined style={{ marginRight: 4 }} />{am('formCoverImage')}</span>} style={{ marginBottom: 8 }}>
                <MediaUploadField type="image" value={coverImage} onChange={setCoverImage} placeholder={am('formCoverImageHint')} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label={<span><VideoCameraOutlined style={{ marginRight: 4 }} />{am('formCoverVideo')}</span>} style={{ marginBottom: 8 }}>
                <MediaUploadField type="video" value={coverVideo} onChange={setCoverVideo} placeholder={am('formCoverVideoHint')} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>{am('dividerContent')}</span></Divider>

          <AutoTranslateButton
            sourceLang="zh"
            getTexts={() => {
              const v = form.getFieldsValue()
              return {
                name: v.name?.zh || '',
                subTitle: v.subTitle?.zh || '',
                description: v.description?.zh || '',
                highlights: v.highlights?.zh || '',
                participationGuide: v.participationGuide?.zh || '',
                rewardGuide: v.rewardGuide?.zh || '',
                noticeText: v.noticeText?.zh || '',
              }
            }}
            onResult={(result) => {
              const patch: Record<string, MultiLangValue> = {}
              const fields = ['name','subTitle','description','highlights','participationGuide','rewardGuide','noticeText']
              fields.forEach(f => { if (result[f]) patch[f] = result[f] })
              form.setFieldsValue(patch)
            }}
          />

          <Form.Item name="description" label={am('formDescription')}>
            <MultiLangInput textarea rows={3} placeholder={am('formDescriptionHint')} />
          </Form.Item>
          <Form.Item name="highlights" label={am('formHighlights')}>
            <MultiLangInput textarea rows={2} placeholder={am('formHighlightsHint')} />
          </Form.Item>
          <Form.Item name="participationGuide" label={am('formParticipation')}>
            <MultiLangInput textarea rows={2} placeholder={am('formParticipationHint')} />
          </Form.Item>
          <Form.Item name="rewardGuide" label={am('formReward')}>
            <MultiLangInput textarea rows={2} placeholder={am('formRewardHint')} />
          </Form.Item>
          <Form.Item name="noticeText" label={am('formNotice')}>
            <MultiLangInput textarea rows={2} placeholder={am('formNoticeHint')} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#555' }}>{am('dividerBiz')}</span></Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="goal" label={am('formGoal')} rules={[{ required: true, message: am('formGoalRequired') }]}>
                <Select options={goalOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="department" label={am('formDept')} rules={[{ required: true, message: am('formDeptRequired') }]}>
                <Select options={departmentOptions} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="ownerDept" label={am('formOwnerDept')} rules={[{ required: true, message: am('formOwnerDeptRequired') }]}>
                <Select options={departmentOptions.filter((d) => d.value !== '联合活动')} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="partnerDept" label={am('formPartnerDept')}>
                <Select allowClear options={[{ value: '--', label: am('noPartner') }, ...departmentOptions.filter(d => d.value !== '联合活动')]} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="activityType" label={am('formType')} initialValue="general">
                <Select options={activityTypeOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="mode" label={am('formMode')}>
                <Select allowClear options={modeOptions} placeholder={am('formModePlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="status" label={am('formStatus')} initialValue="draft">
                <Select options={[
                  { value: 'draft', label: am('statusDraft') },
                  { value: 'active', label: am('statusActive') },
                  { value: 'ended', label: am('statusEnded') },
                ]} />
              </Form.Item>
            </Col>
          </Row>

          {activityTypeInForm && GAME_TYPES_SET.has(activityTypeInForm) && (
            <Row gutter={16}>
              <Col xs={24} sm={16}>
                <Form.Item name="gameProgramId" label={am('formGameProgram')}>
                  <Select
                    allowClear
                    loading={gameProgramLoading}
                    options={gameProgramOptions}
                    placeholder={am('formGameProgramPlaceholder')}
                    notFoundContent={am('formGameProgramPlaceholder')}
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="requireFollow" label={am('formRequireFollow')} valuePropName="checked" initialValue={false}>
                <Switch checkedChildren={am('requireFollow')} unCheckedChildren={am('noRequireFollow')} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="autoJoin" label={am('formAutoJoin')} valuePropName="checked" initialValue={false}>
                <Switch checkedChildren={am('autoJoin')} unCheckedChildren={am('manualJoin')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            {(!activityTypeInForm || activityTypeInForm === 'general') && (
              <Col xs={24} sm={12}>
                <Form.Item name="couponName" label={am('formCoupon')}>
                  <Select allowClear showSearch options={mockCoupons.map(item => ({ value: item, label: item }))} placeholder={am('formCouponPlaceholder')} />
                </Form.Item>
              </Col>
            )}
            <Col xs={24} sm={activityTypeInForm && activityTypeInForm !== 'general' ? 24 : 12}>
              <Form.Item name="dateRange" label={am('formDateRange')}>
                <DatePicker.RangePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item noStyle shouldUpdate={(p, c) => p.activityType !== c.activityType}>
            {({ getFieldValue }) => {
              const aType = getFieldValue('activityType')
              if (aType === 'lucky_wheel') return (
                <>
                  <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#fa8c16' }}>🎡 {am('sectionWheel')}</span></Divider>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item name="wheelSegments" label={am('formWheelSegments')}>
                        <InputNumber min={4} max={12} step={2} style={{ width: '100%' }} placeholder={am('formWheelSegmentsHint')} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="defaultChances" label={am('formDefaultChances')}>
                        <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder={am('formDefaultChancesHint')} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="spinResultDelay" label={am('formSpinDelay')}>
                    <InputNumber min={2} max={10} step={0.5} style={{ width: '100%' }} placeholder={am('formSpinDelayHint')} />
                  </Form.Item>
                </>
              )
              if (aType === 'scratch_card') return (
                <>
                  <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#1677ff' }}>🎴 {am('sectionScratch')}</span></Divider>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item name="defaultChances" label={am('formDefaultChances')}>
                        <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder={am('formDefaultChancesHint')} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="scratchRevealThreshold" label={am('formScratchThreshold')}>
                        <InputNumber min={30} max={90} style={{ width: '100%' }} placeholder={am('formScratchThresholdHint')} />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )
              if (aType === 'thai_fortune_draw') return (
                <>
                  <Divider orientation="left" orientationMargin={0}><span style={{ fontSize: 13, color: '#722ed1' }}>🏮 {am('sectionFortune')}</span></Divider>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item name="defaultChances" label={am('formDefaultChances')}>
                        <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder={am('formDefaultChancesHint')} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="allowMultipleDraws" label={am('formMultiDraws')} valuePropName="checked" initialValue={false}>
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="defaultThemeId" label={am('formDefaultTheme')}>
                    <Input placeholder={am('formDefaultThemeHint')} />
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
