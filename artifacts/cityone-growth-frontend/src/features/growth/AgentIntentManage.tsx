import React, { useEffect, useState } from 'react'
import { Table, Button, Tag, Switch, Modal, Form, Input, Select, message, Space } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import { getAgentIntents, updateAgentIntent, createAgentIntent } from '../../api/agent-admin'
import { useI18n } from '../../i18n'

const { TextArea } = Input

export default function AgentIntentManage() {
  const { t } = useI18n()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const MODULES = [
    { value: 'borrow', label: t('agentIntentManage.modBorrow') },
    { value: 'coupon', label: t('agentIntentManage.modCoupon') },
    { value: 'points', label: t('agentIntentManage.modPoints') },
    { value: 'invite', label: t('agentIntentManage.modInvite') },
    { value: 'order', label: t('agentIntentManage.modOrder') },
    { value: 'site', label: t('agentIntentManage.modSite') },
    { value: 'activity', label: t('agentIntentManage.modActivity') },
    { value: 'general', label: t('agentIntentManage.modGeneral') },
  ]

  const TIERS = [
    { value: 'guest', label: t('agentIntentManage.tierGuest') },
    { value: 'fan', label: t('agentIntentManage.tierFan') },
    { value: 'user', label: t('agentIntentManage.tierUser') },
    { value: 'member', label: t('agentIntentManage.tierMember') },
  ]

  const MOCK_DATA = [
    { id: '1', code: 'borrow_guide', name: t('agentIntentManage.modBorrow'), module: 'borrow', enabled: true, requireConfirm: false, tiers: ['guest', 'fan', 'user', 'member'], hitCount: 1024, tool: 'site_search' },
    { id: '2', code: 'coupon_query', name: t('agentIntentManage.modCoupon'), module: 'coupon', enabled: true, requireConfirm: false, tiers: ['fan', 'user', 'member'], hitCount: 867, tool: 'coupon_list' },
    { id: '3', code: 'points_redeem', name: t('agentIntentManage.modPoints'), module: 'points', enabled: true, requireConfirm: true, tiers: ['user', 'member'], hitCount: 456, tool: 'points_exchange' },
    { id: '4', code: 'invite_help', name: t('agentIntentManage.modInvite'), module: 'invite', enabled: true, requireConfirm: false, tiers: ['member'], hitCount: 231, tool: 'share_welfare' },
    { id: '5', code: 'order_query', name: t('agentIntentManage.modOrder'), module: 'order', enabled: true, requireConfirm: false, tiers: ['user', 'member'], hitCount: 389, tool: 'order_search' },
  ]

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAgentIntents()
      setData(res.data?.data || res.data?.list || MOCK_DATA)
    } catch {
      setData(MOCK_DATA)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (row: any) => {
    setEditing(row)
    form.setFieldsValue({
      ...row,
      alias_zh: row.alias?.zh,
      alias_th: row.alias?.th,
      alias_en: row.alias?.en,
      replyTemplate: row.replyTemplate,
      fallbackText: row.fallbackText,
    })
    setModalOpen(true)
  }

  const onSave = async () => {
    try {
      const values = await form.validateFields()
      const payload = { ...values, alias: { zh: values.alias_zh, th: values.alias_th, en: values.alias_en } }
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
    { title: t('agentIntentManage.colCode'), dataIndex: 'code', width: 160, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: t('agentIntentManage.colName'), dataIndex: 'name', width: 140 },
    { title: t('agentIntentManage.colModule'), dataIndex: 'module', width: 110, render: (v: string) => <Tag>{MODULES.find((m) => m.value === v)?.label || v}</Tag> },
    { title: t('agentIntentManage.colTiers'), dataIndex: 'tiers', width: 200, render: (v: string[]) => (v || []).map((tier) => <Tag key={tier} color="blue">{TIERS.find((i) => i.value === tier)?.label || tier}</Tag>) },
    { title: t('agentIntentManage.colConfirm'), dataIndex: 'requireConfirm', width: 80, render: (v: boolean) => v ? <Tag color="orange">{t('agentIntentManage.confirmYes')}</Tag> : <Tag color="default">{t('agentIntentManage.confirmNo')}</Tag> },
    { title: t('agentIntentManage.colTool'), dataIndex: 'tool', width: 140, render: (v: string) => v ? <code style={{ fontSize: 12 }}>{v}</code> : '-' },
    { title: t('agentIntentManage.colHits'), dataIndex: 'hitCount', width: 90, align: 'right' as const },
    { title: t('agentIntentManage.colEnabled'), dataIndex: 'enabled', width: 80, render: (_: any, row: any) => <Switch size="small" checked={row.enabled} onChange={() => toggleEnabled(row)} /> },
    { title: t('agentIntentManage.colActions'), width: 80, render: (_: any, row: any) => <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>{t('agentIntentManage.editBtn')}</Button> },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{t('agentIntentManage.pageTitle')}</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('agentIntentManage.newIntent')}</Button>
      </div>

      <Table
        rowKey="id"
        dataSource={data}
        columns={columns}
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 15 }}
      />

      <Modal
        open={modalOpen}
        title={editing ? t('agentIntentManage.editTitle') : t('agentIntentManage.createTitle')}
        onCancel={() => setModalOpen(false)}
        onOk={onSave}
        okText={t('agentIntentManage.saveBtn')}
        cancelText={t('agentIntentManage.cancelBtn')}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label={t('agentIntentManage.formCode')} name="code" rules={[{ required: true }]}>
              <Input placeholder="如：borrow_guide" disabled={!!editing} />
            </Form.Item>
            <Form.Item label={t('agentIntentManage.formName')} name="name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label={t('agentIntentManage.formModule')} name="module" rules={[{ required: true }]}>
              <Select options={MODULES} />
            </Form.Item>
            <Form.Item label={t('agentIntentManage.formTool')} name="tool">
              <Input placeholder="如：site_search" />
            </Form.Item>
            <Form.Item label={t('agentIntentManage.formTiers')} name="tiers">
              <Select mode="multiple" options={TIERS} />
            </Form.Item>
            <Form.Item label={t('agentIntentManage.formConfirm')} name="requireConfirm" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Form.Item label={t('agentIntentManage.formAliasZh')} name="alias_zh"><Input /></Form.Item>
          <Form.Item label={t('agentIntentManage.formAliasTh')} name="alias_th"><Input /></Form.Item>
          <Form.Item label={t('agentIntentManage.formAliasEn')} name="alias_en"><Input /></Form.Item>
          <Form.Item label={t('agentIntentManage.formTemplate')} name="replyTemplate"><TextArea rows={2} /></Form.Item>
          <Form.Item label={t('agentIntentManage.formFallback')} name="fallbackText"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
