import React, { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Col,
  Row,
  Table,
  Tag,
  Typography,
  Space,
  Alert,
  Tabs,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
} from 'antd'
import {
  getEntryConfig,
  getEntryAllowedTypes,
  getEntryFeatureRules,
  getEntryTemplateList,
  createEntryTemplate,
  updateEntryTemplate,
  deleteEntryTemplate,
  getEntryInstanceList,
  createEntryInstance,
  updateEntryInstance,
  disableEntryInstance,
  getQrAssetList,
} from '../../api/growth'
import QRCode from 'qrcode'
import { useI18n } from '../../i18n'

const { Title, Text } = Typography

type EntryConfigData = {
  allowed_entry_types?: string[]
  onsite_business_entry_types?: string[]
  forced_feature_enabled?: boolean
  user_stage_labels?: Record<string, string>
  feature_route_rules?: {
    by_site_and_entry_type?: Array<{
      site_id: string
      entry_type: string
      feature_name: string
    }>
    by_entry_type?: Record<string, string>
    fallback_feature_name?: string
  }
}

type EntryTemplate = {
  template_id: string
  template_name: string
  entry_type: string
  default_feature_name: string
  status: string
}

type EntryInstance = {
  entry_id: string
  site_id: string
  site_name: string
  entry_type: string
  entry_code: string
  current_feature_name: string
  status: string
}

type QrAsset = {
  qr_id: string
  entry_id: string
  site_id: string
  site_name: string
  entry_type: string
  entry_code: string
  qr_scene: string
  short_link: string
  current_route_rule_id: string
  current_feature_name: string
  status: string
  print_batch_no: string
  last_scan_at: string
  total_scan_count: number
}

function getQrTypeLabel(entryType: string, qrScene: string) {
  if (entryType === 'device_qr') return '设备码'
  if (entryType === 'table_card') return '桌贴码'
  if (entryType === 'staff_share') return '店员码'
  if (entryType === 'poster_qr' || entryType === 'rollup_banner') return '海报码'
  return qrScene || entryType
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeCsv(value: unknown) {
  const raw = String(value ?? '')
  return `"${raw.replace(/"/g, '""')}"`
}

export default function EntryCenter() {
  const { t } = useI18n('admin')
  const et = (key: string) => t(`admin.entry.${key}`)
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<EntryConfigData | null>(null)
  const [allowedTypes, setAllowedTypes] = useState<string[]>([])
  const [siteRules, setSiteRules] = useState<Array<{ site_id: string; entry_type: string; feature_name: string }>>([])
  const [entryTypeRules, setEntryTypeRules] = useState<Array<{ entry_type: string; feature_name: string }>>([])
  const [templates, setTemplates] = useState<EntryTemplate[]>([])
  const [entries, setEntries] = useState<EntryInstance[]>([])
  const [qrAssets, setQrAssets] = useState<QrAsset[]>([])
  const [error, setError] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateEditOpen, setTemplateEditOpen] = useState(false)
  const [entryOpen, setEntryOpen] = useState(false)
  const [entryEditOpen, setEntryEditOpen] = useState(false)
  const [qrDetailOpen, setQrDetailOpen] = useState(false)
  const [selectedQr, setSelectedQr] = useState<QrAsset | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<EntryTemplate | null>(null)
  const [editingEntry, setEditingEntry] = useState<EntryInstance | null>(null)
  const [templateForm] = Form.useForm()
  const [templateEditForm] = Form.useForm()
  const [entryForm] = Form.useForm()
  const [entryEditForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError('')

      const [configRes, allowedRes, rulesRes, templateRes, entryRes, qrRes] = await Promise.all([
        getEntryConfig(),
        getEntryAllowedTypes(),
        getEntryFeatureRules(),
        getEntryTemplateList(),
        getEntryInstanceList(),
        getQrAssetList(),
      ])

      const configData = configRes?.data || {}
      const allowedData = allowedRes?.data?.allowed_entry_types || []
      const rulesData = rulesRes?.data || {}

      setConfig(configData)
      setAllowedTypes(allowedData)
      setSiteRules(rulesData.by_site_and_entry_type || [])
      setEntryTypeRules(
        Object.entries(rulesData.by_entry_type || {}).map(([entry_type, feature_name]) => ({
          entry_type,
          feature_name: String(feature_name),
        })),
      )
      setTemplates(templateRes?.data || [])
      setEntries(entryRes?.data || [])
      setQrAssets(qrRes?.data || [])
    } catch (err: any) {
      setError(err?.message || et('loadError'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateTemplate(values: any) {
    try {
      await createEntryTemplate(values)
      message.success(et('createTemplateSuccess'))
      setTemplateOpen(false)
      templateForm.resetFields()
      await loadData()
    } catch (err: any) {
      setError(err?.message || et('createTemplateError'))
    }
  }

  async function handleCreateEntry(values: any) {
    try {
      await createEntryInstance(values)
      message.success(et('createEntrySuccess'))
      setEntryOpen(false)
      entryForm.resetFields()
      await loadData()
    } catch (err: any) {
      setError(err?.message || et('createEntryError'))
    }
  }

  function openTemplateEdit(record: EntryTemplate) {
    setEditingTemplate(record)
    templateEditForm.setFieldsValue({
      template_name: record.template_name,
      entry_type: record.entry_type,
      default_feature_name: record.default_feature_name,
    })
    setTemplateEditOpen(true)
  }

  async function handleEditTemplate(values: any) {
    if (!editingTemplate) return

    try {
      await updateEntryTemplate(editingTemplate.template_id, values)
      message.success(et('updateTemplateSuccess'))
      setTemplateEditOpen(false)
      setEditingTemplate(null)
      templateEditForm.resetFields()
      await loadData()
    } catch (err: any) {
      setError(err?.message || et('updateTemplateError'))
    }
  }

  async function handleDeleteTemplate(record: EntryTemplate) {
    try {
      await deleteEntryTemplate(record.template_id)
      message.success(et('deleteTemplateSuccess'))
      await loadData()
    } catch (err: any) {
      setError(err?.message || et('deleteTemplateError'))
    }
  }

  function openEntryEdit(record: EntryInstance) {
    setEditingEntry(record)
    entryEditForm.setFieldsValue({
      site_id: record.site_id,
      site_name: record.site_name,
      entry_type: record.entry_type,
      entry_code: record.entry_code,
      current_feature_name: record.current_feature_name,
    })
    setEntryEditOpen(true)
  }

  async function handleEditEntry(values: any) {
    if (!editingEntry) return

    try {
      await updateEntryInstance(editingEntry.entry_id, values)
      message.success(et('updateEntrySuccess'))
      setEntryEditOpen(false)
      setEditingEntry(null)
      entryEditForm.resetFields()
      await loadData()
    } catch (err: any) {
      setError(err?.message || et('updateEntryError'))
    }
  }

  async function handleDisableEntry(record: EntryInstance) {
    try {
      await disableEntryInstance(record.entry_id)
      message.success(et('disableEntrySuccess'))
      await loadData()
    } catch (err: any) {
      setError(err?.message || et('disableEntryError'))
    }
  }

  function handleViewQrDetail(record: QrAsset) {
    setSelectedQr(record)
    setQrDetailOpen(true)
  }

  function handleCloseQrDetail() {
    setQrDetailOpen(false)
    setSelectedQr(null)
  }

  async function handlePrintQr(record: QrAsset) {
    try {
      const printWindow = window.open('', 'cityone_qr_print_preview', 'width=960,height=760')

      if (!printWindow) {
        message.error(et('printWindowError'))
        return
      }

      const qrValue = record.short_link || record.entry_code || record.qr_id
      const qrDataUrl = await QRCode.toDataURL(qrValue, {
        width: 260,
        margin: 1,
      })

      const qrTypeLabel = getQrTypeLabel(record.entry_type, record.qr_scene)
      const safeShortLink = escapeHtml(record.short_link || '-')
      const safeSiteName = escapeHtml(record.site_name || '-')
      const safeFeatureName = escapeHtml(record.current_feature_name || '-')
      const safePrintBatchNo = escapeHtml(record.print_batch_no || '-')
      const safeLastScanAt = escapeHtml(record.last_scan_at || '-')
      const safeScanCount = escapeHtml(String(record.total_scan_count ?? '-'))
      const safeQrId = escapeHtml(record.qr_id)
      const safeEntryCode = escapeHtml(record.entry_code)
      const safeQrTypeLabel = escapeHtml(qrTypeLabel)

      const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>二维码打印预览 - ${safeQrId}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      color: #222;
      background: #fff;
    }
    .page {
      max-width: 820px;
      margin: 0 auto;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 24px;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .sub {
      font-size: 13px;
      color: #666;
      margin-bottom: 20px;
    }
    .grid {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 24px;
      align-items: start;
    }
    .qr-box {
      border: 1px dashed #999;
      border-radius: 12px;
      min-height: 280px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 16px;
      color: #666;
      background: #fafafa;
      font-size: 14px;
      line-height: 1.6;
      word-break: break-all;
      flex-direction: column;
    }
    .qr-box img {
      width: 220px;
      height: 220px;
      object-fit: contain;
      display: block;
      margin-bottom: 12px;
      background: #fff;
      padding: 8px;
      border-radius: 8px;
    }
    .info-item {
      margin-bottom: 12px;
      font-size: 16px;
      line-height: 1.7;
    }
    .label {
      font-weight: 700;
      display: inline-block;
      min-width: 100px;
    }
    .short-link {
      word-break: break-all;
      color: #1677ff;
    }
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #eee;
      font-size: 13px;
      color: #666;
    }
    .actions {
      margin-top: 20px;
      display: flex;
      gap: 12px;
    }
    .btn {
      border: 0;
      border-radius: 8px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 14px;
    }
    .btn-print {
      background: #1677ff;
      color: #fff;
    }
    .btn-close {
      background: #f3f4f6;
      color: #333;
    }
    @media print {
      body { padding: 0; }
      .page {
        max-width: none;
        border: 0;
        border-radius: 0;
        padding: 0;
      }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="title">${escapeHtml(et('printPreviewTitle'))}</div>
    <div class="sub">${escapeHtml(et('printPreviewSub'))}</div>

    <div class="grid">
      <div class="qr-box">
        <img src="${qrDataUrl}" alt="二维码" />
        <div style="font-weight:700;">${safeEntryCode}</div>
        <div style="margin-top:6px;">${safeShortLink}</div>
      </div>

      <div>
        <div class="info-item"><span class="label">${escapeHtml(et('qrId'))}：</span>${safeQrId}</div>
        <div class="info-item"><span class="label">${escapeHtml(et('siteName'))}：</span>${safeSiteName}</div>
        <div class="info-item"><span class="label">${escapeHtml(et('qrType'))}：</span>${safeQrTypeLabel}</div>
        <div class="info-item"><span class="label">${escapeHtml(et('entryCode'))}：</span>${safeEntryCode}</div>
        <div class="info-item"><span class="label">${escapeHtml(et('currentFeature'))}：</span>${safeFeatureName}</div>
        <div class="info-item"><span class="label">${escapeHtml(et('shortLink'))}：</span><span class="short-link">${safeShortLink}</span></div>
        <div class="info-item"><span class="label">${escapeHtml(et('printBatch'))}：</span>${safePrintBatchNo}</div>
        <div class="info-item"><span class="label">${escapeHtml(et('lastScan'))}：</span>${safeLastScanAt}</div>
        <div class="info-item"><span class="label">${escapeHtml(et('scanCount'))}：</span>${safeScanCount}</div>
      </div>
    </div>

    <div class="footer">
      ${escapeHtml(et('printPreviewFooter'))}
    </div>

    <div class="actions">
      <button class="btn btn-print" onclick="window.print()">${escapeHtml(et('printAction'))}</button>
      <button class="btn btn-close" onclick="window.close()">${escapeHtml(et('closePreview'))}</button>
    </div>
  </div>
</body>
</html>`

      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
    } catch (err: any) {
      message.error(err?.message || et('printPreviewError'))
    }
  }

  function handleExportQr(record: QrAsset) {
    try {
      const headers = [
        '二维码ID',
        '入口ID',
        '站点ID',
        '站点名称',
        '入口类型',
        '二维码类型',
        '入口编码',
        '短链地址',
        '当前规则',
        '当前玩法',
        '状态',
        '印刷批次',
        '最后扫码',
        '扫码次数',
      ]

      const row = [
        record.qr_id,
        record.entry_id,
        record.site_id,
        record.site_name,
        record.entry_type,
        getQrTypeLabel(record.entry_type, record.qr_scene),
        record.entry_code,
        record.short_link,
        record.current_route_rule_id,
        record.current_feature_name,
        record.status,
        record.print_batch_no,
        record.last_scan_at,
        record.total_scan_count,
      ]

      const csv = [headers, row]
        .map((line) => line.map(escapeCsv).join(','))
        .join('\\n')

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `${record.qr_id}_${record.entry_code}_二维码资产.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      message.success(et('exportSuccess').replace('{qrId}', record.qr_id))
    } catch (err: any) {
      message.error(err?.message || et('exportError'))
    }
  }
  const summaryCards = useMemo(
    () => [
      { title: et('cardAllowedTypes'), value: allowedTypes.length, color: '#1677ff' },
      { title: et('cardOnsiteTypes'), value: config?.onsite_business_entry_types?.length || 0, color: '#52c41a' },
      { title: et('cardTemplateCount'), value: templates.length, color: '#722ed1' },
      { title: et('cardQrCount'), value: qrAssets.length, color: '#fa8c16' },
    ],
    [allowedTypes.length, config?.onsite_business_entry_types, templates.length, qrAssets.length, t],
  )

  const tabItems = [
    {
      key: 'config',
      label: et('tabsConfig'),
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={[16, 16]}>
            {summaryCards.map((item) => (
              <Col xs={24} sm={12} lg={6} key={item.title}>
                <Card loading={loading}>
                  <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>{item.title}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{item.value}</div>
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title={et('baseConfig')} loading={loading}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <div>
                    <Text strong>{et('forcedFeature')}：</Text>{' '}
                    <Tag color={config?.forced_feature_enabled ? 'green' : 'default'}>
                      {config?.forced_feature_enabled ? et('enabledText') : et('disabledText')}
                    </Tag>
                  </div>

                  <div>
                    <Text strong>{et('fallbackFeature')}：</Text>{' '}
                    <Tag color="blue">{config?.feature_route_rules?.fallback_feature_name || '-'}</Tag>
                  </div>

                  <div>
                    <Text strong>{et('userStage')}：</Text>
                    <div style={{ marginTop: 8 }}>
                      {Object.entries(config?.user_stage_labels || {}).map(([key, value]) => (
                        <Tag key={key} style={{ marginBottom: 8 }}>
                          {key}：{value}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title={et('onsiteTypes')} loading={loading}>
                <div style={{ marginTop: 8 }}>
                  {(config?.onsite_business_entry_types || []).map((item) => (
                    <Tag key={item} color="green" style={{ marginBottom: 8 }}>
                      {item}
                    </Tag>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>
        </Space>
      ),
    },
    {
      key: 'types',
      label: et('tabsTypes'),
      children: (
        <Card title={et('allowedTypesTitle')} loading={loading}>
          <div style={{ marginTop: 8 }}>
            {allowedTypes.map((item) => (
              <Tag key={item} color="blue" style={{ marginBottom: 8 }}>
                {item}
              </Tag>
            ))}
          </div>
        </Card>
      ),
    },
    {
      key: 'templates',
      label: et('tabsTemplates'),
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card
            title={et('templateList')}
            extra={
              <Button type="primary" onClick={() => setTemplateOpen(true)}>
                新建模板
              </Button>
            }
          >
            <Table
              rowKey="template_id"
              pagination={false}
              dataSource={templates}
              columns={[
                { title: et('templateId'), dataIndex: 'template_id' },
                { title: et('templateName'), dataIndex: 'template_name' },
                { title: et('entryType'), dataIndex: 'entry_type' },
                { title: et('defaultFeature'), dataIndex: 'default_feature_name', render: (v) => <Tag color="purple">{v}</Tag> },
                { title: et('status'), dataIndex: 'status', render: (v) => <Tag color={v === 'enabled' ? 'green' : 'default'}>{v}</Tag> },
                {
                  title: et('actions'),
                  key: 'actions',
                  render: (_, record: EntryTemplate) => (
                    <Space wrap>
                      <Button size="small" onClick={() => openTemplateEdit(record)}>
                        编辑
                      </Button>
                      <Popconfirm
                        title={et('deleteTemplateConfirm')}
                        onConfirm={() => handleDeleteTemplate(record)}
                        okText={et('saveConfirm')}
                        cancelText={et('cancel')}
                      >
                        <Button size="small" danger>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>

          <Modal
            title={et('newTemplateTitle')}
            open={templateOpen}
            onCancel={() => setTemplateOpen(false)}
            onOk={() => templateForm.submit()}
            okText={et('saveConfirm')}
            cancelText={et('cancel')}
          >
            <Form form={templateForm} layout="vertical" onFinish={handleCreateTemplate}>
              <Form.Item name="template_name" label={et('templateNameLabel')} rules={[{ required: true, message: et('templateNameRequired') }]}>
                <Input placeholder={et('templateNamePlaceholder')} />
              </Form.Item>

              <Form.Item name="entry_type" label="入口类型" rules={[{ required: true, message: et('entryTypeRequired') }]}>
                <Select options={allowedTypes.map((item) => ({ label: item, value: item }))} />
              </Form.Item>

              <Form.Item name="default_feature_name" label={et('defaultFeature')} rules={[{ required: true, message: et('defaultFeatureRequired') }]}>
                <Input placeholder={et('defaultFeaturePlaceholder')} />
              </Form.Item>
            </Form>
          </Modal>

          <Modal
            title={et('editTemplateTitle')}
            open={templateEditOpen}
            onCancel={() => {
              setTemplateEditOpen(false)
              setEditingTemplate(null)
              templateEditForm.resetFields()
            }}
            onOk={() => templateEditForm.submit()}
            okText={et('updateConfirm')}
            cancelText={et('cancel')}
          >
            <Form form={templateEditForm} layout="vertical" onFinish={handleEditTemplate}>
              <Form.Item name="template_name" label={et('templateNameLabel')} rules={[{ required: true, message: et('templateNameRequired') }]}>
                <Input placeholder={et('templateNamePlaceholder')} />
              </Form.Item>

              <Form.Item name="entry_type" label="入口类型" rules={[{ required: true, message: et('entryTypeRequired') }]}>
                <Select options={allowedTypes.map((item) => ({ label: item, value: item }))} />
              </Form.Item>

              <Form.Item name="default_feature_name" label={et('defaultFeature')} rules={[{ required: true, message: et('defaultFeatureRequired') }]}>
                <Input placeholder={et('defaultFeaturePlaceholder')} />
              </Form.Item>
            </Form>
          </Modal>
        </Space>
      ),
    },
    {
      key: 'entries',
      label: et('tabsEntries'),
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card
            title={et('entryList')}
            extra={
              <Button type="primary" onClick={() => setEntryOpen(true)}>
                新建入口实例
              </Button>
            }
          >
            <Table
              rowKey="entry_id"
              pagination={false}
              dataSource={entries}
              columns={[
                { title: et('entryId'), dataIndex: 'entry_id' },
                { title: et('siteId'), dataIndex: 'site_id' },
                { title: et('siteName'), dataIndex: 'site_name' },
                { title: et('entryType'), dataIndex: 'entry_type' },
                { title: et('entryCode'), dataIndex: 'entry_code' },
                { title: et('currentFeature'), dataIndex: 'current_feature_name', render: (v) => <Tag color="blue">{v}</Tag> },
                { title: et('status'), dataIndex: 'status', render: (v) => <Tag color={v === 'enabled' ? 'green' : 'default'}>{v}</Tag> },
                {
                  title: et('actions'),
                  key: 'actions',
                  render: (_, record: EntryInstance) => (
                    <Space wrap>
                      <Button size="small" onClick={() => openEntryEdit(record)}>
                        编辑
                      </Button>
                      {record.status === 'enabled' ? (
                        <Popconfirm
                          title={et('disableEntryConfirm')}
                          onConfirm={() => handleDisableEntry(record)}
                          okText={et('saveConfirm')}
                          cancelText={et('cancel')}
                        >
                          <Button size="small">{et('disableEntry')}</Button>
                        </Popconfirm>
                      ) : (
                        <Tag>{et('disabledTag')}</Tag>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>

          <Modal
            title={et('newEntryTitle')}
            open={entryOpen}
            onCancel={() => setEntryOpen(false)}
            onOk={() => entryForm.submit()}
            okText={et('saveConfirm')}
            cancelText={et('cancel')}
          >
            <Form form={entryForm} layout="vertical" onFinish={handleCreateEntry}>
              <Form.Item name="site_id" label={et('siteId')} rules={[{ required: true, message: et('siteIdRequired') }]}>
                <Input placeholder={et('siteIdPlaceholder')} />
              </Form.Item>

              <Form.Item name="site_name" label={et('siteNameLabel')} rules={[{ required: true, message: et('siteNameRequired') }]}>
                <Input placeholder={et('siteNamePlaceholder')} />
              </Form.Item>

              <Form.Item name="entry_type" label="入口类型" rules={[{ required: true, message: et('entryTypeRequired') }]}>
                <Select options={allowedTypes.map((item) => ({ label: item, value: item }))} />
              </Form.Item>

              <Form.Item name="entry_code" label={et('entryCode')} rules={[{ required: true, message: et('entryCodeRequired') }]}>
                <Input placeholder={et('entryCodePlaceholder')} />
              </Form.Item>
            </Form>
          </Modal>

          <Modal
            title={et('editEntryTitle')}
            open={entryEditOpen}
            onCancel={() => {
              setEntryEditOpen(false)
              setEditingEntry(null)
              entryEditForm.resetFields()
            }}
            onOk={() => entryEditForm.submit()}
            okText={et('updateConfirm')}
            cancelText={et('cancel')}
          >
            <Form form={entryEditForm} layout="vertical" onFinish={handleEditEntry}>
              <Form.Item name="site_id" label={et('siteId')} rules={[{ required: true, message: et('siteIdRequired') }]}>
                <Input placeholder={et('siteIdPlaceholder')} />
              </Form.Item>

              <Form.Item name="site_name" label={et('siteNameLabel')} rules={[{ required: true, message: et('siteNameRequired') }]}>
                <Input placeholder={et('siteNamePlaceholder')} />
              </Form.Item>

              <Form.Item name="entry_type" label="入口类型" rules={[{ required: true, message: et('entryTypeRequired') }]}>
                <Select options={allowedTypes.map((item) => ({ label: item, value: item }))} />
              </Form.Item>

              <Form.Item name="entry_code" label={et('entryCode')} rules={[{ required: true, message: et('entryCodeRequired') }]}>
                <Input placeholder={et('entryCodePlaceholder')} />
              </Form.Item>

              <Form.Item name="current_feature_name" label={et('currentFeature')} rules={[{ required: true, message: et('currentFeatureRequired') }]}>
                <Input placeholder={et('currentFeaturePlaceholder')} />
              </Form.Item>
            </Form>
          </Modal>
        </Space>
      ),
    },
    {
      key: 'qr-assets',
      label: et('tabsQrs'),
      children: (
        <Card title={et('qrAssetList')}>
          <Table
            rowKey="qr_id"
            pagination={false}
            dataSource={qrAssets}
            columns={[
              { title: et('qrId'), dataIndex: 'qr_id' },
              { title: et('siteName'), dataIndex: 'site_name' },
              {
                title: et('qrType'),
                key: 'qr_type_label',
                render: (_, record: QrAsset) => <Tag>{getQrTypeLabel(record.entry_type, record.qr_scene)}</Tag>,
              },
              { title: et('currentFeature'), dataIndex: 'current_feature_name', render: (v) => <Tag color="purple">{v}</Tag> },
              { title: et('status'), dataIndex: 'status', render: (v) => <Tag color={v === 'enabled' ? 'green' : 'default'}>{v}</Tag> },
              {
                title: et('actions'),
                key: 'actions',
                render: (_, record: QrAsset) => (
                  <Space wrap>
                    <Button size="small" onClick={() => handleViewQrDetail(record)}>
                      查看详情
                    </Button>
                    <Button size="small" type="primary" ghost onClick={() => handlePrintQr(record)}>
                      打印二维码
                    </Button>
                    <Button size="small" onClick={() => handleExportQr(record)}>
                      导出占位
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      ),
    },
    {
      key: 'rules',
      label: et('tabsRules'),
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card title={et('siteEntryRules')} loading={loading}>
            <Table
              rowKey={(record) => `${record.site_id}-${record.entry_type}-${record.feature_name}`}
              pagination={false}
              dataSource={siteRules}
              columns={[
                { title: et('siteId'), dataIndex: 'site_id' },
                { title: et('entryType'), dataIndex: 'entry_type' },
                { title: et('targetFeature'), dataIndex: 'feature_name', render: (v) => <Tag color="purple">{v}</Tag> },
              ]}
            />
          </Card>

          <Card title={et('entryTypeDefaultRules')} loading={loading}>
            <Table
              rowKey={(record) => `${record.entry_type}-${record.feature_name}`}
              pagination={false}
              dataSource={entryTypeRules}
              columns={[
                { title: et('entryType'), dataIndex: 'entry_type' },
                { title: et('defaultFeature'), dataIndex: 'feature_name', render: (v) => <Tag color="gold">{v}</Tag> },
              ]}
            />
          </Card>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 8 }}>
          {et('title')}
        </Title>
        <Text type="secondary">
          {et('subtitle')}
        </Text>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Tabs defaultActiveKey="config" items={tabItems} />

      <Modal
        title={et('qrDetailTitle')}
        open={qrDetailOpen}
        onCancel={handleCloseQrDetail}
        footer={null}
        width={720}
      >
        {selectedQr ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div><Text strong>{et('qrId')}：</Text>{selectedQr.qr_id}</div>
            <div><Text strong>{et('siteName')}：</Text>{selectedQr.site_name}</div>
            <div><Text strong>{et('qrType')}：</Text>{getQrTypeLabel(selectedQr.entry_type, selectedQr.qr_scene)}</div>
            <div><Text strong>{et('entryCode')}：</Text>{selectedQr.entry_code}</div>
            <div><Text strong>{et('qrScene')}：</Text>{selectedQr.qr_scene}</div>
            <div><Text strong>{et('shortLink')}：</Text>{selectedQr.short_link}</div>
            <div><Text strong>{et('currentRule')}：</Text>{selectedQr.current_route_rule_id}</div>
            <div><Text strong>{et('currentFeature')}：</Text>{selectedQr.current_feature_name}</div>
            <div><Text strong>{et('printBatch')}：</Text>{selectedQr.print_batch_no}</div>
            <div><Text strong>{et('lastScan')}：</Text>{selectedQr.last_scan_at}</div>
            <div><Text strong>{et('scanCount')}：</Text>{selectedQr.total_scan_count}</div>
          </Space>
        ) : null}
      </Modal>
    </Space>
  )
}
