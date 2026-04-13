import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, Tag, Space, Spin, message, Modal, Form, Input, Radio, Divider } from 'antd'
import { ShareAltOutlined, ArrowLeftOutlined, CheckCircleOutlined, EnvironmentOutlined, CarOutlined, ShopOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'
import OssImage from '../../components/OssImage'
import SharePromoModal from '../../components/SharePromoModal'
import request from '../../api/request'
import { useFollowGate } from '../../hooks/useFollowGate'
import { useEffectiveUserId } from '../../hooks/useEffectiveUserId'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

type Step = 'detail' | 'success'

function pickML(field: any, lang: string): string {
  if (!field) return ''
  if (typeof field === 'string') return field
  if (typeof field === 'object' && !Array.isArray(field))
    return field[lang] || field.en || field.zh || field.th || ''
  return ''
}

function formatDiscount(c: any, language: string): string {
  const val = Number(c.discount_value || 0)
  if (c.discount_type === 'free_time') {
    if (language === 'th') return `เวลาฟรี ${val} นาที`
    if (language === 'en') return `FREE ${val} min`
    return `免费时长 ${val} 分钟`
  }
  if (c.discount_type === 'free_order') {
    if (language === 'th') return 'ฟรีออเดอร์'
    if (language === 'en') return 'FREE Order'
    return '免单券'
  }
  if (c.discount_type === 'percent') {
    const off = 100 - val
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

export default function CouponUserPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { language, t } = useI18n()
  const [shareVisible, setShareVisible] = useState(false)
  const [coupon, setCoupon] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [step, setStep] = useState<Step>('detail')
  const [alreadyClaimed, setAlreadyClaimed] = useState(false)
  const [videoStarted, setVideoStarted] = useState(false)
  const [videoPaused, setVideoPaused] = useState(false)
  const heroVideoRef = useRef<HTMLVideoElement>(null)

  const toggleVideoPlay = () => {
    const el = heroVideoRef.current
    if (!el) return
    if (el.paused) { el.play(); setVideoPaused(false) }
    else { el.pause(); setVideoPaused(true) }
  }
  const { guard, checking } = useFollowGate()
  const effectiveUserId = useEffectiveUserId()

  // 实物卡券配送弹窗
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [deliveryMode, setDeliveryMode] = useState<'courier' | 'pickup'>('courier')
  const [deliveryForm] = Form.useForm()
  const [savedAddresses, setSavedAddresses] = useState<any[]>([])
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    ;(request.get('/user/coupons') as any)
      .then((res: any) => {
        const list: any[] = res.data || []
        const found = list.find((c: any) => c.id === id)
        if (found) {
          setCoupon(found)
        } else {
          setNotFound(true)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  // 来自 FollowOAPage 回跳：auto=claim → 自动领取
  useEffect(() => {
    if (searchParams.get('auto') === 'claim' && coupon && !claiming) {
      doClaim()
    }
  }, [coupon, searchParams.get('auto')])

  // 加载已保存收货地址
  const loadSavedAddresses = async () => {
    try {
      const userId = effectiveUserId
      const res: any = await (request.get as any)(`/growth/user/addresses?user_id=${encodeURIComponent(userId)}`)
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

  const doClaim = async (deliveryData?: Record<string, string>) => {
    if (!coupon || claiming) return
    setClaiming(true)
    try {
      const entryCode = searchParams.get('entry_code') || ''
      const utmSource = searchParams.get('utm_source') || ''
      const res: any = await (request.post('/user/coupons/claim', {
        user_id: effectiveUserId,
        coupon_id: coupon.id,
        ...(entryCode && { source_landing_id: entryCode }),
        ...(utmSource && { source_channel_id: utmSource }),
        ...(deliveryData || {}),
      }) as any)
      const data = res?.data || {}
      setAlreadyClaimed(!!data.already_claimed)
      setDeliveryOpen(false)
      setStep('success')
    } catch {
      message.error({ zh: '领取失败，请稍后重试', th: 'รับล้มเหลว โปรดลองอีกครั้ง', en: 'Claim failed, please try again' }[language] || 'Claim failed')
    } finally {
      setClaiming(false)
    }
  }

  // 实物卡券：配送弹窗确认后提交
  const doPhysicalClaim = async () => {
    try {
      const vals = await deliveryForm.validateFields()
      const deliveryData = deliveryMode === 'pickup'
        ? { delivery_type: 'pickup', pickup_name: vals.pickup_name, pickup_phone: vals.pickup_phone }
        : { delivery_type: 'courier', delivery_name: vals.delivery_name, delivery_phone: vals.delivery_phone, delivery_address: vals.delivery_address }
      await doClaim(deliveryData as unknown as Record<string, string>)
    } catch {
      // form validation failed
    }
  }

  // 核心：通过 useFollowGate hook 统一关注检查
  const handleClaim = () => {
    guard(
      async () => {
        if (coupon?.item_type === 'physical') {
          setDeliveryMode('courier')
          deliveryForm.resetFields()
          setSavedAddresses([])
          setSelectedAddrId(null)
          await loadSavedAddresses()
          setDeliveryOpen(true)
          return
        }
        await doClaim()
      },
      {
        label: name,
        returnPath: `/coupon/${id}?auto=claim`,
        back: `/coupon/${id}`,
      }
    )
  }

  // ── i18n ────────────────────────────────────────────────────────────────────
  const L = {
    back:             { zh: '返回福利中心', th: 'กลับศูนย์สิทธิพิเศษ', en: 'Back to Benefits' }[language]!,
    claimBtn:         { zh: '立即领取', th: 'รับสิทธิ์ทันที', en: 'Claim Now' }[language]!,
    shareBtn:         { zh: '分享给好友', th: 'แชร์ให้เพื่อน', en: 'Share' }[language]!,
    mineBtn:          { zh: '查看我的卡券', th: 'ดูคูปองของฉัน', en: 'My Coupons' }[language]!,
    validity:         { zh: '使用有效期', th: 'ระยะเวลาใช้งาน', en: 'Validity' }[language]!,
    minSpend:         { zh: '使用条件', th: 'เงื่อนไขการใช้', en: 'Min. Spend' }[language]!,
    benefit:          { zh: 'CityOne 专属权益', th: 'สิทธิพิเศษ CityOne', en: 'CityOne Exclusive Benefit' }[language]!,
    checkingLabel:    { zh: '验证中...', th: 'กำลังตรวจสอบ...', en: 'Checking...' }[language]!,
    successTitle:     { zh: '领取成功！', th: 'รับสำเร็จ!', en: 'Claimed!' }[language]!,
    alreadyTitle:     { zh: '您已领取过此券', th: 'คุณรับคูปองนี้แล้ว', en: 'Already Claimed' }[language]!,
    successDesc:      { zh: '卡券已存入您的账户，可在「我的 → 卡券」中查看使用。', th: 'คูปองถูกเพิ่มในบัญชีของคุณแล้ว ดูได้ที่ "ของฉัน → คูปอง"', en: 'Coupon added to your account. Find it under "Mine → Coupons".' }[language]!,
    alreadyDesc:      { zh: '您之前已领取过该卡券，请前往「我的 → 卡券」查看。', th: 'คุณเคยรับคูปองนี้แล้ว ดูได้ที่ "ของฉัน → คูปอง"', en: 'You have already claimed this coupon. Check "Mine → Coupons".' }[language]!,
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (notFound || !coupon) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🎫</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          { language === 'th' ? 'ไม่พบคูปอง' : language === 'en' ? 'Coupon Not Found' : '未找到该卡券' }
        </div>
        <Button onClick={() => navigate('/welfare')}>{L.back}</Button>
      </div>
    )
  }

  const name          = pickML(coupon.name, language) || ''
  const discountText  = formatDiscount(coupon, language)
  const validFromText = formatDate(coupon.valid_from, language)
  const validToText   = formatDate(coupon.valid_to, language)
  const validityLabel = `${validFromText} ~ ${validToText}`
  const coverUrl      = coupon.cover_image || null
  const coverVideoUrl = coupon.cover_video || null

  // ── Step: Success ────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #1677ff 0%, #69b1ff 100%)', padding: '24px 16px' }}>
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <Card style={{ borderRadius: 20, overflow: 'hidden', textAlign: 'center', padding: '24px 16px' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: alreadyClaimed ? '#aaa' : '#52c41a', marginBottom: 16 }} />
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              {alreadyClaimed ? L.alreadyTitle : L.successTitle}
            </div>
            <div style={{ fontSize: 14, color: '#555', lineHeight: 1.8, marginBottom: 20 }}>
              {alreadyClaimed ? L.alreadyDesc : L.successDesc}
            </div>

            {!alreadyClaimed && (
              <div style={{
                background: 'linear-gradient(135deg, #f6ffed 0%, #e8f5e9 100%)',
                border: '1px solid #b7eb8f',
                borderRadius: 14,
                padding: '14px 16px',
                marginBottom: 20,
              }}>
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

  // ── Step: Detail（默认，浏览自由）─────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f5f5f5' }}>
      <div style={{
        flexShrink: 0,
        background: '#fff', display: 'flex', alignItems: 'center',
        padding: '0 16px', height: 52, borderBottom: '1px solid #f0f0f0',
      }}>
        <button
          onClick={() => navigate('/welfare')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, marginRight: 8, display: 'flex', alignItems: 'center', color: '#333' }}
        >
          <ArrowLeftOutlined style={{ fontSize: 20 }} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 16, flex: 1 }}>
          { language === 'th' ? 'รายละเอียดคูปอง' : language === 'en' ? 'Coupon Detail' : '卡券详情' }
        </span>
        <button
          onClick={() => setShareVisible(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', color: '#1677ff' }}
        >
          <ShareAltOutlined style={{ fontSize: 20 }} />
        </button>
      </div>

      <SharePromoModal
        open={shareVisible}
        onClose={() => setShareVisible(false)}
        type="coupon"
        id={coupon.id}
        name={name}
      />

      {/* 实物卡券配送弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EnvironmentOutlined style={{ color: '#fa8c16' }} />
            <span>{language === 'zh' ? '填写配送信息' : language === 'th' ? 'ข้อมูลการจัดส่ง' : 'Delivery Info'}</span>
          </div>
        }
        open={deliveryOpen}
        onCancel={() => !claiming && setDeliveryOpen(false)}
        onOk={doPhysicalClaim}
        okText={language === 'zh' ? '确认领取' : language === 'th' ? 'ยืนยันรับ' : 'Confirm'}
        cancelText={language === 'zh' ? '取消' : language === 'th' ? 'ยกเลิก' : 'Cancel'}
        confirmLoading={claiming}
        destroyOnHidden
      >
        <div style={{ paddingTop: 8 }}>
          {/* 已保存地址选择区 */}
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

          {/* 配送方式选择 */}
          <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14 }}>
            {language === 'zh' ? '选择配送方式' : language === 'th' ? 'เลือกวิธีจัดส่ง' : 'Delivery Method'}
          </div>
          <Radio.Group
            value={deliveryMode}
            onChange={e => { setDeliveryMode(e.target.value); deliveryForm.resetFields(); setSelectedAddrId(null) }}
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
                <Form.Item name="delivery_name"
                  label={language === 'zh' ? '收货人姓名' : language === 'th' ? 'ชื่อผู้รับ' : 'Recipient Name'}
                  rules={[{ required: true, message: language === 'zh' ? '请填写收货人姓名' : 'Required' }]}>
                  <Input placeholder={language === 'zh' ? '请输入姓名' : language === 'th' ? 'กรอกชื่อ' : 'Full name'} />
                </Form.Item>
                <Form.Item name="delivery_phone"
                  label={language === 'zh' ? '手机号码' : language === 'th' ? 'เบอร์โทรศัพท์' : 'Phone'}
                  rules={[{ required: true, message: language === 'zh' ? '请填写手机号' : 'Required' }]}>
                  <Input placeholder={language === 'zh' ? '请输入手机号' : language === 'th' ? 'กรอกเบอร์โทร' : 'Phone'} />
                </Form.Item>
                <Form.Item name="delivery_address"
                  label={language === 'zh' ? '收货地址' : language === 'th' ? 'ที่อยู่จัดส่ง' : 'Address'}
                  rules={[{ required: true, message: language === 'zh' ? '请填写收货地址' : 'Required' }]}>
                  <Input.TextArea rows={3} placeholder={language === 'zh' ? '请填写详细地址' : language === 'th' ? 'กรอกที่อยู่แบบละเอียด' : 'Full address'} />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item name="pickup_name"
                  label={language === 'zh' ? '取货人姓名' : language === 'th' ? 'ชื่อผู้รับ' : 'Pickup Name'}
                  rules={[{ required: true, message: language === 'zh' ? '请填写取货人姓名' : 'Required' }]}>
                  <Input placeholder={language === 'zh' ? '请输入姓名' : language === 'th' ? 'กรอกชื่อ' : 'Full name'} />
                </Form.Item>
                <Form.Item name="pickup_phone"
                  label={language === 'zh' ? '联系手机' : language === 'th' ? 'เบอร์โทร' : 'Phone'}
                  rules={[{ required: true, message: language === 'zh' ? '请填写手机号' : 'Required' }]}>
                  <Input placeholder={language === 'zh' ? '请输入手机号' : language === 'th' ? 'กรอกเบอร์โทร' : 'Phone'} />
                </Form.Item>
                <div style={{ fontSize: 13, color: '#888', background: '#f5f5f5', borderRadius: 8, padding: '10px 14px' }}>
                  <ShopOutlined style={{ marginRight: 6, color: '#1677ff' }} />
                  {language === 'zh' ? '工作人员会联系您确认取货站点及时间，请保持手机畅通。' : language === 'th' ? 'เจ้าหน้าที่จะติดต่อยืนยันจุดรับสินค้า' : 'Our team will contact you to confirm the pickup station.'}
                </div>
              </>
            )}
          </Form>
        </div>
      </Modal>

      <div style={{ flexShrink: 0, background: '#f0f0f0', overflow: 'hidden' }}>
        {videoStarted && coverVideoUrl ? (
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={toggleVideoPlay}>
            <video ref={heroVideoRef} src={coverVideoUrl} autoPlay loop playsInline
              style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
            {videoPaused && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 13, color: '#fff', lineHeight: 1, marginLeft: 2 }}>▶</span>
                </div>
              </div>
            )}
          </div>
        ) : coverUrl ? (
          <div style={{ position: 'relative', cursor: coverVideoUrl ? 'pointer' : 'default' }}
               onClick={coverVideoUrl ? () => setVideoStarted(true) : undefined}>
            <OssImage src={coverUrl} alt={name} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
            {coverVideoUrl && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.12)' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 13, color: '#fff', lineHeight: 1, marginLeft: 2 }}>▶</span>
                </div>
              </div>
            )}
          </div>
        ) : coverVideoUrl ? (
          <div style={{ cursor: 'pointer', background: '#000', height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
               onClick={() => setVideoStarted(true)}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, color: '#fff', lineHeight: 1, marginLeft: 2 }}>▶</span>
            </div>
          </div>
        ) : (
          <div style={{ height: 160, background: 'linear-gradient(135deg, #1677ff20, #fa8c1640)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 56 }}>🎫</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#1677ff', fontWeight: 700, marginBottom: 6 }}>{L.benefit}</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{name}</div>
          <div style={{ fontSize: 26, color: '#fa8c16', fontWeight: 800, marginBottom: 12 }}>{discountText}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {coupon.coupon_type && <Tag color="blue">{coupon.coupon_type}</Tag>}
            <Tag color="green">
              { language === 'th' ? 'พร้อมใช้งาน' : language === 'en' ? 'Available' : '可领取' }
            </Tag>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#888', marginBottom: 6 }}>{L.validity}</div>
          <div style={{ fontSize: 14, color: '#333' }}>{validityLabel}</div>
        </div>

        {coupon.min_amount > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#888', marginBottom: 6 }}>{L.minSpend}</div>
            <div style={{ fontSize: 14, color: '#333' }}>
              { language === 'th' ? `ยอดขั้นต่ำ ฿${coupon.min_amount}` : language === 'en' ? `Min. spend ฿${coupon.min_amount}` : `最低消费 ฿${coupon.min_amount}` }
            </div>
          </div>
        )}

        {coupon.total_count > 0 && (
          <div style={{ background: '#fff7e6', borderRadius: 12, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📦</span>
            <span style={{ fontSize: 13, color: '#ad6800' }}>
              { language === 'th'
                ? `เหลือ ${coupon.total_count - (coupon.claimed_count || 0)} สิทธิ์`
                : language === 'en'
                  ? `${coupon.total_count - (coupon.claimed_count || 0)} left`
                  : `剩余 ${coupon.total_count - (coupon.claimed_count || 0)} 份` }
            </span>
          </div>
        )}
      </div>
      </div>

      <div style={{
        flexShrink: 0,
        padding: '12px 16px 24px',
        background: '#fff', borderTop: '1px solid #f0f0f0',
      }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <button
            onClick={handleClaim}
            disabled={checking || claiming}
            style={{
              width: '100%', padding: '14px 0',
              background: (checking || claiming) ? '#ccc' : 'linear-gradient(135deg, #1677ff, #4096ff)',
              border: 'none', borderRadius: 50,
              color: '#fff', fontSize: 17, fontWeight: 700,
              cursor: (checking || claiming) ? 'not-allowed' : 'pointer',
              boxShadow: (checking || claiming) ? 'none' : '0 4px 16px rgba(22,119,255,0.35)',
              letterSpacing: 0.5, transition: 'background 0.2s',
            }}
          >
            {checking ? L.checkingLabel : L.claimBtn}
          </button>
          <Button block onClick={() => setShareVisible(true)} icon={<ShareAltOutlined />} style={{ borderRadius: 50 }}>
            { language === 'th' ? 'แชร์ให้เพื่อน' : language === 'en' ? 'Share' : '分享给好友' }
          </Button>
        </Space>
      </div>
    </div>
  )
}
