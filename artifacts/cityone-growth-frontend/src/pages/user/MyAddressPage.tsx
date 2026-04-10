import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, App, Modal, Form, Input, Tag, Empty } from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EnvironmentOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleFilled,
  HomeOutlined,
  BankOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useI18n, type AppLanguage } from '../../i18n'
import request from '../../api/request'
import { getDeviceUserId } from '../../utils/deviceUserId'

type Address = {
  id: string
  user_id: string
  contact_name: string
  contact_phone: string
  address: string
  label: string | null
  is_default: boolean
  created_at: string | null
}

const LABEL_OPTIONS = [
  { value: '家', icon: <HomeOutlined />, en: 'Home', th: 'บ้าน' },
  { value: '公司', icon: <BankOutlined />, en: 'Office', th: 'ที่ทำงาน' },
  { value: '其他', icon: <UserOutlined />, en: 'Other', th: 'อื่นๆ' },
]

export default function MyAddressPage() {
  const { message, modal } = App.useApp()
  const nav = useNavigate()
  const { language, t } = useI18n()
  const lang = language as AppLanguage
  const userId = getDeviceUserId()

  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editAddr, setEditAddr] = useState<Address | null>(null)
  const [form] = Form.useForm()
  const [selectedLabel, setSelectedLabel] = useState<string>('')

  const T = {
    pageTitle:    lang === 'zh' ? '收货地址' : lang === 'th' ? 'ที่อยู่จัดส่ง' : 'Shipping Addresses',
    addNew:       lang === 'zh' ? '新增地址' : lang === 'th' ? 'เพิ่มที่อยู่ใหม่' : 'Add Address',
    editTitle:    lang === 'zh' ? '编辑地址' : lang === 'th' ? 'แก้ไขที่อยู่' : 'Edit Address',
    noAddr:       lang === 'zh' ? '暂无收货地址' : lang === 'th' ? 'ยังไม่มีที่อยู่จัดส่ง' : 'No shipping addresses yet',
    noAddrHint:   lang === 'zh' ? '点击右上角 + 新增收货地址' : lang === 'th' ? 'แตะ + เพื่อเพิ่มที่อยู่' : 'Tap + to add an address',
    defaultTag:   lang === 'zh' ? '默认' : lang === 'th' ? 'ค่าเริ่มต้น' : 'Default',
    setDefault:   lang === 'zh' ? '设为默认' : lang === 'th' ? 'ตั้งเป็นค่าเริ่มต้น' : 'Set Default',
    edit:         lang === 'zh' ? '编辑' : lang === 'th' ? 'แก้ไข' : 'Edit',
    delete:       lang === 'zh' ? '删除' : lang === 'th' ? 'ลบ' : 'Delete',
    deleteConfirm: lang === 'zh' ? '确认删除此地址？' : lang === 'th' ? 'ยืนยันลบที่อยู่นี้?' : 'Delete this address?',
    cancel:       lang === 'zh' ? '取消' : lang === 'th' ? 'ยกเลิก' : 'Cancel',
    confirm:      lang === 'zh' ? '确定' : lang === 'th' ? 'ยืนยัน' : 'Confirm',
    save:         lang === 'zh' ? '保存' : lang === 'th' ? 'บันทึก' : 'Save',
    labelField:   lang === 'zh' ? '地址标签' : lang === 'th' ? 'ป้ายกำกับ' : 'Label',
    nameField:    lang === 'zh' ? '收货人姓名' : lang === 'th' ? 'ชื่อผู้รับ' : 'Recipient Name',
    phoneField:   lang === 'zh' ? '手机号码' : lang === 'th' ? 'เบอร์โทร' : 'Phone',
    addressField: lang === 'zh' ? '详细地址' : lang === 'th' ? 'ที่อยู่แบบละเอียด' : 'Full Address',
    namePh:       lang === 'zh' ? '请输入收货人姓名' : lang === 'th' ? 'กรอกชื่อผู้รับ' : 'Recipient name',
    phonePh:      lang === 'zh' ? '请输入手机号' : lang === 'th' ? 'กรอกเบอร์โทร' : 'Phone number',
    addressPh:    lang === 'zh' ? '省/府 • 市区 • 街道 • 门牌号' : lang === 'th' ? 'จังหวัด เขต ถนน บ้านเลขที่' : 'Province · District · Street · No.',
    required:     lang === 'zh' ? '必填' : lang === 'th' ? 'จำเป็น' : 'Required',
    setDefaultSuccess: lang === 'zh' ? '已设为默认地址' : lang === 'th' ? 'ตั้งค่าเริ่มต้นแล้ว' : 'Default address updated',
    saveSuccess:  lang === 'zh' ? '地址已保存' : lang === 'th' ? 'บันทึกที่อยู่แล้ว' : 'Address saved',
    deleteSuccess: lang === 'zh' ? '地址已删除' : lang === 'th' ? 'ลบที่อยู่แล้ว' : 'Address deleted',
  }

  const load = async () => {
    setLoading(true)
    try {
      const res: any = await (request.get as any)(`/growth/user/addresses?user_id=${encodeURIComponent(userId)}`)
      setAddresses(res?.data || res || [])
    } catch {
      setAddresses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditAddr(null)
    setSelectedLabel('')
    form.resetFields()
    setFormOpen(true)
  }

  const openEdit = (addr: Address) => {
    setEditAddr(addr)
    setSelectedLabel(addr.label || '')
    form.setFieldsValue({
      contact_name: addr.contact_name,
      contact_phone: addr.contact_phone,
      address: addr.address,
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    let values: any
    try { values = await form.validateFields() } catch { return }
    setSaving(true)
    try {
      const payload = {
        user_id: userId,
        contact_name: values.contact_name,
        contact_phone: values.contact_phone,
        address: values.address,
        label: selectedLabel || null,
      }
      if (editAddr) {
        await (request.put as any)(`/growth/user/addresses/${editAddr.id}`, payload)
      } else {
        await (request.post as any)('/growth/user/addresses', payload)
      }
      message.success(T.saveSuccess)
      setFormOpen(false)
      await load()
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (addr: Address) => {
    modal.confirm({
      title: T.deleteConfirm,
      content: `${addr.contact_name}  ${addr.address}`,
      okText: T.confirm,
      cancelText: T.cancel,
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          await (request.delete as any)(`/growth/user/addresses/${addr.id}?user_id=${encodeURIComponent(userId)}`)
          message.success(T.deleteSuccess)
          await load()
        } catch (e: any) {
          message.error(e?.message || '删除失败')
        }
      },
    })
  }

  const handleSetDefault = async (addr: Address) => {
    if (addr.is_default) return
    try {
      await (request.post as any)(`/growth/user/addresses/${addr.id}/default`, { user_id: userId })
      message.success(T.setDefaultSuccess)
      await load()
    } catch (e: any) {
      message.error(e?.message || '操作失败')
    }
  }

  const labelDisplay = (addr: Address) => {
    if (!addr.label) return null
    const opt = LABEL_OPTIONS.find(o => o.value === addr.label)
    const text = opt
      ? (lang === 'en' ? opt.en : lang === 'th' ? opt.th : opt.value)
      : addr.label
    return (
      <Tag color="blue" style={{ fontSize: 11, borderRadius: 8, padding: '0 6px' }}>
        {opt?.icon} {text}
      </Tag>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9FC', paddingBottom: 80 }}>
      {/* 顶栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, borderBottom: '1px solid #f0f0f0' }}>
        <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, marginRight: 8, display: 'flex', alignItems: 'center', color: '#333' }}>
          <ArrowLeftOutlined style={{ fontSize: 20 }} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, flex: 1 }}>{T.pageTitle}</span>
        <button
          onClick={openAdd}
          style={{ background: '#2F80FF', border: 'none', borderRadius: 24, color: '#fff', fontWeight: 700, fontSize: 14, padding: '6px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <PlusOutlined /> {T.addNew}
        </button>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px 0' }}>
        <Spin spinning={loading}>
          {!loading && addresses.length === 0 ? (
            <Empty
              image={<EnvironmentOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
              imageStyle={{ height: 72 }}
              description={
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#555', marginBottom: 4 }}>{T.noAddr}</div>
                  <div style={{ fontSize: 13, color: '#aaa' }}>{T.noAddrHint}</div>
                </div>
              }
              style={{ marginTop: 60 }}
            />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {addresses.map(addr => (
                <div
                  key={addr.id}
                  onClick={() => handleSetDefault(addr)}
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: '16px 16px 12px',
                    border: addr.is_default ? '2px solid #2F80FF' : '2px solid transparent',
                    boxShadow: addr.is_default ? '0 4px 16px rgba(47,128,255,0.12)' : '0 2px 10px rgba(0,0,0,0.06)',
                    cursor: addr.is_default ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* 顶行：标签 + 默认标记 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    {labelDisplay(addr)}
                    {addr.is_default && (
                      <Tag color="blue" style={{ fontSize: 11, borderRadius: 8 }}>
                        <CheckCircleFilled style={{ marginRight: 3 }} />{T.defaultTag}
                      </Tag>
                    )}
                    {!addr.is_default && (
                      <span style={{ fontSize: 11, color: '#aaa' }}>{T.setDefault}</span>
                    )}
                  </div>

                  {/* 联系人信息 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: '#111' }}>{addr.contact_name}</span>
                    <span style={{ fontSize: 14, color: '#666' }}>{addr.contact_phone}</span>
                  </div>

                  {/* 地址 */}
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
                    <EnvironmentOutlined style={{ color: '#2F80FF', marginRight: 5, fontSize: 13 }} />
                    {addr.address}
                  </div>

                  {/* 操作按钮 */}
                  <div
                    style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #F0F4F8', paddingTop: 10 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => openEdit(addr)}
                      style={{ background: 'none', border: '1px solid #d9d9d9', borderRadius: 20, padding: '5px 14px', fontSize: 13, color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <EditOutlined /> {T.edit}
                    </button>
                    <button
                      onClick={() => handleDelete(addr)}
                      style={{ background: 'none', border: '1px solid #ffa39e', borderRadius: 20, padding: '5px 14px', fontSize: 13, color: '#ff4d4f', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <DeleteOutlined /> {T.delete}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Spin>
      </div>

      {/* 新增/编辑 弹窗 */}
      <Modal
        title={editAddr ? T.editTitle : T.addNew}
        open={formOpen}
        onCancel={() => !saving && setFormOpen(false)}
        onOk={handleSave}
        okText={T.save}
        cancelText={T.cancel}
        confirmLoading={saving}
        destroyOnHidden
      >
        {/* 标签快选 */}
        <div style={{ marginBottom: 12, paddingTop: 8 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{T.labelField}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {LABEL_OPTIONS.map(opt => {
              const text = lang === 'en' ? opt.en : lang === 'th' ? opt.th : opt.value
              const active = selectedLabel === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setSelectedLabel(active ? '' : opt.value)}
                  style={{
                    border: active ? '2px solid #2F80FF' : '1px solid #d9d9d9',
                    borderRadius: 20,
                    padding: '5px 14px',
                    background: active ? '#EAF2FF' : '#fff',
                    color: active ? '#2F80FF' : '#555',
                    fontWeight: active ? 700 : 400,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.icon} {text}
                </button>
              )
            })}
          </div>
        </div>

        <Form form={form} layout="vertical" size="middle">
          <Form.Item
            name="contact_name"
            label={T.nameField}
            rules={[{ required: true, message: T.required }]}
          >
            <Input prefix={<UserOutlined style={{ color: '#bbb' }} />} placeholder={T.namePh} />
          </Form.Item>
          <Form.Item
            name="contact_phone"
            label={T.phoneField}
            rules={[{ required: true, message: T.required }]}
          >
            <Input placeholder={T.phonePh} />
          </Form.Item>
          <Form.Item
            name="address"
            label={T.addressField}
            rules={[{ required: true, message: T.required }]}
          >
            <Input.TextArea rows={3} placeholder={T.addressPh} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
