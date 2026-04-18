/**
 * 客户管理
 *
 * 四层客户人群：
 *   访客 (visitor)   — 当前会话尚未识别到有效 LINE 身份
 *   粉丝 (fan)       — 已关注 LINE OA，等于已完成系统注册
 *   客户 (customer)  — 已发生过至少一次真实充电业务
 *   会员 (member)    — 已缴纳押金，可直接进入完整取电链路
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Tabs, Tag, Card, Row, Col, Statistic, Switch, InputNumber,
  Form, Button, Space, Typography, Alert, Badge, Input, Tooltip,
  App as AntdApp, Divider, Descriptions, Empty,
} from 'antd'
import {
  CrownOutlined, UserOutlined, TeamOutlined, StarOutlined,
  ThunderboltOutlined, ApiOutlined, CheckCircleOutlined, SyncOutlined,
  InfoCircleOutlined, LockOutlined,
} from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import request from '../../api/request'

const { Title, Text, Paragraph } = Typography

type IdentityTag = 'visitor' | 'fan' | 'customer' | 'member'

interface Customer {
  user_id: string
  line_display_name: string
  identity_tag: IdentityTag
  identity_label: string
  source: string
  deposit_paid: boolean
  deposit_amount: number
  has_used_charging: boolean
  available_points: number
  total_points: number
  interaction_count: number
  benefits: { key: string; label: string; status: string }[]
  joined_at: string | null
}

interface MemberConfig {
  charging_discount: {
    enabled: boolean
    rate: number
    label_zh: string
    description_zh: string
    apply_scope: string
    updated_at: string
  }
  deposit: { amount: number; currency: string; description_zh: string }
  extra_benefits: any[]
  updated_at: string
  updated_by: string
}

// ── 样式常量 ─────────────────────────────────────────────────────────────────

const IDENTITY_CONFIG: Record<IdentityTag, { color: string; icon: React.ReactNode; bg: string; border: string }> = {
  visitor:  { color: '#8c8c8c', icon: <TeamOutlined />, bg: '#fafafa', border: '#d9d9d9' },
  fan:      { color: '#722ed1', icon: <StarOutlined />, bg: '#f9f0ff', border: '#d3adf7' },
  customer: { color: '#1677ff', icon: <UserOutlined />, bg: '#e6f4ff', border: '#91caff' },
  member:   { color: '#faad14', icon: <CrownOutlined />, bg: '#fffbe6', border: '#ffe58f' },
}

const SOURCE_COLOR: Record<string, string> = {
  '押金缴纳': 'gold',
  '押金退款用户': 'blue',
  '营销活动体验': 'cyan',
  '充电体验用户': 'blue',
  'LINE OA 关注': 'purple',
}

// ── 组件 ──────────────────────────────────────────────────────────────────────

export default function CustomerManage() {
  const { message } = AntdApp.useApp()
  const location = useLocation()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [stats, setStats] = useState({ total: 0, visitorCount: 0, fanCount: 0, customerCount: 0, memberCount: 0 })
  const [config, setConfig] = useState<MemberConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(
    location.pathname.includes('/benefits') ? 'benefits' : 'customers'
  )
  const [filterTag, setFilterTag] = useState<string>('')
  const [keyword, setKeyword] = useState('')
  const [discountForm] = Form.useForm()
  const [depositForm] = Form.useForm()
  const [savingDiscount, setSavingDiscount] = useState(false)
  const [discountTestResult, setDiscountTestResult] = useState<any>(null)
  const [testAmount, setTestAmount] = useState<number>(100)

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterTag) params.set('tag', filterTag)
      if (keyword) params.set('q', keyword)
      const res = await request.get(`/admin/customers?${params}`) as any
      const d = (res as any).data
      setCustomers(d?.list || [])
      setStats({
        total: d?.total || 0,
        visitorCount: d?.visitorCount || 0,
        memberCount: d?.memberCount || 0,
        customerCount: d?.customerCount || 0,
        fanCount: d?.fanCount || 0,
      })
    } catch {
      message.error('加载客户列表失败')
    } finally {
      setLoading(false)
    }
  }, [filterTag, keyword])

  const loadConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const res = await request.get('/admin/member-config') as any
      const d = (res as any).data as MemberConfig
      setConfig(d)
      discountForm.setFieldsValue({
        enabled: d.charging_discount?.enabled ?? true,
        rate: Math.round((d.charging_discount?.rate ?? 0.9) * 100),
      })
      depositForm.setFieldsValue({ amount: d.deposit?.amount ?? 299 })
    } catch {
      message.error('加载权益配置失败')
    } finally {
      setConfigLoading(false)
    }
  }, [])

  useEffect(() => { loadCustomers() }, [loadCustomers])
  useEffect(() => { loadConfig() }, [loadConfig])

  const handleSaveDiscount = async () => {
    const values = await discountForm.validateFields()
    const depositValues = await depositForm.validateFields()
    setSavingDiscount(true)
    try {
      const rate = values.rate / 100
      await request.post('/admin/member-config/update', {
        charging_discount: {
          enabled: values.enabled,
          rate,
          label_zh: `会员充电${values.rate / 10}折优惠`,
          description_zh: `会员充电直接享受${values.rate / 10}折结算，折扣自动抵扣，无需手动申请`,
        },
        deposit: { amount: depositValues.amount },
      })
      message.success('权益配置已更新')
      loadConfig()
    } catch (e: any) {
      message.error(e?.response?.data?.msg || '保存失败')
    } finally {
      setSavingDiscount(false)
    }
  }

  const testDiscount = async () => {
    try {
      const res = await request.get(
        `/charging-discount/check?user_id=test_member_user&order_amount=${testAmount}`
      ) as any
      setDiscountTestResult((res as any).data)
    } catch {
      message.error('接口测试失败')
    }
  }

  // ── 表格列定义 ─────────────────────────────────────────────────────────────

  const columns = [
    {
      title: '用户',
      width: 200,
      render: (_: any, r: Customer) => (
        <Space>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: IDENTITY_CONFIG[r.identity_tag]?.bg || '#f0f0f0',
            border: `1px solid ${IDENTITY_CONFIG[r.identity_tag]?.border || '#d9d9d9'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: IDENTITY_CONFIG[r.identity_tag]?.color || '#999',
            flexShrink: 0,
          }}>
            {IDENTITY_CONFIG[r.identity_tag]?.icon}
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{r.line_display_name}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>{r.user_id ? r.user_id.slice(0, 20) : '—'}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: '身份',
      width: 90,
      render: (_: any, r: Customer) => (
        <Tag color={IDENTITY_CONFIG[r.identity_tag]?.color} icon={IDENTITY_CONFIG[r.identity_tag]?.icon}>
          {r.identity_label}
        </Tag>
      ),
    },
    {
      title: <span>来源渠道 <Tooltip title="用户进入系统的渠道。阶段四 A 系统对接后将由真实数据填充"><InfoCircleOutlined style={{ color: '#999' }} /></Tooltip></span>,
      width: 140,
      render: (_: any, r: Customer) => (
        <Tag color={SOURCE_COLOR[r.source] || 'default'} style={{ fontSize: 11 }}>
          {r.source || 'LINE OA 关注'}
        </Tag>
      ),
    },
    {
      title: '押金状态',
      width: 120,
      render: (_: any, r: Customer) =>
        r.deposit_paid
          ? <Badge status="success" text={`已缴 ฿${r.deposit_amount}`} />
          : <Badge status="default" text="未缴纳" />,
    },
    {
      title: '积分',
      width: 80,
      dataIndex: 'available_points',
      render: (v: number) => v > 0 ? v.toLocaleString() : <Text type="secondary">—</Text>,
    },
    {
      title: <span>权益 <Tooltip title="会员权益已生效；visitor / fan / customer 分层权益待后期配置开发"><InfoCircleOutlined style={{ color: '#999' }} /></Tooltip></span>,
      width: 160,
      render: (_: any, r: Customer) => {
        if (r.benefits.length === 0) {
          return (
            <Space size={4}>
              <LockOutlined style={{ color: '#d9d9d9', fontSize: 11 }} />
              <Text type="secondary" style={{ fontSize: 11 }}>暂无权益</Text>
            </Space>
          )
        }
        return (
          <Space size={4} wrap>
            {r.benefits.map((b) => (
              <Tag key={b.key} color="gold" icon={<ThunderboltOutlined />} style={{ fontSize: 11 }}>
                {b.label}
              </Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: '互动次数',
      width: 80,
      dataIndex: 'interaction_count',
      render: (v: number) => v > 0 ? v : <Text type="secondary">0</Text>,
    },
    {
      title: '加入时间',
      width: 100,
      render: (_: any, r: Customer) =>
        r.joined_at ? new Date(r.joined_at).toLocaleDateString('zh-CN') : <Text type="secondary">—</Text>,
    },
  ]

  // ── 统计卡 ──────────────────────────────────────────────────────────────────

  const statCards = [
    {
      label: '全部客户', value: stats.total,
      icon: <TeamOutlined style={{ color: '#1677ff' }} />, color: '#1677ff', bg: '#e6f4ff', border: '#91caff',
    },
    {
      label: '访客', value: stats.visitorCount,
      icon: <TeamOutlined style={{ color: '#8c8c8c' }} />, color: '#8c8c8c', bg: '#fafafa', border: '#d9d9d9',
      tip: '当前会话尚未识别到有效 LINE 身份',
    },
    {
      label: '粉丝', value: stats.fanCount,
      icon: <StarOutlined style={{ color: '#722ed1' }} />, color: '#722ed1', bg: '#f9f0ff', border: '#d3adf7',
      tip: '已关注 LINE OA，等于已完成系统注册',
    },
    {
      label: '客户', value: stats.customerCount,
      icon: <UserOutlined style={{ color: '#1677ff' }} />, color: '#1677ff', bg: '#e6f4ff', border: '#91caff',
      tip: '已发生过至少一次真实充电业务',
    },
    {
      label: '会员', value: stats.memberCount,
      icon: <CrownOutlined style={{ color: '#faad14' }} />, color: '#faad14', bg: '#fffbe6', border: '#ffe58f',
      tip: '缴纳押金且正在使用充电宝服务',
    },
  ]

  const filterButtons = [
    { key: '', label: '全部', count: stats.total },
    { key: 'visitor', label: '访客', count: stats.visitorCount },
    { key: 'fan', label: '粉丝', count: stats.fanCount },
    { key: 'customer', label: '客户', count: stats.customerCount },
    { key: 'member', label: '会员', count: stats.memberCount },
  ]

  const discountRate = config?.charging_discount?.rate ?? 0.9
  const discountEnabled = config?.charging_discount?.enabled ?? true

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <TeamOutlined style={{ color: '#1677ff', marginRight: 8 }} />客户管理
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            访客 · 粉丝 · 客户 · 会员 — 四层客户身份数据、来源与权益管理
          </Text>
        </Col>
      </Row>

      {/* 统计卡片 */}
      <Row gutter={12} style={{ marginBottom: 20 }}>
        {statCards.map((c) => (
          <Col flex="1 1 180px" key={c.label}>
            <Card
              size="small"
              style={{ borderColor: c.border, background: c.bg, cursor: 'default' }}
            >
              <Statistic
                title={
                  <Space size={4}>
                    {c.label}
                    {c.tip && (
                      <Tooltip title={c.tip}>
                        <InfoCircleOutlined style={{ color: '#999', fontSize: 11 }} />
                      </Tooltip>
                    )}
                  </Space>
                }
                value={c.value}
                prefix={c.icon}
                valueStyle={{ color: c.color, fontSize: 22 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'customers',
            label: <span><TeamOutlined />客户列表</span>,
            children: (
              <Card size="small">
                {/* 说明 */}
                <Alert
                  type="info"
                  showIcon={false}
                  style={{ marginBottom: 12, padding: '6px 12px' }}
                  message={
                    <Space split="·" style={{ fontSize: 12 }}>
                      <span><TeamOutlined style={{ color: '#8c8c8c' }} /> <b>访客</b>：当前会话尚未识别到有效 LINE 身份</span>
                      <span><StarOutlined style={{ color: '#722ed1' }} /> <b>粉丝</b>：已关注 LINE OA</span>
                      <span><UserOutlined style={{ color: '#1677ff' }} /> <b>客户</b>：已发生过至少一次真实充电业务</span>
                      <span><CrownOutlined style={{ color: '#faad14' }} /> <b>会员</b>：已缴纳押金，可直接取电</span>
                    </Space>
                  }
                />

                {/* 筛选栏 */}
                <Row gutter={12} style={{ marginBottom: 12 }}>
                  <Col>
                    <Space>
                      {filterButtons.map((f) => (
                        <Button
                          key={f.key}
                          size="small"
                          type={filterTag === f.key ? 'primary' : 'default'}
                          onClick={() => setFilterTag(f.key)}
                        >
                          {f.label}
                          {f.count > 0 && (
                            <span style={{ marginLeft: 4, opacity: 0.7 }}>({f.count})</span>
                          )}
                        </Button>
                      ))}
                    </Space>
                  </Col>
                  <Col flex="auto">
                    <Input.Search
                      size="small"
                      placeholder="搜索昵称、用户ID或 LINE UID"
                      allowClear
                      onSearch={setKeyword}
                      style={{ maxWidth: 240 }}
                    />
                  </Col>
                  <Col>
                    <Button size="small" icon={<SyncOutlined />} onClick={loadCustomers}>刷新</Button>
                  </Col>
                </Row>

                <Table
                  columns={columns}
                  dataSource={customers}
                  rowKey="user_id"
                  loading={loading}
                  size="small"
                  scroll={{ x: 900 }}
                  pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <div style={{ textAlign: 'center' }}>
                            <Text type="secondary">暂无客户数据</Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              用户完成 LINE 身份识别后将在此显示
                            </Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              当前 visitor / fan / customer / member 均在此统一查看
                            </Text>
                          </div>
                        }
                      />
                    ),
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'benefits',
            label: <span><CrownOutlined />权益配置 & 对接口</span>,
            children: (
              <Row gutter={16}>
                {/* 左：权益配置 */}
                <Col span={14}>
                  <Card
                    title={<span><ThunderboltOutlined style={{ color: '#52c41a' }} /> 会员充电权益</span>}
                    size="small"
                    style={{ marginBottom: 16 }}
                    loading={configLoading}
                  >
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                      message="当前阶段仅会员（已缴纳押金）拥有充电折扣权益；visitor / fan / customer 权益待后期扩展配置"
                    />
                    <Form form={discountForm} layout="vertical">
                      <Form.Item name="enabled" label="启用会员充电折扣" valuePropName="checked">
                        <Switch checkedChildren="已启用" unCheckedChildren="已关闭" />
                      </Form.Item>
                      <Form.Item
                        name="rate"
                        label="折扣率（百分比）"
                        extra="例：填写 90 = 9折（充电费用 × 90%）"
                        rules={[{ required: true }, { type: 'number', min: 10, max: 99 }]}
                      >
                        <InputNumber min={10} max={99} addonAfter="%" style={{ width: 140 }} />
                      </Form.Item>
                    </Form>

                    <Divider style={{ margin: '12px 0' }} />

                    <Form form={depositForm} layout="vertical">
                      <Form.Item name="amount" label="会员押金金额（THB）">
                        <InputNumber min={0} addonBefore="฿" addonAfter="THB" style={{ width: 180 }} />
                      </Form.Item>
                    </Form>

                    <Button type="primary" onClick={handleSaveDiscount} loading={savingDiscount}>
                      保存权益配置
                    </Button>

                    {config && (
                      <Descriptions size="small" column={1} style={{ marginTop: 12 }}>
                        <Descriptions.Item label="最后更新">{new Date(config.updated_at).toLocaleString('zh-CN')}</Descriptions.Item>
                        <Descriptions.Item label="操作人">{config.updated_by || '—'}</Descriptions.Item>
                      </Descriptions>
                    )}
                  </Card>

                  {/* 访客/粉丝/客户权益 - 占位 */}
                  <Card
                    title={<span><StarOutlined style={{ color: '#722ed1' }} /> 访客 / 粉丝 / 客户权益（待开发）</span>}
                    size="small"
                    style={{ opacity: 0.65 }}
                  >
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          访客、粉丝、客户专属权益（如识别引导、积分奖励、免费体验券、专属活动入场资格等）将在后期版本配置
                        </Text>
                      }
                    />
                  </Card>
                </Col>

                {/* 右：A 系统旁路对接口 */}
                <Col span={10}>
                  <Card
                    title={<span><ApiOutlined /> A 系统旁路对接口</span>}
                    size="small"
                    style={{ marginBottom: 16, borderColor: '#1677ff' }}
                  >
                    <Alert
                      type="info"
                      showIcon
                      message="阶段四预留接口"
                      description={
                        <div>
                          <Paragraph style={{ fontSize: 12, margin: '8px 0 4px' }}>
                            A 系统订单结算前调用本接口查询会员折扣资格：
                          </Paragraph>
                          <code style={{
                            fontSize: 11, display: 'block',
                            background: '#f5f5f5', padding: '6px 10px',
                            borderRadius: 4, marginBottom: 8, lineHeight: 1.8,
                          }}>
                            GET /api/charging-discount/check<br />
                            &nbsp;&nbsp;?user_id=&lt;LINE_UID&gt;<br />
                            &nbsp;&nbsp;&amp;order_amount=&lt;金额&gt;
                          </code>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <b>阶段三</b>：本系统判断 deposit_paid<br />
                            （discount_source: "local"）<br />
                            <b>阶段四</b>：替换为 A 系统真实押金/借还状态<br />
                            （discount_source: "a_system"）
                          </Text>
                        </div>
                      }
                    />

                    <Divider style={{ margin: '12px 0' }} />

                    <div>
                      <Text strong style={{ fontSize: 12 }}>接口测试</Text>
                      <Row gutter={8} style={{ marginTop: 8 }}>
                        <Col flex="auto">
                          <InputNumber
                            size="small"
                            addonBefore="金额"
                            addonAfter="THB"
                            value={testAmount}
                            onChange={(v) => setTestAmount(v || 0)}
                            style={{ width: '100%' }}
                          />
                        </Col>
                        <Col>
                          <Button size="small" icon={<SyncOutlined />} onClick={testDiscount}>
                            测试
                          </Button>
                        </Col>
                      </Row>
                      {discountTestResult && (
                        <Card size="small" style={{ marginTop: 8, background: '#f6ffed', borderColor: '#b7eb8f' }}>
                          <Descriptions size="small" column={1}>
                            <Descriptions.Item label="会员资格">
                              {discountTestResult.eligible
                                ? <Tag color="green" icon={<CheckCircleOutlined />}>符合</Tag>
                                : <Tag>{discountTestResult.reason || '不符合'}</Tag>}
                            </Descriptions.Item>
                            {discountTestResult.eligible && (
                              <>
                                <Descriptions.Item label="折扣">{discountTestResult.discount_label}</Descriptions.Item>
                                <Descriptions.Item label="原价">฿{discountTestResult.original_amount}</Descriptions.Item>
                                <Descriptions.Item label="折后价"><b>฿{discountTestResult.final_amount}</b></Descriptions.Item>
                                <Descriptions.Item label="节省">฿{discountTestResult.discount_amount}</Descriptions.Item>
                              </>
                            )}
                            <Descriptions.Item label="数据来源">
                              <Tag color={discountTestResult.discount_source === 'a_system' ? 'blue' : 'default'}>
                                {discountTestResult.discount_source || 'local'}
                              </Tag>
                            </Descriptions.Item>
                          </Descriptions>
                        </Card>
                      )}
                    </div>
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </div>
  )
}
