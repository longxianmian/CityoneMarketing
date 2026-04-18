import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Tabs, Tag, Card, Row, Col, Statistic, Switch, InputNumber,
  Form, Button, Space, Typography, Alert, Badge, Input, Tooltip,
  App as AntdApp, Divider, Descriptions,
} from 'antd'
import {
  CrownOutlined, UserOutlined, TeamOutlined, SettingOutlined,
  ThunderboltOutlined, ApiOutlined, CheckCircleOutlined, SyncOutlined,
} from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import request from '../../api/request'

const { Title, Text, Paragraph } = Typography

interface Member {
  user_id: string
  line_display_name: string
  identity_tag: 'visitor' | 'fan' | 'customer' | 'member'
  identity_label: string
  deposit_paid: boolean
  deposit_amount: number
  available_points: number
  total_points: number
  interaction_count: number
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
  deposit: {
    amount: number
    currency: string
    description_zh: string
  }
  extra_benefits: any[]
  updated_at: string
  updated_by: string
}

const TAG_COLOR: Record<string, string> = {
  member: 'gold',
  customer: 'blue',
  fan: 'purple',
  visitor: 'default',
}

export default function MemberManage() {
  const { message } = AntdApp.useApp()
  const location = useLocation()
  const [members, setMembers] = useState<Member[]>([])
  const [stats, setStats] = useState({ total: 0, visitorCount: 0, fanCount: 0, customerCount: 0, memberCount: 0 })
  const [config, setConfig] = useState<MemberConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(
    location.pathname.includes('/benefits') ? 'benefits' : 'members'
  )
  const [filterTag, setFilterTag] = useState('')
  const [keyword, setKeyword] = useState('')
  const [discountForm] = Form.useForm()
  const [depositForm] = Form.useForm()
  const [savingDiscount, setSavingDiscount] = useState(false)
  const [discountTestResult, setDiscountTestResult] = useState<any>(null)
  const [testAmount, setTestAmount] = useState<number>(100)

  const loadMembers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterTag) params.set('tag', filterTag)
      if (keyword) params.set('q', keyword)
      const res = await request.get(`/admin/members?${params}`) as any
      const d = (res as any).data
      setMembers(d?.list || [])
      setStats({
        total: d?.total || 0,
        visitorCount: d?.visitorCount || 0,
        fanCount: d?.fanCount || 0,
        customerCount: d?.customerCount || 0,
        memberCount: d?.memberCount || 0,
      })
    } catch {
      message.error('加载会员列表失败')
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
      message.error('加载会员配置失败')
    } finally {
      setConfigLoading(false)
    }
  }, [])

  useEffect(() => { loadMembers() }, [loadMembers])
  useEffect(() => { loadConfig() }, [loadConfig])

  const handleSaveDiscount = async () => {
    const values = await discountForm.validateFields()
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
        deposit: { amount: depositForm.getFieldValue('amount') },
      })
      message.success('会员权益配置已更新')
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

  const columns = [
    {
      title: '用户',
      render: (_: any, r: Member) => (
        <Space>
          <UserOutlined style={{ color: '#999' }} />
          <div>
            <div style={{ fontWeight: 500 }}>{r.line_display_name}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>{r.user_id || r.line_display_name}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: '身份',
      render: (_: any, r: Member) => (
        <Tag color={TAG_COLOR[r.identity_tag]} icon={r.identity_tag === 'member' ? <CrownOutlined /> : undefined}>
          {r.identity_label}
        </Tag>
      ),
    },
    { title: '押金', render: (_: any, r: Member) => r.deposit_paid ? <Badge status="success" text={`${r.deposit_amount} THB`} /> : <Badge status="default" text="未缴" /> },
    { title: '积分', dataIndex: 'available_points', render: (v: number) => v.toLocaleString() },
    { title: '互动次数', dataIndex: 'interaction_count' },
    {
      title: '加入时间',
      render: (_: any, r: Member) => r.joined_at
        ? new Date(r.joined_at).toLocaleDateString('zh-CN')
        : '—',
    },
  ]

  const discountRate = config?.charging_discount?.rate ?? 0.9
  const discountEnabled = config?.charging_discount?.enabled ?? true

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <CrownOutlined style={{ color: '#faad14', marginRight: 8 }} />客户身份管理
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>统一查看 visitor / fan / customer / member 分层与会员权益配置</Text>
        </Col>
      </Row>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="全部客户" value={stats.total} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderColor: '#faad14' }}>
            <Statistic title="会员" value={stats.memberCount} prefix={<CrownOutlined style={{ color: '#faad14' }} />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="客户" value={stats.customerCount} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderColor: discountEnabled ? '#52c41a' : undefined }}>
            <Statistic
              title="充电折扣"
              value={discountEnabled ? `${discountRate * 10}折` : '已关闭'}
              prefix={<ThunderboltOutlined style={{ color: discountEnabled ? '#52c41a' : '#999' }} />}
              valueStyle={{ color: discountEnabled ? '#52c41a' : '#999' }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'members',
            label: <span><TeamOutlined />客户身份列表</span>,
            children: (
              <Card size="small">
                <Row gutter={12} style={{ marginBottom: 12 }}>
                  <Col>
                    <Space>
                      {[
                        { key: '', label: '全部' },
                        { key: 'visitor', label: '访客' },
                        { key: 'fan', label: '粉丝' },
                        { key: 'customer', label: '客户' },
                        { key: 'member', label: '会员' },
                      ].map((t) => (
                        <Button
                          key={t.key}
                          size="small"
                          type={filterTag === t.key ? 'primary' : 'default'}
                          onClick={() => setFilterTag(t.key)}
                        >
                          {t.label}
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
                      style={{ maxWidth: 220 }}
                    />
                  </Col>
                </Row>
                <Table
                  columns={columns}
                  dataSource={members}
                  rowKey="user_id"
                  loading={loading}
                  size="small"
                  pagination={{ pageSize: 20, showSizeChanger: false }}
                  locale={{ emptyText: '暂无客户数据，用户完成 LINE 身份识别后将在此显示' }}
                />
              </Card>
            ),
          },
          {
            key: 'benefits',
            label: <span><CrownOutlined />会员权益配置</span>,
            children: (
              <Row gutter={16}>
                <Col span={14}>
                  <Card
                    title={<span><ThunderboltOutlined style={{ color: '#52c41a' }} /> 充电折扣权益</span>}
                    size="small"
                    style={{ marginBottom: 16 }}
                  >
                    <Form form={discountForm} layout="vertical">
                      <Form.Item name="enabled" label="启用会员充电折扣" valuePropName="checked">
                        <Switch checkedChildren="已启用" unCheckedChildren="已关闭" />
                      </Form.Item>
                      <Form.Item
                        name="rate"
                        label="折扣率（百分比）"
                        extra="例：填写 90 = 9折（即充电费用 × 90%）"
                        rules={[{ required: true }, { type: 'number', min: 10, max: 99 }]}
                      >
                        <InputNumber min={10} max={99} addonAfter="%" style={{ width: 140 }} />
                      </Form.Item>
                      <Form.Item name="amount" label="会员押金金额（THB）" rules={[{ required: true }]}>
                        <InputNumber
                          min={0}
                          addonBefore="฿"
                          addonAfter="THB"
                          style={{ width: 180 }}
                        />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" onClick={handleSaveDiscount} loading={savingDiscount}>
                          保存权益配置
                        </Button>
                      </Form.Item>
                    </Form>
                    {config && (
                      <Descriptions size="small" column={1} style={{ marginTop: 8 }}>
                        <Descriptions.Item label="最后更新">{new Date(config.updated_at).toLocaleString('zh-CN')}</Descriptions.Item>
                        <Descriptions.Item label="操作人">{config.updated_by || '—'}</Descriptions.Item>
                      </Descriptions>
                    )}
                  </Card>
                </Col>

                <Col span={10}>
                  {/* A 系统旁路对接说明 */}
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
                            A 系统结算前可调用本接口查询会员折扣资格：
                          </Paragraph>
                          <code style={{ fontSize: 11, display: 'block', background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
                            GET /api/charging-discount/check<br />
                            &nbsp;&nbsp;?user_id=&lt;LINE_UID&gt;<br />
                            &nbsp;&nbsp;&amp;order_amount=&lt;金额&gt;
                          </code>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            当前阶段：本系统自行判断会员资格（discount_source: "local"）<br />
                            阶段四：替换为 A 系统真实押金/借还状态（discount_source: "a_system"）
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
                                : <Tag color="default">不符合</Tag>}
                            </Descriptions.Item>
                            {discountTestResult.eligible && (
                              <>
                                <Descriptions.Item label="折扣">{discountTestResult.discount_label}</Descriptions.Item>
                                <Descriptions.Item label="原价">฿{discountTestResult.original_amount}</Descriptions.Item>
                                <Descriptions.Item label="折后价">฿{discountTestResult.final_amount}</Descriptions.Item>
                                <Descriptions.Item label="节省">฿{discountTestResult.discount_amount}</Descriptions.Item>
                              </>
                            )}
                            <Descriptions.Item label="数据来源">
                              <Tag>{discountTestResult.discount_source || discountTestResult.reason}</Tag>
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
