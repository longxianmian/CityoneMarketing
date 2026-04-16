import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import {
  getIntentLabels,
  reEmbedIntent,
  runIntentRecallTest,
  seedIntentVectors,
} from '../../api/agent-admin'

const { Paragraph, Text, Title } = Typography
const { TextArea } = Input

type RecallResult = {
  query: string
  ready: boolean
  top_intent: null | {
    intent_code: string
    intent_name: string
    dispatch_mode: string
    tool_name?: string | null
    card_template_key?: string | null
    similarity?: number
    in_scope?: boolean
  }
  all_results: Array<{
    intent_code: string
    intent_name: string
    dispatch_mode: string
    similarity: number
  }>
}

type IntentLabel = {
  id: number
  intent_code: string
  intent_name: string
  dispatch_mode: string
  tool_name?: string | null
  card_template_key?: string | null
  intent_scope?: string
  requires_confirmation?: boolean
  requires_payment?: boolean
  similarity_threshold?: number
  priority?: number
  is_enabled?: boolean
  updated_at?: string
  has_embedding?: boolean
}

const dispatchColor: Record<string, string> = {
  chat_only: 'blue',
  card_only: 'cyan',
  tool_then_card: 'green',
  tool_then_confirm: 'orange',
  tool_then_pay: 'volcano',
  out_of_scope: 'default',
}

export default function AgentIntentTester() {
  const [form] = Form.useForm()
  const [testing, setTesting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [reEmbeddingCode, setReEmbeddingCode] = useState('')
  const [recallResult, setRecallResult] = useState<RecallResult | null>(null)
  const [labels, setLabels] = useState<IntentLabel[]>([])
  const [loadingLabels, setLoadingLabels] = useState(false)

  const loadLabels = async () => {
    setLoadingLabels(true)
    try {
      const res: any = await getIntentLabels()
      setLabels(res?.data || [])
    } catch {
      setLabels([])
    } finally {
      setLoadingLabels(false)
    }
  }

  useEffect(() => {
    loadLabels()
  }, [])

  const stats = useMemo(() => {
    const total = labels.length
    const enabled = labels.filter((item) => item.is_enabled !== false).length
    const embedded = labels.filter((item) => item.has_embedding).length
    const confirm = labels.filter((item) => item.requires_confirmation).length
    return { total, enabled, embedded, confirm }
  }, [labels])

  const handleTest = async () => {
    try {
      const values = await form.validateFields()
      setTesting(true)
      const res: any = await runIntentRecallTest({
        text: values.text,
        top_k: values.top_k || 3,
      })
      setRecallResult(res?.data || null)
    } catch (err: any) {
      if (err?.errorFields) return
      setRecallResult(null)
    } finally {
      setTesting(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res: any = await seedIntentVectors()
      const data = res?.data || {}
      message.success(`向量重建完成：${data.embedded || 0}/${data.seeded || 0} 条已生成 embedding`)
      await loadLabels()
    } catch {
      // request.ts 已统一提示
    } finally {
      setSeeding(false)
    }
  }

  const handleReEmbed = async (intentCode: string) => {
    setReEmbeddingCode(intentCode)
    try {
      await reEmbedIntent(intentCode)
      message.success(`已重新生成 ${intentCode} 的 embedding`)
      await loadLabels()
    } catch {
      // request.ts 已统一提示
    } finally {
      setReEmbeddingCode('')
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space align="start" style={{ width: '100%' }}>
          <ExperimentOutlined style={{ fontSize: 32, color: '#1677ff', marginTop: 4 }} />
          <div style={{ flex: 1 }}>
            <Space align="center" wrap>
              <Title level={4} style={{ margin: 0 }}>意图命中测试器</Title>
              <Tag color="blue">问问内部工具</Tag>
              <Tag>仅管理端测试使用</Tag>
            </Space>
            <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
              用于测试问问对输入语句的意图识别结果、候选命中、分发方式和向量状态，不面向普通用户开放。
            </Paragraph>
          </div>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        message="这个页面是问问的内部调试工具"
        description="你可以在这里验证一句话会命中哪个意图、是否会走 card_only 或 tool_then_confirm，以及当前向量意图库是否已经成功生成 embedding。"
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card><Statistic title="意图总数" value={stats.total} prefix={<ThunderboltOutlined />} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="已启用意图" value={stats.enabled} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="已有向量" value={stats.embedded} prefix={<ExperimentOutlined />} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="需确认意图" value={stats.confirm} prefix={<SendOutlined />} /></Card>
        </Col>
      </Row>

      <Card
        title="测试输入"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => form.resetFields()}>
              清空
            </Button>
            <Button type="primary" icon={<SendOutlined />} loading={testing} onClick={handleTest}>
              开始测试
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            top_k: 3,
            text: '今天有什么优惠？',
          }}
        >
          <Row gutter={16}>
            <Col xs={24} lg={18}>
              <Form.Item
                label="测试语句"
                name="text"
                rules={[{ required: true, message: '请输入要测试的语句' }]}
              >
                <TextArea
                  rows={4}
                  placeholder={'例如：\n今天有什么优惠？\n帮我领优惠券\n我的积分还有多少'}
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={6}>
              <Form.Item label="返回候选数 TopK" name="top_k">
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {recallResult && (
          <div style={{ marginTop: 8 }}>
            <Alert
              type={recallResult.top_intent ? 'success' : 'warning'}
              showIcon
              message={recallResult.top_intent ? '已命中候选意图' : '未命中明确意图'}
              description={
                recallResult.top_intent
                  ? `Top1 命中 ${recallResult.top_intent.intent_code}，后续将按 ${recallResult.top_intent.dispatch_mode} 分发。`
                  : '当前这句话没有命中明确的 Top1 意图，运行时可能被判定为 out_of_scope 或走降级路径。'
              }
              style={{ marginBottom: 16 }}
            />

            {recallResult.top_intent && (
              <Card size="small" title="Top1 命中结果" style={{ marginBottom: 16 }}>
                <Space wrap size={[8, 8]}>
                  <Tag color="blue">{recallResult.top_intent.intent_code}</Tag>
                  <Tag>{recallResult.top_intent.intent_name}</Tag>
                  <Tag color={dispatchColor[recallResult.top_intent.dispatch_mode] || 'default'}>
                    {recallResult.top_intent.dispatch_mode}
                  </Tag>
                  {recallResult.top_intent.tool_name && <Tag color="green">工具：{recallResult.top_intent.tool_name}</Tag>}
                  {recallResult.top_intent.card_template_key && <Tag color="purple">卡片：{recallResult.top_intent.card_template_key}</Tag>}
                  {typeof recallResult.top_intent.similarity === 'number' && (
                    <Tag color="geekblue">相似度：{recallResult.top_intent.similarity.toFixed(4)}</Tag>
                  )}
                </Space>
              </Card>
            )}

            <Table
              rowKey="intent_code"
              size="small"
              pagination={false}
              dataSource={recallResult.all_results}
              columns={[
                { title: '候选意图', dataIndex: 'intent_code', width: 180, render: (v: string) => <Text code>{v}</Text> },
                { title: '意图名称', dataIndex: 'intent_name', width: 180 },
                {
                  title: '分发方式',
                  dataIndex: 'dispatch_mode',
                  width: 160,
                  render: (v: string) => <Tag color={dispatchColor[v] || 'default'}>{v}</Tag>,
                },
                {
                  title: '相似度',
                  dataIndex: 'similarity',
                  width: 120,
                  render: (v: number) => <Text>{typeof v === 'number' ? v.toFixed(4) : '-'}</Text>,
                },
              ]}
            />
          </div>
        )}
      </Card>

      <Card
        title="向量意图库"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadLabels} loading={loadingLabels}>
              刷新列表
            </Button>
            <Button type="primary" loading={seeding} onClick={handleSeed}>
              全量生成向量
            </Button>
          </Space>
        }
      >
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          这里展示当前已进入向量意图库的意图状态。`has_embedding=false` 说明该意图尚未成功写入向量或 embedding 尚未生成。
        </Paragraph>
        <Table
          rowKey="id"
          loading={loadingLabels}
          size="small"
          dataSource={labels}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: '意图编码',
              dataIndex: 'intent_code',
              width: 180,
              render: (v: string) => <Text code>{v}</Text>,
            },
            {
              title: '意图名称',
              dataIndex: 'intent_name',
              width: 180,
            },
            {
              title: '分发方式',
              dataIndex: 'dispatch_mode',
              width: 150,
              render: (v: string) => <Tag color={dispatchColor[v] || 'default'}>{v}</Tag>,
            },
            {
              title: '向量状态',
              dataIndex: 'has_embedding',
              width: 110,
              render: (v: boolean) => (v ? <Tag color="green">已生成</Tag> : <Tag color="orange">未生成</Tag>),
            },
            {
              title: '阈值',
              dataIndex: 'similarity_threshold',
              width: 80,
              render: (v?: number) => (typeof v === 'number' ? v.toFixed(2) : '-'),
            },
            {
              title: '动作标记',
              width: 170,
              render: (_: unknown, row: IntentLabel) => (
                <Space wrap size={[4, 4]}>
                  {row.tool_name && <Tag color="green">工具</Tag>}
                  {row.card_template_key && <Tag color="purple">卡片</Tag>}
                  {row.requires_confirmation && <Tag color="orange">需确认</Tag>}
                  {row.requires_payment && <Tag color="volcano">需支付</Tag>}
                  {!row.tool_name && !row.card_template_key && !row.requires_confirmation && !row.requires_payment && <Text type="secondary">-</Text>}
                </Space>
              ),
            },
            {
              title: '操作',
              width: 130,
              render: (_: unknown, row: IntentLabel) => (
                <Button
                  size="small"
                  loading={reEmbeddingCode === row.intent_code}
                  onClick={() => handleReEmbed(row.intent_code)}
                >
                  重生成向量
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  )
}
