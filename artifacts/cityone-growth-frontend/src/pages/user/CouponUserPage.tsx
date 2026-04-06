import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, Tag, Space, Spin } from 'antd'
import { ShareAltOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useI18n } from '../../i18n'
import SharePromoModal from '../../components/SharePromoModal'
import request from '../../api/request'

// 多语字段 pick（降级：当前语言 → en → zh → th）
function pickML(field: any, lang: string): string {
  if (!field) return ''
  if (typeof field === 'string') return field
  if (typeof field === 'object' && !Array.isArray(field))
    return field[lang] || field.en || field.zh || field.th || ''
  return ''
}

// ── 折扣描述格式化 ──────────────────────────────────────────────────────────

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
  // fixed
  if (language === 'th') return `ลด ฿${val}`
  if (language === 'en') return `฿${val} OFF`
  return `减免 ฿${val}`
}

function formatDate(iso: string, language: string) {
  const d = dayjs(iso)
  if (language === 'th') return d.format('D MMM BBBB HH:mm')
  return d.format('YYYY-MM-DD HH:mm')
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

export default function CouponUserPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { language, t } = useI18n()
  const [shareVisible, setShareVisible] = useState(false)
  const [coupon, setCoupon] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

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

  const followed = searchParams.get('followed') === '1'

  const handleFollowDone = () => {
    const next = new URLSearchParams(searchParams)
    next.set('followed', '1')
    setSearchParams(next)
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
          {language === 'th' ? 'ไม่พบคูปอง' : language === 'en' ? 'Coupon Not Found' : '未找到该卡券'}
        </div>
        <Button onClick={() => navigate('/welfare')}>
          {language === 'th' ? 'กลับหน้าแรก' : language === 'en' ? 'Back' : '返回福利中心'}
        </Button>
      </div>
    )
  }

  const discountText = formatDiscount(coupon, language)
  const name = pickML(coupon.name, language) || ''

  const validFromText = coupon.valid_from ? formatDate(coupon.valid_from, language) : '—'
  const validToText = coupon.valid_to ? formatDate(coupon.valid_to, language) : '—'
  const validityLabel = {
    zh: `${validFromText} ~ ${validToText}`,
    th: `${validFromText} ถึง ${validToText}`,
    en: `${validFromText} ~ ${validToText}`,
  }[language]

  const claimLabel = { zh: '立即领取', th: 'รับสิทธิ์ทันที', en: 'Claim Now' }[language]
  const shareLabel = { zh: '分享给好友', th: 'แชร์ให้เพื่อน', en: 'Share' }[language]
  const mineLabel = { zh: '查看我的卡券', th: 'ดูคูปองของฉัน', en: 'My Coupons' }[language]
  const backLabel = { zh: '返回福利中心', th: 'กลับศูนย์สิทธิพิเศษ', en: 'Back to Benefits' }[language]
  const followTitle = { zh: '关注 LINE OA 领取', th: 'ติดตาม LINE OA เพื่อรับ', en: 'Follow LINE OA to Claim' }[language]
  const followDesc = {
    zh: '请先关注 CityOne LINE OA，完成关注后点击"已关注，继续"领取本券。',
    th: 'กรุณาติดตาม LINE OA ของ CityOne ก่อน แล้วกด "ติดตามแล้ว ดำเนินการต่อ" เพื่อรับคูปอง',
    en: 'Please follow CityOne LINE OA first, then tap "Already Followed" to claim this coupon.',
  }[language]
  const alreadyFollowedLabel = {
    zh: '已关注，继续领取',
    th: 'ติดตามแล้ว ดำเนินการต่อ',
    en: 'Already Followed, Continue',
  }[language]

  const coverUrl = coupon.cover_image
    ? coupon.cover_image.startsWith('http')
      ? coupon.cover_image
      : coupon.cover_image
    : null

  // 未关注流程
  if (!followed) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fb', padding: '24px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/welfare')}
            style={{ marginBottom: 12, paddingLeft: 0 }}
          >
            {backLabel}
          </Button>
          <Card style={{ borderRadius: 16 }}>
            {coverUrl && (
              <img
                src={coverUrl}
                alt={name}
                style={{ width: '100%', borderRadius: 12, marginBottom: 16, objectFit: 'cover', maxHeight: 200 }}
              />
            )}
            <div style={{ textAlign: 'center', padding: '12px 0 4px 0' }}>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>{name}</div>
              <div style={{ fontSize: 20, color: '#fa8c16', fontWeight: 700, marginBottom: 12 }}>{discountText}</div>
              <Tag color="orange" style={{ fontSize: 13, padding: '4px 10px' }}>
                {t('detail.followRequiredTag')}
              </Tag>
            </div>

            <div
              style={{
                marginTop: 18, padding: 18, borderRadius: 14,
                background: 'linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)',
                border: '1px solid #ffd591',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{followTitle}</div>
              <div style={{ color: '#555', lineHeight: 1.8 }}>{followDesc}</div>
            </div>

            <Space direction="vertical" style={{ width: '100%', marginTop: 20 }}>
              <Button type="primary" size="large" block onClick={handleFollowDone}>
                {alreadyFollowedLabel}
              </Button>
              <Button size="large" block onClick={() => navigate('/welfare')}>
                {backLabel}
              </Button>
            </Space>
          </Card>
        </div>
      </div>
    )
  }

  // 已关注 → 卡券详情
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #1677ff 0%, #69b1ff 100%)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/welfare')}
          style={{ marginBottom: 12, paddingLeft: 0, color: '#fff' }}
        >
          {backLabel}
        </Button>

        <Card style={{ borderRadius: 20, overflow: 'hidden' }}>
          {coverUrl && (
            <img
              src={coverUrl}
              alt={name}
              style={{ width: '100%', borderRadius: 12, marginBottom: 16, objectFit: 'cover', maxHeight: 220 }}
            />
          )}
          <div style={{ textAlign: 'center', padding: '8px 0 20px 0' }}>
            <div style={{ fontSize: 14, color: '#1677ff', fontWeight: 700, marginBottom: 8 }}>
              {t('detail.cityoneBenefit')}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>{name}</div>
            <div style={{ fontSize: 22, color: '#fa8c16', fontWeight: 700 }}>{discountText}</div>
          </div>

          <Card size="small" style={{ marginBottom: 14, borderRadius: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('detail.validity')}</div>
            <div style={{ color: '#555', fontSize: 13 }}>{validityLabel}</div>
          </Card>

          {coupon.min_amount > 0 && (
            <Card size="small" style={{ marginBottom: 14, borderRadius: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('detail.rules')}</div>
              <div style={{ color: '#555', lineHeight: 1.8, fontSize: 13 }}>
                {language === 'th'
                  ? `ยอดขั้นต่ำ ฿${coupon.min_amount}`
                  : language === 'en'
                    ? `Min. spend ฿${coupon.min_amount}`
                    : `最低消费 ฿${coupon.min_amount}`}
              </div>
            </Card>
          )}

          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" size="large" block onClick={() => navigate('/mine?tab=benefits')}>
              {claimLabel}
            </Button>
            <Button
              size="large"
              block
              icon={<ShareAltOutlined />}
              onClick={() => setShareVisible(true)}
              style={{ borderColor: '#1677ff', color: '#1677ff' }}
            >
              {shareLabel}
            </Button>
            <Button size="large" block onClick={() => navigate('/mine?tab=benefits')}>
              {mineLabel}
            </Button>
            <Button size="large" block onClick={() => navigate('/welfare')}>
              {backLabel}
            </Button>
          </Space>
        </Card>
      </div>

      <SharePromoModal
        open={shareVisible}
        onClose={() => setShareVisible(false)}
        type="coupon"
        id={coupon.id}
        name={name}
      />
    </div>
  )
}
