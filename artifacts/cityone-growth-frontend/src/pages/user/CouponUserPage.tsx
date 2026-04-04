import React, { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, Tag, Space } from 'antd'
import { ShareAltOutlined } from '@ant-design/icons'
import { pickLocalizedText, useI18n, type AppLanguage } from '../../i18n'
import SharePromoModal from '../../components/SharePromoModal'

type LocalizedField = Partial<Record<AppLanguage, string>>

type CouponContent = {
  id: number
  title: LocalizedField
  valueText: LocalizedField
  expireText: LocalizedField
  ruleText: LocalizedField
  applyText: LocalizedField
  buttonText: LocalizedField
}

const mockCoupons: Record<string, CouponContent> = {
  '1': {
    id: 1,
    title: {
      zh: '关注 LINE 领 15 分钟券',
      th: 'ติดตาม LINE รับคูปอง 15 นาที',
      en: 'Follow LINE to get a 15-minute coupon',
    },
    valueText: {
      zh: '15分钟免费时长',
      th: 'เวลาฟรี 15 นาที',
      en: '15 minutes free time',
    },
    expireText: {
      zh: '领取后 7 天内有效',
      th: 'ใช้ได้ภายใน 7 วันหลังรับสิทธิ์',
      en: 'Valid within 7 days after claiming',
    },
    ruleText: {
      zh: '仅限指定活动用户领取，每位用户限领 1 次。',
      th: 'เฉพาะผู้ใช้กิจกรรมที่กำหนดเท่านั้น รับได้คนละ 1 ครั้ง',
      en: 'Only available to specified activity users, limited to one claim per user.',
    },
    applyText: {
      zh: '可用于首次借电或活动指定场景。',
      th: 'ใช้ได้กับการยืมครั้งแรกหรือในกิจกรรมที่กำหนด',
      en: 'Can be used for first borrow or specified activity scenarios.',
    },
    buttonText: {
      zh: '立即领取',
      th: 'รับสิทธิ์ทันที',
      en: 'Claim Now',
    },
  },
  '2': {
    id: 2,
    title: {
      zh: '首借免单券',
      th: 'คูปองยืมครั้งแรกฟรี',
      en: 'First borrow free coupon',
    },
    valueText: {
      zh: '首单免单',
      th: 'ฟรีออเดอร์แรก',
      en: 'First order free',
    },
    expireText: {
      zh: '领取后 3 天内有效',
      th: 'ใช้ได้ภายใน 3 วันหลังรับสิทธิ์',
      en: 'Valid within 3 days after claiming',
    },
    ruleText: {
      zh: '仅限首次借电用户使用。',
      th: 'ใช้ได้เฉพาะผู้ใช้ที่ยืมครั้งแรกเท่านั้น',
      en: 'Only for first-time borrowing users.',
    },
    applyText: {
      zh: '到站借电时自动核销。',
      th: 'ระบบจะตัดสิทธิ์อัตโนมัติเมื่อยืมที่สถานี',
      en: 'Automatically redeemed when borrowing at the station.',
    },
    buttonText: {
      zh: '立即领取',
      th: 'รับสิทธิ์ทันที',
      en: 'Claim Now',
    },
  },
}

export default function CouponUserPage() {
  const { id = '1' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { language, t } = useI18n()
  const [shareVisible, setShareVisible] = useState(false)

  const followed = searchParams.get('followed') === '1'
  const coupon = useMemo(() => mockCoupons[id] || mockCoupons['1'], [id])

  const title = pickLocalizedText({ title: coupon.title }, 'title', language)
  const valueText = pickLocalizedText({ valueText: coupon.valueText }, 'valueText', language)
  const expireText = pickLocalizedText({ expireText: coupon.expireText }, 'expireText', language)
  const ruleText = pickLocalizedText({ ruleText: coupon.ruleText }, 'ruleText', language)
  const applyText = pickLocalizedText({ applyText: coupon.applyText }, 'applyText', language)
  const buttonText = pickLocalizedText({ buttonText: coupon.buttonText }, 'buttonText', language)

  const handleFollowDone = () => {
    const next = new URLSearchParams(searchParams)
    next.set('followed', '1')
    setSearchParams(next)
  }

  const handleClaim = () => {
    navigate('/mine')
  }

  if (!followed) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fb', padding: '24px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <Card style={{ borderRadius: 16 }}>
            <div style={{ textAlign: 'center', padding: '12px 0 4px 0' }}>
              <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{title}</div>
              <div style={{ color: '#666', marginBottom: 18 }}>{valueText}</div>
              <Tag color="orange" style={{ fontSize: 13, padding: '4px 10px' }}>
                {t('detail.followRequiredTag')}
              </Tag>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 18,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)',
                border: '1px solid #ffd591',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{t('detail.followTitle')}</div>
              <div style={{ color: '#555', lineHeight: 1.8 }}>{t('detail.followDescCoupon')}</div>
            </div>

            <Space direction="vertical" style={{ width: '100%', marginTop: 20 }}>
              <Button type="primary" size="large" block onClick={handleFollowDone}>
                {t('detail.continueAfterFollow')}
              </Button>
              <Button size="large" block onClick={() => navigate('/welfare')}>
                {t('detail.backToWelfare')}
              </Button>
            </Space>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #1677ff 0%, #69b1ff 100%)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <Card style={{ borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ textAlign: 'center', padding: '8px 0 20px 0' }}>
            <div style={{ fontSize: 14, color: '#1677ff', fontWeight: 700, marginBottom: 8 }}>{t('detail.cityoneBenefit')}</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 20, color: '#fa8c16', fontWeight: 700 }}>{valueText}</div>
          </div>

          <Card size="small" style={{ marginBottom: 14, borderRadius: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('detail.validity')}</div>
            <div style={{ color: '#555' }}>{expireText}</div>
          </Card>

          <Card size="small" style={{ marginBottom: 14, borderRadius: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('detail.rules')}</div>
            <div style={{ color: '#555', lineHeight: 1.8 }}>{ruleText}</div>
          </Card>

          <Card size="small" style={{ marginBottom: 20, borderRadius: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('detail.applicableScenario')}</div>
            <div style={{ color: '#555', lineHeight: 1.8 }}>{applyText}</div>
          </Card>

          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" size="large" block onClick={handleClaim}>
              {buttonText}
            </Button>
            <Button
              size="large"
              block
              icon={<ShareAltOutlined />}
              onClick={() => setShareVisible(true)}
              style={{ borderColor: '#1677ff', color: '#1677ff' }}
            >
              {t('detail.shareEarnPoints')}
            </Button>
            <Button size="large" block onClick={() => navigate('/mine')}>
              {t('detail.goToMine')}
            </Button>
            <Button size="large" block onClick={() => navigate('/welfare')}>
              {t('detail.backToWelfare')}
            </Button>
          </Space>
        </Card>
      </div>

      <SharePromoModal
        open={shareVisible}
        onClose={() => setShareVisible(false)}
        type="coupon"
        id={coupon.id}
        name={title}
      />
    </div>
  )
}
