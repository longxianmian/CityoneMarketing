// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止页面自行 claim 或复活 auto=claim / fallback 恢复逻辑。
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Button,
  Card,
  Tag,
  Space,
  Spin,
  message,
  Modal,
  Form,
  Input,
  Radio,
  Divider,
} from 'antd'
import {
  ShareAltOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  CarOutlined,
  ShopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'
import OssImage, { useOssUrl } from '../../components/OssImage'
import SharePromoModal from '../../components/SharePromoModal'
import request from '../../api/request'
import { useFollowGate } from '../../hooks/useFollowGate'
import { useEffectiveUserId } from '../../hooks/useEffectiveUserId'
import { getBenefitPrimaryAction } from './benefitAction'

type Step = 'detail' | 'success'

function pickML(field: any, lang: string): string {
  if (!field) return ''
  if (typeof field === 'string') return field
  if (typeof field === 'object' && !Array.isArray(field)) {
    return field[lang] || field.en || field.zh || field.th || ''
  }
  return ''
}

function formatDiscount(c: any, language: string): string {
  const val = Number(c?.discount_value || 0)
  if (c?.discount_type === 'free_time' || c?.discount_type === 'free_minutes') {
    if (language === 'th') return `เวลาฟรี ${val} นาที`
    if (language === 'en') return `FREE ${val} min`
    return `免费时长 ${val} 分钟`
  }
  if (c?.discount_type === 'free_order') {
    if (language === 'th') return 'ฟรีออเดอร์'
    if (language === 'en') return 'FREE Order'
    return '免单券'
  }
  if (c?.discount_type === 'percent' || c?.discount_type === 'percentage_off') {
    const off = c?.discount_type === 'percentage_off' ? val : 100 - val
    if (language === 'th') return `ลด ${off}%`
    if (language === 'en') return `${off}% OFF`
    return `${off}% 折扣`
  }
  if (language === 'th') return `ลด ฿${val}`
  if (language === 'en') return `฿${val} OFF`
  return `减免 ฿${val}`
}

function formatDate(iso: string, language: string) {
  if (!iso) return '—'
  const d = dayjs(iso)
  if (language === 'th') return d.format('D MMM YYYY HH:mm')
  return d.format('YYYY-MM-DD HH:mm')
}

function pickOwnedBenefit(
  list: any[],
  couponId: string,
  userProductId: string
) {
  if (!Array.isArray(list) || !couponId) return null

  if (userProductId) {
    const matched = list.find((item) => item.user_product_id === userProductId)
    if (matched) return matched
  }

  const statusRank: Record<string, number> = {
    available: 0,
    used: 1,
    expired: 2,
  }

  return list
    .filter((item) => item.product_id === couponId)
    .sort((a, b) => (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99))[0] || null
}

export default function CouponUserPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { language } = useI18n()
  const { guard, checking } = useFollowGate()
  const effectiveUserId = useEffectiveUserId()

  const owned = searchParams.get('owned') === '1'
  const ownedUserProductId = searchParams.get('up') || ''

  const [shareVisible, setShareVisible] = useState(false)
  const [coupon, setCoupon] = useState<any>(null)
  const [ownedBenefit, setOwnedBenefit] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep] = useState<Step>('detail')
  const [alreadyClaimed, setAlreadyClaimed] = useState(false)
  const [videoStarted, setVideoStarted] = useState(false)
  const [videoPaused, setVideoPaused] = useState(false)
  const heroVideoRef = useRef<HTMLVideoElement>(null)

  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [deliveryMode, setDeliveryMode] = useState<'courier' | 'pickup'>('courier')
  const [deliveryForm] = Form.useForm()
  const [savedAddresses, setSavedAddresses] = useState<any[]>([])
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setNotFound(false)
      try {
        const [couponRes, benefitRes] = await Promise.allSettled([
          request.get('/user/coupons') as any,
          owned
            ? ((request.get('/user/benefits', {
                params: {
                  user_id: effectiveUserId,
                  page: 1,
                  page_size: 100,
                },
              }) as any))
            : Promise.resolve(null),
        ])

        if (!active) return

        const couponList: any[] =
          couponRes.status === 'fulfilled' ? couponRes.value?.data || [] : []
        const foundCoupon = couponList.find((item) => item.id === id) || null

        const benefitList: any[] =
          benefitRes.status === 'fulfilled' ? benefitRes.value?.data?.items || [] : []
        const foundBenefit = owned
          ? pickOwnedBenefit(benefitList, id, ownedUserProductId)
          : null

        setCoupon(foundCoupon)
        setOwnedBenefit(foundBenefit)

        if ((owned && !foundCoupon && !foundBenefit) || (!owned && !foundCoupon)) {
          setNotFound(true)
        }
      } catch {
        if (!active) return
        setCoupon(null)
        setOwnedBenefit(null)
        setNotFound(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [effectiveUserId, id, owned, ownedUserProductId])

  const detailData = owned
    ? {
        ...coupon,
        ...ownedBenefit,
        id: coupon?.id || ownedBenefit?.product_id || id,
      }
    : coupon
  const coverUrl = detailData?.cover_image || null
  const coverVideoUrl = detailData?.cover_video || null
  const resolvedCoverImageUrl = useOssUrl(coverUrl || undefined)
  const resolvedCoverVideoUrl = useOssUrl(coverVideoUrl || undefined)
  const videoReady = !!resolvedCoverVideoUrl

  const ownedStatus = ownedBenefit?.status || 'available'
  const primaryAction = owned
    ? getBenefitPrimaryAction({
        benefit: detailData,
        status: ownedStatus,
        language: (language === 'zh' || language === 'th' || language === 'en') ? language : 'zh',
        couponId: id,
        userProductId: ownedBenefit?.user_product_id || ownedUserProductId,
      })
    : null

  const handleStartVideo = async () => {
    setVideoStarted(true)
    const el = heroVideoRef.current
    if (!el) return
    setVideoPaused(false)
    try {
      await el.play()
    } catch {
      setVideoPaused(true)
    }
  }

  const toggleVideoPlay = async () => {
    const el = heroVideoRef.current
    if (!el) return
    if (el.paused) {
      try {
        await el.play()
        setVideoPaused(false)
      } catch {
        setVideoPaused(true)
      }
      return
    }
    el.pause()
    setVideoPaused(true)
  }

  const loadSavedAddresses = async () => {
    try {
      const res: any = await (request.get as any)(
        `/growth/user/addresses?user_id=${encodeURIComponent(effectiveUserId)}`
      )
      const list = res?.data || res || []
      setSavedAddresses(list)
      const def = list.find((a: any) => a.is_default) || list[0] || null
      if (def) {
        setSelectedAddrId(def.id)
        deliveryForm.setFieldsValue({
          delivery_name: def.contact_name,
          delivery_phone: def.contact_phone,
          delivery_address: def.address,
        })
      } else {
        setSelectedAddrId(null)
      }
    } catch {
      setSavedAddresses([])
      setSelectedAddrId(null)
    }
  }

  const queueClaim = (deliveryData?: Record<string, string | undefined>) => {
    if (!coupon) return
    const entryCode = searchParams.get('entry_code') || ''
    const utmSource = searchParams.get('utm_source') || ''
    const source = {
      ...(entryCode && { source_landing_id: entryCode }),
      ...(utmSource && { source_channel_id: utmSource }),
      ...(deliveryData || {}),
    }
    setDeliveryOpen(false)
    guard(
      {
        label: name,
        returnPath: `/coupon/${id}`,
        successPath: `/coupon/${id}`,
        failPath: `/coupon/${id}`,
        back: `/coupon/${id}`,
        intentAction: 'claim_coupon',
        resourceId: id,
        source,
      }
    )
  }

  const doPhysicalClaim = async () => {
    try {
      const vals = await deliveryForm.validateFields()
      const deliveryData =
        deliveryMode === 'pickup'
          ? {
              delivery_type: 'pickup',
              pickup_name: vals.pickup_name,
              pickup_phone: vals.pickup_phone,
            }
          : {
              delivery_type: 'courier',
              delivery_name: vals.delivery_name,
              delivery_phone: vals.delivery_phone,
              delivery_address: vals.delivery_address,
            }
      queueClaim(deliveryData)
    } catch {
      // form validation failed
    }
  }

  const name = pickML(detailData?.name || detailData?.product_name, language) || ''

  const handleClaim = () => {
    if (coupon?.item_type === 'physical') {
      setDeliveryMode('courier')
      deliveryForm.resetFields()
      setSavedAddresses([])
      setSelectedAddrId(null)
      void loadSavedAddresses()
      setDeliveryOpen(true)
      return
    }
    queueClaim()
  }

  const handlePrimaryAction = () => {
    if (!owned) {
      handleClaim()
      return
    }
    if (primaryAction && !primaryAction.disabled && primaryAction.route) {
      navigate(primaryAction.route)
    }
  }

  const statusMeta = (() => {
    if (!owned) {
      return {
        color: 'green',
        text: language === 'th' ? 'พร้อมรับสิทธิ์' : language === 'en' ? 'Claimable' : '可领取',
      }
    }
    if (ownedStatus === 'used') {
      return {
        color: 'default',
        text: language === 'th' ? 'ใช้แล้ว' : language === 'en' ? 'Used' : '已使用',
      }
    }
    if (ownedStatus === 'expired') {
      return {
        color: 'red',
        text: language === 'th' ? 'หมดอายุ' : language === 'en' ? 'Expired' : '已过期',
      }
    }
    return {
      color: 'green',
      text: language === 'th' ? 'พร้อมใช้งาน' : language === 'en' ? 'Available' : '可使用',
    }
  })()

  const L = {
    back: { zh: '返回福利中心', th: 'กลับศูนย์สิทธิพิเศษ', en: 'Back to Benefits' }[language]!,
    backToMine: { zh: '返回我的权益', th: 'กลับสิทธิพิเศษของฉัน', en: 'Back to My Benefits' }[language]!,
    claimBtn: { zh: '立即领取', th: 'รับสิทธิ์ทันที', en: 'Claim Now' }[language]!,
    shareBtn: { zh: '分享给好友', th: 'แชร์ให้เพื่อน', en: 'Share' }[language]!,
    mineBtn: { zh: '查看我的权益', th: 'ดูสิทธิพิเศษของฉัน', en: 'My Benefits' }[language]!,
    validity: { zh: '使用有效期', th: 'ระยะเวลาใช้งาน', en: 'Validity' }[language]!,
    minSpend: { zh: '使用条件', th: 'เงื่อนไขการใช้', en: 'Min. Spend' }[language]!,
    benefit: { zh: 'CityOne 专属权益', th: 'สิทธิพิเศษ CityOne', en: 'CityOne Exclusive Benefit' }[language]!,
    checkingLabel: { zh: '验证中...', th: 'กำลังตรวจสอบ...', en: 'Checking...' }[language]!,
    successTitle: { zh: '领取成功！', th: 'รับสำเร็จ!', en: 'Claimed!' }[language]!,
    alreadyTitle: { zh: '您已领取过此券', th: 'คุณรับคูปองนี้แล้ว', en: 'Already Claimed' }[language]!,
    successDesc: {
      zh: '卡券已存入您的账户，可在「我的 → 权益」中查看使用。',
      th: 'คูปองถูกเพิ่มในบัญชีของคุณแล้ว ดูได้ที่ "ของฉัน → สิทธิพิเศษ"',
      en: 'Coupon added to your account. Find it under "Mine → Benefits".',
    }[language]!,
    alreadyDesc: {
      zh: '您之前已领取过该卡券，请前往「我的 → 权益」查看。',
      th: 'คุณเคยรับคูปองนี้แล้ว ดูได้ที่ "ของฉัน → สิทธิพิเศษ"',
      en: 'You have already claimed this coupon. Check "Mine → Benefits".',
    }[language]!,
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (notFound || !detailData) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 48 }}>🎫</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {language === 'th' ? 'ไม่พบคูปอง' : language === 'en' ? 'Coupon Not Found' : '未找到该卡券'}
        </div>
        <Button onClick={() => navigate(owned ? '/mine?tab=benefit' : '/welfare')}>
          {owned ? L.backToMine : L.back}
        </Button>
      </div>
    )
  }

  const discountText = formatDiscount(detailData, language)
  const validFromText = formatDate(detailData.valid_from || detailData.issued_at || '', language)
  const validToText = formatDate(detailData.valid_to || detailData.expire_at || '', language)
  const validityLabel =
    detailData.valid_to || detailData.expire_at
      ? `${validFromText} ~ ${validToText}`
      : validFromText
  if (step === 'success') {
    const successTitle = alreadyClaimed ? L.alreadyTitle : L.successTitle
    const successDesc = alreadyClaimed ? L.alreadyDesc : L.successDesc

    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #1677ff 0%, #69b1ff 100%)', padding: '24px 16px' }}>
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <Card style={{ borderRadius: 20, overflow: 'hidden', textAlign: 'center', padding: '24px 16px' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: alreadyClaimed ? '#aaa' : '#52c41a', marginBottom: 16 }} />
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              {successTitle}
            </div>
            <div style={{ fontSize: 14, color: '#555', lineHeight: 1.8, marginBottom: 20 }}>
              {successDesc}
            </div>

            {!alreadyClaimed && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #f6ffed 0%, #e8f5e9 100%)',
                  border: '1px solid #b7eb8f',
                  borderRadius: 14,
                  padding: '14px 16px',
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 4 }}>{name}</div>
                <div style={{ fontSize: 20, color: '#fa8c16', fontWeight: 800 }}>{discountText}</div>
              </div>
            )}

            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" size="large" block onClick={() => navigate('/mine?tab=benefit')}>
                {L.mineBtn}
              </Button>
              <Button size="large" block onClick={() => navigate('/welfare')}>
                {L.back}
              </Button>
            </Space>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#f5f5f5',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          height: 52,
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <button
          onClick={() => navigate(owned ? '/mine?tab=benefit' : '/welfare')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            marginRight: 8,
            display: 'flex',
            alignItems: 'center',
            color: '#333',
          }}
        >
          <ArrowLeftOutlined style={{ fontSize: 20 }} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 16, flex: 1 }}>
          {language === 'th' ? 'รายละเอียดคูปอง' : language === 'en' ? 'Coupon Detail' : '卡券详情'}
        </span>
        <button
          onClick={() => setShareVisible(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            color: '#1677ff',
          }}
        >
          <ShareAltOutlined style={{ fontSize: 20 }} />
        </button>
      </div>

      <SharePromoModal
        open={shareVisible}
        onClose={() => setShareVisible(false)}
        type="coupon"
        id={detailData.id}
        name={name}
      />

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EnvironmentOutlined style={{ color: '#fa8c16' }} />
            <span>{language === 'zh' ? '填写配送信息' : language === 'th' ? 'ข้อมูลการจัดส่ง' : 'Delivery Info'}</span>
          </div>
        }
        open={deliveryOpen}
        onCancel={() => !checking && setDeliveryOpen(false)}
        onOk={doPhysicalClaim}
        okText={language === 'zh' ? '确认领取' : language === 'th' ? 'ยืนยันรับ' : 'Confirm'}
        cancelText={language === 'zh' ? '取消' : language === 'th' ? 'ยกเลิก' : 'Cancel'}
        confirmLoading={checking}
        destroyOnHidden
      >
        <div style={{ paddingTop: 8 }}>
          {deliveryMode !== 'pickup' && savedAddresses.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 8 }}>
                {language === 'zh' ? '选择已保存的地址' : language === 'th' ? 'เลือกที่อยู่ที่บันทึกไว้' : 'Select a saved address'}
              </div>
              <div style={{ display: 'grid', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                {savedAddresses.map((addr: any) => (
                  <div
                    key={addr.id}
                    onClick={() => {
                      setSelectedAddrId(addr.id)
                      deliveryForm.setFieldsValue({
                        delivery_name: addr.contact_name,
                        delivery_phone: addr.contact_phone,
                        delivery_address: addr.address,
                      })
                    }}
                    style={{
                      border: selectedAddrId === addr.id ? '2px solid #fa8c16' : '1.5px solid #e8e8e8',
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      background: selectedAddrId === addr.id ? '#fff7e6' : '#fafafa',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{addr.contact_name}</span>
                      <span style={{ fontSize: 12, color: '#888' }}>{addr.contact_phone}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>{addr.address}</div>
                    {addr.is_default && (
                      <span style={{ fontSize: 11, color: '#fa8c16', fontWeight: 600 }}>
                        {language === 'zh' ? '默认' : language === 'th' ? 'ค่าเริ่มต้น' : 'Default'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <Divider style={{ margin: '12px 0 8px' }}>
                <span style={{ fontSize: 12, color: '#bbb' }}>
                  {language === 'zh' ? '或手动填写' : language === 'th' ? 'หรือกรอกเอง' : 'or enter manually'}
                </span>
              </Divider>
            </div>
          )}

          <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14 }}>
            {language === 'zh' ? '选择配送方式' : language === 'th' ? 'เลือกวิธีจัดส่ง' : 'Delivery Method'}
          </div>
          <Radio.Group
            value={deliveryMode}
            onChange={(e) => {
              setDeliveryMode(e.target.value)
              deliveryForm.resetFields()
              setSelectedAddrId(null)
            }}
            style={{ width: '100%', marginBottom: 16 }}
          >
            <Radio.Button value="courier" style={{ width: '50%', textAlign: 'center' }}>
              <CarOutlined /> {language === 'zh' ? '快递' : language === 'th' ? 'พัสดุ' : 'Courier'}
            </Radio.Button>
            <Radio.Button value="pickup" style={{ width: '50%', textAlign: 'center' }}>
              <ShopOutlined /> {language === 'zh' ? '自取' : language === 'th' ? 'รับเอง' : 'Pickup'}
            </Radio.Button>
          </Radio.Group>

          <Form form={deliveryForm} layout="vertical" size="middle">
            {deliveryMode === 'courier' ? (
              <>
                <Form.Item
                  name="delivery_name"
                  label={language === 'zh' ? '收货人姓名' : language === 'th' ? 'ชื่อผู้รับ' : 'Recipient Name'}
                  rules={[{ required: true, message: language === 'zh' ? '请填写收货人姓名' : 'Required' }]}
                >
                  <Input placeholder={language === 'zh' ? '请输入姓名' : language === 'th' ? 'กรอกชื่อ' : 'Full name'} />
                </Form.Item>
                <Form.Item
                  name="delivery_phone"
                  label={language === 'zh' ? '手机号码' : language === 'th' ? 'เบอร์โทรศัพท์' : 'Phone'}
                  rules={[{ required: true, message: language === 'zh' ? '请填写手机号' : 'Required' }]}
                >
                  <Input placeholder={language === 'zh' ? '请输入手机号' : language === 'th' ? 'กรอกเบอร์โทร' : 'Phone'} />
                </Form.Item>
                <Form.Item
                  name="delivery_address"
                  label={language === 'zh' ? '收货地址' : language === 'th' ? 'ที่อยู่จัดส่ง' : 'Address'}
                  rules={[{ required: true, message: language === 'zh' ? '请填写收货地址' : 'Required' }]}
                >
                  <Input.TextArea rows={3} placeholder={language === 'zh' ? '请填写详细地址' : language === 'th' ? 'กรอกที่อยู่แบบละเอียด' : 'Full address'} />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item
                  name="pickup_name"
                  label={language === 'zh' ? '取货人姓名' : language === 'th' ? 'ชื่อผู้รับ' : 'Pickup Name'}
                  rules={[{ required: true, message: language === 'zh' ? '请填写取货人姓名' : 'Required' }]}
                >
                  <Input placeholder={language === 'zh' ? '请输入姓名' : language === 'th' ? 'กรอกชื่อ' : 'Full name'} />
                </Form.Item>
                <Form.Item
                  name="pickup_phone"
                  label={language === 'zh' ? '联系手机' : language === 'th' ? 'เบอร์โทร' : 'Phone'}
                  rules={[{ required: true, message: language === 'zh' ? '请填写手机号' : 'Required' }]}
                >
                  <Input placeholder={language === 'zh' ? '请输入手机号' : language === 'th' ? 'กรอกเบอร์โทร' : 'Phone'} />
                </Form.Item>
                <div style={{ fontSize: 13, color: '#888', background: '#f5f5f5', borderRadius: 8, padding: '10px 14px' }}>
                  <ShopOutlined style={{ marginRight: 6, color: '#1677ff' }} />
                  {language === 'zh'
                    ? '工作人员会联系您确认取货站点及时间，请保持手机畅通。'
                    : language === 'th'
                    ? 'เจ้าหน้าที่จะติดต่อยืนยันจุดรับสินค้า'
                    : 'Our team will contact you to confirm the pickup station.'}
                </div>
              </>
            )}
          </Form>
        </div>
      </Modal>

      <div style={{ flexShrink: 0, width: '100%', aspectRatio: '16/9', background: '#f0f0f0', overflow: 'hidden', position: 'relative' } as React.CSSProperties}>
        {videoReady && (
          <video
            ref={heroVideoRef}
            src={resolvedCoverVideoUrl}
            loop
            playsInline
            preload="metadata"
            poster={resolvedCoverImageUrl || undefined}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              visibility: videoStarted ? 'visible' : 'hidden',
            } as React.CSSProperties}
            onClick={toggleVideoPlay}
            onPlay={() => setVideoPaused(false)}
            onPause={() => setVideoPaused(videoStarted)}
          />
        )}
        {videoStarted && videoPaused && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, color: '#fff', lineHeight: 1, marginLeft: 2 }}>▶</span>
            </div>
          </div>
        )}
        {!videoStarted && (
          coverUrl ? (
            <div style={{ position: 'absolute', inset: 0, cursor: videoReady ? 'pointer' : 'default' }} onClick={videoReady ? handleStartVideo : undefined}>
              <OssImage src={coverUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {videoReady && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.12)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 16, color: '#fff', lineHeight: 1, marginLeft: 3 }}>▶</span>
                  </div>
                </div>
              )}
            </div>
          ) : videoReady ? (
            <div style={{ position: 'absolute', inset: 0, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={handleStartVideo}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, color: '#fff', lineHeight: 1, marginLeft: 3 }}>▶</span>
              </div>
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1677ff20, #fa8c1640)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 56 }}>🎫</span>
            </div>
          )
        )}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        } as React.CSSProperties}
      >
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#1677ff', fontWeight: 700, marginBottom: 6 }}>{L.benefit}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{name}</div>
            <div style={{ fontSize: 26, color: '#fa8c16', fontWeight: 800, marginBottom: 12 }}>{discountText}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {detailData.coupon_type && <Tag color="blue">{detailData.coupon_type}</Tag>}
              <Tag color={statusMeta.color}>{statusMeta.text}</Tag>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#888', marginBottom: 6 }}>{L.validity}</div>
            <div style={{ fontSize: 14, color: '#333' }}>{validityLabel}</div>
          </div>

          {Number(detailData.min_amount || 0) > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#888', marginBottom: 6 }}>{L.minSpend}</div>
              <div style={{ fontSize: 14, color: '#333' }}>
                {language === 'th'
                  ? `ยอดขั้นต่ำ ฿${detailData.min_amount}`
                  : language === 'en'
                  ? `Min. spend ฿${detailData.min_amount}`
                  : `最低消费 ฿${detailData.min_amount}`}
              </div>
            </div>
          )}

          {Number(detailData.total_count || 0) > 0 && (
            <div style={{ background: '#fff7e6', borderRadius: 12, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📦</span>
              <span style={{ fontSize: 13, color: '#ad6800' }}>
                {language === 'th'
                  ? `เหลือ ${Number(detailData.total_count || 0) - Number(detailData.claimed_count || 0)} สิทธิ์`
                  : language === 'en'
                  ? `${Number(detailData.total_count || 0) - Number(detailData.claimed_count || 0)} left`
                  : `剩余 ${Number(detailData.total_count || 0) - Number(detailData.claimed_count || 0)} 份`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 4,
          flexShrink: 0,
          padding: '12px 16px calc(24px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(255,255,255,0.96)',
          borderTop: '1px solid #f0f0f0',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <button
            onClick={handlePrimaryAction}
            disabled={owned ? !!primaryAction?.disabled : checking}
            style={{
              width: '100%',
              padding: '14px 0',
              background: owned
                ? primaryAction?.disabled
                  ? '#ccc'
                  : primaryAction?.type === 'product_exchange'
                  ? 'linear-gradient(135deg, #FF7A59, #FFB36B)'
                  : primaryAction?.type === 'charge_scan'
                  ? 'linear-gradient(135deg, #2CDBCE, #2F80FF)'
                  : 'linear-gradient(135deg, #1677ff, #4096ff)'
                : checking
                ? '#ccc'
                : 'linear-gradient(135deg, #1677ff, #4096ff)',
              border: 'none',
              borderRadius: 50,
              color: '#fff',
              fontSize: 17,
              fontWeight: 700,
              cursor: (owned ? primaryAction?.disabled : checking) ? 'not-allowed' : 'pointer',
              boxShadow: (owned ? primaryAction?.disabled : checking)
                ? 'none'
                : '0 4px 16px rgba(22,119,255,0.35)',
              letterSpacing: 0.5,
              transition: 'background 0.2s',
            }}
          >
            {owned
              ? primaryAction?.label
              : checking
              ? L.checkingLabel
              : L.claimBtn}
          </button>
          <Button block onClick={() => setShareVisible(true)} icon={<ShareAltOutlined />} style={{ borderRadius: 50 }}>
            {L.shareBtn}
          </Button>
        </Space>
      </div>
    </div>
  )
}
