import React, { useEffect, useState } from 'react'
import { Table, Button, Tag, Switch, Modal, Form, Input, message, Alert, Space } from 'antd'
import { PlusOutlined, EditOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { getAgentIntents, updateAgentIntent, createAgentIntent } from '../../api/agent-admin'
import { useI18n } from '../../i18n'

const { TextArea } = Input

function phrasesToStr(arr?: string[]) { return (arr || []).join('\n') }
function strToPhrases(s?: string) { return (s || '').split('\n').map(x => x.trim()).filter(Boolean) }

export default function AgentIntentManage() {
  const { t } = useI18n()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAgentIntents()
      setData(res.data?.data || res.data?.list || [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (row: any) => {
    setEditing(row)
    form.setFieldsValue({
      code: row.intent_code || row.code,
      name: row.intent_name || row.name,
      phrases_zh: phrasesToStr(row.phrases?.zh),
      phrases_th: phrasesToStr(row.phrases?.th),
      phrases_en: phrasesToStr(row.phrases?.en),
      resp_zh: row.template_responses?.zh || '',
      resp_th: row.template_responses?.th || '',
      resp_en: row.template_responses?.en || '',
      enabled: row.enabled !== false,
    })
    setModalOpen(true)
  }

  const onSave = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        intent_code: values.code,
        intent_name: values.name,
        enabled: values.enabled !== false,
        phrases: {
          zh: strToPhrases(values.phrases_zh),
          th: strToPhrases(values.phrases_th),
          en: strToPhrases(values.phrases_en),
        },
        template_responses: {
          zh: values.resp_zh || '',
          th: values.resp_th || '',
          en: values.resp_en || '',
        },
      }
      if (editing) {
        await updateAgentIntent({ ...payload, id: editing.id })
        message.success(t('agentIntentManage.savedOk'))
      } else {
        await createAgentIntent(payload)
        message.success(t('agentIntentManage.createdOk'))
      }
      setModalOpen(false)
      load()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(t('agentIntentManage.saveError'))
      setModalOpen(false)
      load()
    }
  }

  const toggleEnabled = async (row: any) => {
    try {
      await updateAgentIntent({ id: row.id, enabled: !row.enabled })
      load()
    } catch {
      message.error(t('agentIntentManage.toggleError'))
    }
  }

  const columns = [
    {
      title: t('agentIntentManage.colCode'),
      dataIndex: 'intent_code',
      width: 160,
      render: (v: string, row: any) => <code style={{ fontSize: 12 }}>{v || row.code}</code>,
    },
    {
      title: t('agentIntentManage.colName'),
      dataIndex: 'intent_name',
      width: 140,
      render: (v: string, row: any) => v || row.name,
    },
    {
      title: t('agentIntentManage.colPhrases'),
      width: 220,
      render: (_: any, row: any) => {
        const all = [
          ...(row.phrases?.zh || []),
          ...(row.phrases?.th || []),
          ...(row.phrases?.en || []),
        ].slice(0, 4)
        return all.length
          ? <Space wrap>{all.map((p: string, i: number) => <Tag key={i}>{p}</Tag>)}</Space>
          : <span style={{ color: '#999' }}>{t('agentIntentManage.noPhrases')}</span>
      },
    },
    {
      title: t('agentIntentManage.colRespPreview'),
      width: 200,
      render: (_: any, row: any) => {
        const resp = row.template_responses?.zh
        return resp
          ? <span style={{ fontSize: 12, color: '#555' }}>{resp.slice(0, 40)}{resp.length > 40 ? '…' : ''}</span>
          : <span style={{ color: '#bbb' }}>{t('agentIntentManage.noResp')}</span>
      },
    },
    {
      title: t('agentIntentManage.colEnabled'),
      dataIndex: 'enabled',
      width: 80,
      render: (_: any, row: any) => (
        <Switch size="small" checked={row.enabled !== false} onChange={() => toggleEnabled(row)} />
      ),
    },
    {
      title: t('agentIntentManage.colActions'),
      width: 80,
      render: (_: any, row: any) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
          {t('agentIntentManage.editBtn')}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{t('agentIntentManage.pageTitle')}</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('agentIntentManage.newIntent')}</Button>
      </div>

      <Alert
        icon={<InfoCircleOutlined />}
        type="info"
        showIcon
        message={t('agentIntentManage.bannerTip')}
        style={{ marginBottom: 16 }}
      />

      <Table
        rowKey="id"
        dataSource={data}
        columns={columns}
        loading={loading}
        scroll={{ x: 800 }}
        pagination={{ pageSize: 15 }}
      />

      <Modal
        open={modalOpen}
        title={editing ? t('agentIntentManage.editTitle') : t('agentIntentManage.createTitle')}
        onCancel={() => setModalOpen(false)}
        onOk={onSave}
        okText={t('agentIntentManage.saveBtn')}
        cancelText={t('agentIntentManage.cancelBtn')}
        width={660}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ enabled: true }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label={t('agentIntentManage.formCode')} name="code" rules={[{ required: true }]}>
              <Input placeholder="例：promo_activity" disabled={!!editing} />
            </Form.Item>
            <Form.Item label={t('agentIntentManage.formName')} name="name" rules={[{ required: true }]}>
              <Input placeholder="例：活动咨询特殊模板" />
            </Form.Item>
          </div>

          <div style={{ fontWeight: 600, marginBottom: 8, color: '#333' }}>触发关键词</div>
          <Form.Item label={t('agentIntentManage.formPhrasesZh')} name="phrases_zh">
            <TextArea rows={2} placeholder={'领优惠\n有什么活动'} />
          </Form.Item>
          <Form.Item label={t('agentIntentManage.formPhrasesTh')} name="phrases_th">
            <TextArea rows={2} placeholder={'มีโปรโมชั่น\nส่วนลด'} />
          </Form.Item>
          <Form.Item label={t('agentIntentManage.formPhrasesEn')} name="phrases_en">
            <TextArea rows={2} placeholder={'any promotions\ndiscount'} />
          </Form.Item>

          <div style={{ fontWeight: 600, marginBottom: 8, color: '#333', marginTop: 8 }}>命中时预设回复</div>
          <Form.Item label={t('agentIntentManage.formRespZh')} name="resp_zh">
            <TextArea rows={2} placeholder="（中文预设回复，为空则交给 LLM）" />
          </Form.Item>
          <Form.Item label={t('agentIntentManage.formRespTh')} name="resp_th">
            <TextArea rows={2} placeholder="（泰文预设回复，选填）" />
          </Form.Item>
          <Form.Item label={t('agentIntentManage.formRespEn')} name="resp_en">
            <TextArea rows={2} placeholder="（英文预设回复，选填）" />
          </Form.Item>

          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
