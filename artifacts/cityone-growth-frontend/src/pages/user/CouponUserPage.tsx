import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Tag, Space, Spin, message } from 'antd'
import { ShareAltOutlined, ArrowLeftOutlined, CheckCircleOutlined, UserAddOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'
import SharePromoModal from '../../components/SharePromoModal'
import request from '../../api/request'
import { getDeviceUserId } from '../../utils/deviceUserId'

type Step = 'detail' | 'follow' | 'success'

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
  const { language, t } = useI18n()
  const [shareVisible, setShareVisible] = useState(false)
  const [coupon, setCoupon] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [step, setStep] = useState<Step>('detail')
  const [alreadyClaimed, setAlreadyClaimed] = useState(false)

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

  const doClaim = async () => {
    if (!coupon || claiming) return
    setClaiming(true)
    try {
      const res: any = await (request.post('/user/coupons/claim', {
        user_id: getDeviceUserId(),
        coupon_id: coupon.id,
      }) as any)
      const data = res?.data || {}
      setAlreadyClaimed(!!data.already_claimed)
      setStep('success')
    } catch {
      message.error({ zh: '领取失败，请稍后重试', th: 'รับล้มเหลว โปรดลองอีกครั้ง', en: 'Claim failed, please try again' }[language] || 'Claim failed')
    } finally {
      setClaiming(false)
    }
  }

  // ── i18n ────────────────────────────────────────────────────────────────────
  const L = {
    back:             { zh: '返回福利中心', th: 'กลับศูนย์สิทธิพิเศษ', en: 'Back to Benefits' }[language]!,
    backDetail:       { zh: '返回券详情', th: 'กลับรายละเอียด', en: 'Back to Coupon' }[language]!,
    claimBtn:         { zh: '立即领取', th: 'รับสิทธิ์ทันที', en: 'Claim Now' }[language]!,
    shareBtn:         { zh: '分享给好友', th: 'แชร์ให้เพื่อน', en: 'Share' }[language]!,
    mineBtn:          { zh: '查看我的卡券', th: 'ดูคูปองของฉัน', en: 'My Coupons' }[language]!,
    validity:         { zh: '使用有效期', th: 'ระยะเวลาใช้งาน', en: 'Validity' }[language]!,
    minSpend:         { zh: '使用条件', th: 'เงื่อนไขการใช้', en: 'Min. Spend' }[language]!,
    benefit:          { zh: 'CityOne 专属权益', th: 'สิทธิพิเศษ CityOne', en: 'CityOne Exclusive Benefit' }[language]!,
    followTitle:      { zh: '关注 LINE OA 即可领取', th: 'ติดตาม LINE OA เพื่อรับคูปอง', en: 'Follow LINE OA to Claim' }[language]!,
    followDesc:       { zh: '请先关注 CityOne LINE OA，完成关注后点击「已关注，继续领取」。', th: 'กรุณาติดตาม LINE OA ของ CityOne ก่อน แล้วกด "ติดตามแล้ว รับสิทธิ์" เพื่อรับคูปอง', en: 'Please follow CityOne LINE OA first, then tap "Already Followed" to claim this coupon.' }[language]!,
    followTag:        { zh: '需关注 LINE OA', th: 'ต้องติดตาม LINE OA', en: 'LINE OA Follow Required' }[language]!,
    alreadyFollowed:  { zh: '已关注，继续领取', th: 'ติดตามแล้ว รับสิทธิ์', en: 'Already Followed, Continue' }[language]!,
    successTitle:     { zh: '领取成功！', th: 'รับสำเร็จ!', en: 'Claimed!' }[language]!,
    alreadyTitle:     { zh: '您已领取过此券', th: 'คุณรับคูปองนี้แล้ว', en: 'Already Claimed' }[language]!,
    successDesc:      { zh: '卡券已存入您的账户，可在「我的 → 卡券」中查看使用。', th: 'คูปองถูกเพิ่มในบัญชีของคุณแล้ว ดูได้ที่ "ของฉัน → คูปอง"', en: 'Coupon added to your account. Find it under "Mine → Coupons".' }[language]!,
    alreadyDesc:      { zh: '您之前已领取过该卡券，请前往「我的 → 卡券」查看。', th: 'คุณเคยรับคูปองนี้แล้ว ดูได้ที่ "ของฉัน → คูปอง"', en: 'You have already claimed this coupon. Check "Mine → Coupons".' }[language]!,
  }

  // ── Loading / Not Found ──────────────────────────────────────────────────────
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

  // ── Step: LINE OA Follow ─────────────────────────────────────────────────────
  if (step === 'follow') {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fb', padding: '24px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => setStep('detail')}
            style={{ marginBottom: 12, paddingLeft: 0 }}
          >
            {L.backDetail}
          </Button>

          <Card style={{ borderRadius: 16 }}>
            {coverUrl && (
              <img src={coverUrl} alt={name}
                style={{ width: '100%', borderRadius: 12, marginBottom: 16, objectFit: 'cover', maxHeight: 200 }} />
            )}
            <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{name}</div>
              <div style={{ fontSize: 18, color: '#fa8c16', fontWeight: 700, marginBottom: 12 }}>{discountText}</div>
              <Tag color="orange" style={{ fontSize: 13, padding: '4px 10px' }}>{L.followTag}</Tag>
            </div>

            <div style={{
              marginTop: 18, padding: 18, borderRadius: 14,
              background: 'linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)',
              border: '1px solid #ffd591',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <UserAddOutlined style={{ fontSize: 20, color: '#fa8c16' }} />
                <span style={{ fontSize: 16, fontWeight: 700 }}>{L.followTitle}</span>
              </div>
              <div style={{ color: '#555', lineHeight: 1.8, fontSize: 14 }}>{L.followDesc}</div>
            </div>

            <Space direction="vertical" style={{ width: '100%', marginTop: 20 }}>
              <Button
                type="primary"
                size="large"
                block
                loading={claiming}
                onClick={doClaim}
              >
                {L.alreadyFollowed}
              </Button>
              <Button size="large" block onClick={() => setStep('detail')}>
                {L.backDetail}
              </Button>
            </Space>
          </Card>
        </div>
      </div>
    )
  }

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

  // ── Step: Detail（默认，浏览自由，无需任何条件）─────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: 100 }}>
      {/* 顶部导航 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
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

      {/* 封面图 */}
      {coverUrl ? (
        <img src={coverUrl} alt={name} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ height: 160, background: 'linear-gradient(135deg, #1677ff20, #fa8c1640)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 56 }}>🎫</span>
        </div>
      )}

      <div style={{ padding: '20px 16px 0' }}>
        {/* 券名 & 优惠 */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#1677ff', fontWeight: 700, marginBottom: 6 }}>{L.benefit}</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{name}</div>
          <div style={{ fontSize: 26, color: '#fa8c16', fontWeight: 800, marginBottom: 12 }}>{discountText}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {coupon.coupon_type && (
              <Tag color="blue">{coupon.coupon_type}</Tag>
            )}
            <Tag color="green">
              { language === 'th' ? 'พร้อมใช้งาน' : language === 'en' ? 'Available' : '可领取' }
            </Tag>
          </div>
        </div>

        {/* 有效期 */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#888', marginBottom: 6 }}>{L.validity}</div>
          <div style={{ fontSize: 14, color: '#333' }}>{validityLabel}</div>
        </div>

        {/* 使用条件 */}
        {coupon.min_amount > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#888', marginBottom: 6 }}>{L.minSpend}</div>
            <div style={{ fontSize: 14, color: '#333' }}>
              { language === 'th' ? `ยอดขั้นต่ำ ฿${coupon.min_amount}` : language === 'en' ? `Min. spend ฿${coupon.min_amount}` : `最低消费 ฿${coupon.min_amount}` }
            </div>
          </div>
        )}

        {/* 库存提示 */}
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

      {/* 底部固定按钮 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px 24px',
        background: '#fff', borderTop: '1px solid #f0f0f0', zIndex: 20,
      }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <button
            onClick={() => setStep('follow')}
            style={{
              width: '100%', padding: '14px 0',
              background: 'linear-gradient(135deg, #1677ff, #4096ff)',
              border: 'none', borderRadius: 50,
              color: '#fff', fontSize: 17, fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(22,119,255,0.35)',
              letterSpacing: 0.5,
            }}
          >
            {L.claimBtn}
          </button>
          <Button block onClick={() => setShareVisible(true)} icon={<ShareAltOutlined />} style={{ borderRadius: 50 }}>
            {L.shareBtn}
          </Button>
        </Space>
      </div>
    </div>
  )
}
