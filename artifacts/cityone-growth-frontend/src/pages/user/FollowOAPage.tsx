import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n'

const LINE_OA_URL = 'https://line.me/R/ti/p/@cityone'

export default function FollowOAPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { language } = useI18n()

  const to = params.get('to') || '/welfare'
  const name = params.get('name') || ''
  const back = params.get('back') || '/welfare'

  const L = {
    pageTitle:  { zh: '关注 LINE OA', th: 'ติดตาม LINE OA', en: 'Follow LINE OA' }[language]!,
    headline:   { zh: '需先关注 CityOne LINE OA', th: 'กรุณาติดตาม CityOne LINE OA ก่อน', en: 'Follow CityOne LINE OA First' }[language]!,
    desc:       {
      zh: '关注后即可享受专属福利，领取卡券、参与活动、兑换积分礼品，全部畅享无阻。',
      th: 'หลังจากติดตามแล้ว คุณจะได้รับสิทธิพิเศษ รับคูปอง เข้าร่วมกิจกรรม และแลกของรางวัลด้วยคะแนนได้ทันที',
      en: 'Once you follow, enjoy exclusive benefits: claim coupons, join activities, and redeem rewards with points.',
    }[language]!,
    step1:      { zh: '① 点击下方按钮，打开 LINE App', th: '① กดปุ่มด้านล่างเพื่อเปิด LINE App', en: '① Tap the button below to open LINE App' }[language]!,
    step2:      { zh: '② 搜索并关注「CityOne」官方帐号', th: '② ค้นหาและติดตาม LINE OA "CityOne"', en: '② Search and follow "CityOne" LINE OA' }[language]!,
    step3:      { zh: '③ 关注完成后，自动进入活动页面', th: '③ หลังติดตามแล้ว จะนำไปยังหน้ากิจกรรมทันที', en: '③ After following, you\'ll be taken to the activity page' }[language]!,
    followBtn:  { zh: '关注 LINE OA 并继续', th: 'ติดตาม LINE OA แล้วดำเนินการต่อ', en: 'Follow LINE OA & Continue' }[language]!,
    backBtn:    { zh: '返回', th: 'กลับ', en: 'Back' }[language]!,
    oaBadge:    { zh: '官方认证帐号', th: 'บัญชีที่ได้รับการยืนยัน', en: 'Verified Official Account' }[language]!,
  }

  const handleFollow = () => {
    window.open(LINE_OA_URL, '_blank')
    setTimeout(() => navigate(to), 800)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f0fef4 0%, #e6f4ff 100%)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 32px' }}>
        {/* 顶部导航 */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e8f4e8' }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(back)}
            style={{ paddingLeft: 0 }}
          >
            {L.backBtn}
          </Button>
          <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 16, marginRight: 40 }}>
            {L.pageTitle}
          </span>
        </div>

        {/* LINE OA 品牌区 */}
        <div style={{
          margin: '24px 16px 0',
          borderRadius: 20,
          background: '#fff',
          overflow: 'hidden',
          boxShadow: '0 2px 16px rgba(6,199,85,0.12)',
          border: '1px solid #d9f7be',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #06c755 0%, #00a84e 100%)',
            padding: '28px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>CityOne</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.15)', display: 'inline-block', padding: '3px 10px', borderRadius: 20 }}>
              {L.oaBadge}
            </div>
          </div>

          <div style={{ padding: '24px 20px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: '#1a1a1a' }}>{L.headline}</div>
            <div style={{ fontSize: 14, color: '#666', lineHeight: 1.8, marginBottom: 20 }}>{L.desc}</div>

            {name && (
              <div style={{
                background: 'linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)',
                border: '1px solid #ffd591',
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 20,
                fontSize: 14,
                color: '#ad6800',
              }}>
                🎯 {name}
              </div>
            )}

            <div style={{ background: '#f6ffed', border: '1px solid #d9f7be', borderRadius: 14, padding: '16px', marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#389e0d', marginBottom: 12 }}>
                { { zh: '操作步骤', th: 'ขั้นตอน', en: 'Steps' }[language] }
              </div>
              {[L.step1, L.step2, L.step3].map((s, i) => (
                <div key={i} style={{ fontSize: 13, color: '#555', lineHeight: 1.9 }}>{s}</div>
              ))}
            </div>

            <Button
              type="primary"
              size="large"
              block
              onClick={handleFollow}
              style={{
                height: 52,
                borderRadius: 50,
                fontSize: 16,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #06c755, #00a84e)',
                border: 'none',
                boxShadow: '0 4px 16px rgba(6,199,85,0.35)',
              }}
            >
              {L.followBtn}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
