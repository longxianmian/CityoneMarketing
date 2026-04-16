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
import { useI18n } from '../../i18n'

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

const COPY = {
  zh: {
    pageTitle: '意图命中测试器',
    internalTool: '问问内部工具',
    adminOnly: '仅管理端测试使用',
    intro: '用于测试问问对输入语句的意图识别结果、候选命中、分发方式和向量状态，不面向普通用户开放。',
    alertTitle: '这个页面是问问的内部调试工具',
    alertDesc: '你可以在这里验证一句话会命中哪个意图、是否会走 card_only 或 tool_then_confirm，以及当前向量意图库是否已经成功生成 embedding。',
    statTotal: '意图总数',
    statEnabled: '已启用意图',
    statEmbedded: '已有向量',
    statConfirm: '需确认意图',
    testInput: '测试输入',
    clear: '清空',
    test: '开始测试',
    testSentence: '测试语句',
    testSentenceRequired: '请输入要测试的语句',
    testPlaceholder: '例如：\n今天有什么优惠？\n帮我领优惠券\n我的积分还有多少',
    topK: '返回候选数 TopK',
    matched: '已命中候选意图',
    unmatched: '未命中明确意图',
    matchedDesc: 'Top1 命中 {intent}，后续将按 {mode} 分发。',
    unmatchedDesc: '当前这句话没有命中明确的 Top1 意图，运行时可能被判定为 out_of_scope 或走降级路径。',
    top1: 'Top1 命中结果',
    tool: '工具',
    card: '卡片',
    similarity: '相似度',
    candidates: '候选意图',
    colIntent: '候选意图',
    colName: '意图名称',
    colDispatch: '分发方式',
    colSimilarity: '相似度',
    emptyCandidates: '暂无数据',
    vectorLibrary: '向量意图库',
    refresh: '刷新列表',
    rebuild: '全量生成向量',
    vectorHint: '这里展示当前已进入向量意图库的意图状态。has_embedding=false 说明该意图尚未成功写入向量或 embedding 尚未生成。',
    colCode: '意图编码',
    colEmbedding: '向量状态',
    colThreshold: '阈值',
    colFlags: '动作标记',
    colActions: '操作',
    hasEmbedding: '已生成',
    noEmbedding: '未生成',
    flagTool: '工具',
    flagCard: '卡片',
    flagConfirm: '需确认',
    flagPay: '需支付',
    noFlags: '-',
    reEmbed: '重生成向量',
    seedSuccess: '向量重建完成：已生成 {embedded}/{seeded} 条 embedding',
    reEmbedSuccess: '已重新生成 {intent} 的 embedding',
  },
  th: {
    pageTitle: 'ตัวทดสอบการจับคู่ Intent',
    internalTool: 'เครื่องมือภายในของ Ask',
    adminOnly: 'ใช้ทดสอบในหลังบ้านเท่านั้น',
    intro: 'ใช้ทดสอบว่าข้อความจะถูกตีความเป็น Intent ใด มีตัวเลือกใดบ้าง ใช้การกระจายแบบไหน และมีเวกเตอร์พร้อมหรือยัง โดยไม่เปิดให้ผู้ใช้ทั่วไปเห็น',
    alertTitle: 'หน้านี้เป็นเครื่องมือดีบักภายในของ Ask',
    alertDesc: 'คุณสามารถใช้หน้านี้เพื่อตรวจสอบว่าประโยคหนึ่งจะจับคู่ Intent ใด จะไปทาง card_only หรือ tool_then_confirm หรือไม่ และคลังเวกเตอร์พร้อมใช้งานแล้วหรือยัง',
    statTotal: 'จำนวน Intent',
    statEnabled: 'Intent ที่เปิดใช้',
    statEmbedded: 'เวกเตอร์ที่มีอยู่',
    statConfirm: 'Intent ที่ต้องยืนยัน',
    testInput: 'ทดสอบข้อความ',
    clear: 'ล้าง',
    test: 'เริ่มทดสอบ',
    testSentence: 'ข้อความทดสอบ',
    testSentenceRequired: 'กรุณากรอกข้อความที่จะทดสอบ',
    testPlaceholder: 'ตัวอย่าง:\nวันนี้มีโปรอะไรบ้าง\nช่วยรับคูปองให้หน่อย\nฉันมีคะแนนเหลือเท่าไร',
    topK: 'จำนวน候选 TopK',
    matched: 'จับคู่ Intent ได้',
    unmatched: 'ยังไม่พบ Intent ที่ชัดเจน',
    matchedDesc: 'Top1 จับคู่กับ {intent} และจะถูกกระจายด้วยโหมด {mode}',
    unmatchedDesc: 'ข้อความนี้ยังไม่มี Top1 ที่ชัดเจน ขณะรันจริงอาจถูกตัดสินเป็น out_of_scope หรือใช้เส้นทางลดระดับ',
    top1: 'ผลการจับคู่ Top1',
    tool: 'เครื่องมือ',
    card: 'การ์ด',
    similarity: 'ความคล้าย',
    candidates: 'Intent ตัวเลือก',
    colIntent: 'Intent ตัวเลือก',
    colName: 'ชื่อ Intent',
    colDispatch: 'วิธี分发',
    colSimilarity: 'ความคล้าย',
    emptyCandidates: 'ไม่มีข้อมูล',
    vectorLibrary: 'คลังเวกเตอร์ Intent',
    refresh: 'รีเฟรชรายการ',
    rebuild: 'สร้างเวกเตอร์ใหม่ทั้งหมด',
    vectorHint: 'ส่วนนี้แสดงสถานะของ Intent ที่เข้าสู่คลังเวกเตอร์แล้ว หาก has_embedding=false แปลว่ายังเขียนเวกเตอร์หรือสร้าง embedding ไม่สำเร็จ',
    colCode: 'รหัส Intent',
    colEmbedding: 'สถานะเวกเตอร์',
    colThreshold: 'เกณฑ์',
    colFlags: 'ป้ายการทำงาน',
    colActions: 'การดำเนินการ',
    hasEmbedding: 'พร้อมแล้ว',
    noEmbedding: 'ยังไม่มี',
    flagTool: 'เครื่องมือ',
    flagCard: 'การ์ด',
    flagConfirm: 'ต้องยืนยัน',
    flagPay: 'ต้องชำระเงิน',
    noFlags: '-',
    reEmbed: 'สร้างเวกเตอร์ใหม่',
    seedSuccess: 'สร้างเวกเตอร์ใหม่เสร็จแล้ว: มี embedding {embedded}/{seeded} รายการ',
    reEmbedSuccess: 'สร้าง embedding ใหม่ให้ {intent} แล้ว',
  },
  en: {
    pageTitle: 'Intent Match Tester',
    internalTool: 'Ask Internal Tool',
    adminOnly: 'Admin-side testing only',
    intro: 'Use this page to test which intent a sentence matches, what candidates are returned, which dispatch mode will be used, and whether vectors are ready. It is not exposed to end users.',
    alertTitle: 'This page is an internal debugging tool for Ask',
    alertDesc: 'Use it to verify which intent a sentence hits, whether it will go through card_only or tool_then_confirm, and whether the vector library is ready.',
    statTotal: 'Total Intents',
    statEnabled: 'Enabled Intents',
    statEmbedded: 'Embedded Intents',
    statConfirm: 'Confirmation Required',
    testInput: 'Test Input',
    clear: 'Clear',
    test: 'Run Test',
    testSentence: 'Test Sentence',
    testSentenceRequired: 'Please enter a sentence to test',
    testPlaceholder: 'Examples:\nWhat promotions are available today?\nHelp me claim a coupon\nHow many points do I have?',
    topK: 'TopK Candidates',
    matched: 'Intent matched',
    unmatched: 'No clear intent matched',
    matchedDesc: 'Top1 matched {intent}, and runtime will dispatch it via {mode}.',
    unmatchedDesc: 'This sentence does not currently have a clear Top1 intent. Runtime may classify it as out_of_scope or use a fallback path.',
    top1: 'Top1 Result',
    tool: 'Tool',
    card: 'Card',
    similarity: 'Similarity',
    candidates: 'Candidate Intents',
    colIntent: 'Candidate Intent',
    colName: 'Intent Name',
    colDispatch: 'Dispatch Mode',
    colSimilarity: 'Similarity',
    emptyCandidates: 'No data',
    vectorLibrary: 'Intent Vector Library',
    refresh: 'Refresh List',
    rebuild: 'Rebuild All Vectors',
    vectorHint: 'This table shows the current vector library status. has_embedding=false means the intent has not been written to the vector store or its embedding has not been generated yet.',
    colCode: 'Intent Code',
    colEmbedding: 'Embedding',
    colThreshold: 'Threshold',
    colFlags: 'Flags',
    colActions: 'Actions',
    hasEmbedding: 'Ready',
    noEmbedding: 'Missing',
    flagTool: 'Tool',
    flagCard: 'Card',
    flagConfirm: 'Confirm',
    flagPay: 'Payment',
    noFlags: '-',
    reEmbed: 'Re-embed',
    seedSuccess: 'Vector rebuild complete: generated embeddings for {embedded}/{seeded} intents',
    reEmbedSuccess: 'Re-generated embedding for {intent}',
  },
} as const

export default function AgentIntentTester() {
  const { language } = useI18n()
  const copy = COPY[language] || COPY.en
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
      message.success(copy.seedSuccess.replace('{embedded}', String(data.embedded || 0)).replace('{seeded}', String(data.seeded || 0)))
      await loadLabels()
    } finally {
      setSeeding(false)
    }
  }

  const handleReEmbed = async (intentCode: string) => {
    setReEmbeddingCode(intentCode)
    try {
      await reEmbedIntent(intentCode)
      message.success(copy.reEmbedSuccess.replace('{intent}', intentCode))
      await loadLabels()
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
              <Title level={4} style={{ margin: 0 }}>{copy.pageTitle}</Title>
              <Tag color="blue">{copy.internalTool}</Tag>
              <Tag>{copy.adminOnly}</Tag>
            </Space>
            <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
              {copy.intro}
            </Paragraph>
          </div>
        </Space>
      </Card>

      <Alert type="info" showIcon message={copy.alertTitle} description={copy.alertDesc} />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card><Statistic title={copy.statTotal} value={stats.total} prefix={<ThunderboltOutlined />} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title={copy.statEnabled} value={stats.enabled} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title={copy.statEmbedded} value={stats.embedded} prefix={<ExperimentOutlined />} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title={copy.statConfirm} value={stats.confirm} prefix={<SendOutlined />} /></Card>
        </Col>
      </Row>

      <Card
        title={copy.testInput}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => form.resetFields()}>
              {copy.clear}
            </Button>
            <Button type="primary" icon={<SendOutlined />} loading={testing} onClick={handleTest}>
              {copy.test}
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
                label={copy.testSentence}
                name="text"
                rules={[{ required: true, message: copy.testSentenceRequired }]}
              >
                <TextArea rows={4} placeholder={copy.testPlaceholder} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={6}>
              <Form.Item label={copy.topK} name="top_k">
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
              message={recallResult.top_intent ? copy.matched : copy.unmatched}
              description={
                recallResult.top_intent
                  ? copy.matchedDesc.replace('{intent}', recallResult.top_intent.intent_code).replace('{mode}', recallResult.top_intent.dispatch_mode)
                  : copy.unmatchedDesc
              }
              style={{ marginBottom: 16 }}
            />

            {recallResult.top_intent && (
              <Card size="small" title={copy.top1} style={{ marginBottom: 16 }}>
                <Space wrap size={[8, 8]}>
                  <Tag color="blue">{recallResult.top_intent.intent_code}</Tag>
                  <Tag>{recallResult.top_intent.intent_name}</Tag>
                  <Tag color={dispatchColor[recallResult.top_intent.dispatch_mode] || 'default'}>
                    {recallResult.top_intent.dispatch_mode}
                  </Tag>
                  {recallResult.top_intent.tool_name && <Tag color="green">{copy.tool}：{recallResult.top_intent.tool_name}</Tag>}
                  {recallResult.top_intent.card_template_key && <Tag color="purple">{copy.card}：{recallResult.top_intent.card_template_key}</Tag>}
                  {typeof recallResult.top_intent.similarity === 'number' && (
                    <Tag color="geekblue">{copy.similarity}：{recallResult.top_intent.similarity.toFixed(4)}</Tag>
                  )}
                </Space>
              </Card>
            )}

            <Table
              rowKey="intent_code"
              size="small"
              pagination={false}
              dataSource={recallResult.all_results}
              locale={{ emptyText: copy.emptyCandidates }}
              columns={[
                { title: copy.colIntent, dataIndex: 'intent_code', width: 180, render: (value: string) => <Text code>{value}</Text> },
                { title: copy.colName, dataIndex: 'intent_name', width: 180 },
                {
                  title: copy.colDispatch,
                  dataIndex: 'dispatch_mode',
                  width: 160,
                  render: (value: string) => <Tag color={dispatchColor[value] || 'default'}>{value}</Tag>,
                },
                {
                  title: copy.colSimilarity,
                  dataIndex: 'similarity',
                  width: 120,
                  render: (value: number) => <Text>{typeof value === 'number' ? value.toFixed(4) : '-'}</Text>,
                },
              ]}
            />
          </div>
        )}
      </Card>

      <Card
        title={copy.vectorLibrary}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadLabels} loading={loadingLabels}>
              {copy.refresh}
            </Button>
            <Button type="primary" loading={seeding} onClick={handleSeed}>
              {copy.rebuild}
            </Button>
          </Space>
        }
      >
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          {copy.vectorHint}
        </Paragraph>
        <Table
          rowKey="id"
          loading={loadingLabels}
          size="small"
          dataSource={labels}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: copy.colCode,
              dataIndex: 'intent_code',
              width: 180,
              render: (value: string) => <Text code>{value}</Text>,
            },
            {
              title: copy.colName,
              dataIndex: 'intent_name',
              width: 180,
            },
            {
              title: copy.colDispatch,
              dataIndex: 'dispatch_mode',
              width: 150,
              render: (value: string) => <Tag color={dispatchColor[value] || 'default'}>{value}</Tag>,
            },
            {
              title: copy.colEmbedding,
              dataIndex: 'has_embedding',
              width: 110,
              render: (value: boolean) => (value ? <Tag color="green">{copy.hasEmbedding}</Tag> : <Tag color="orange">{copy.noEmbedding}</Tag>),
            },
            {
              title: copy.colThreshold,
              dataIndex: 'similarity_threshold',
              width: 80,
              render: (value?: number) => (typeof value === 'number' ? value.toFixed(2) : '-'),
            },
            {
              title: copy.colFlags,
              width: 170,
              render: (_: unknown, row: IntentLabel) => (
                <Space wrap size={[4, 4]}>
                  {row.tool_name && <Tag color="green">{copy.flagTool}</Tag>}
                  {row.card_template_key && <Tag color="purple">{copy.flagCard}</Tag>}
                  {row.requires_confirmation && <Tag color="orange">{copy.flagConfirm}</Tag>}
                  {row.requires_payment && <Tag color="volcano">{copy.flagPay}</Tag>}
                  {!row.tool_name && !row.card_template_key && !row.requires_confirmation && !row.requires_payment && <Text type="secondary">{copy.noFlags}</Text>}
                </Space>
              ),
            },
            {
              title: copy.colActions,
              width: 130,
              render: (_: unknown, row: IntentLabel) => (
                <Button
                  size="small"
                  loading={reEmbeddingCode === row.intent_code}
                  onClick={() => handleReEmbed(row.intent_code)}
                >
                  {copy.reEmbed}
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  )
}
