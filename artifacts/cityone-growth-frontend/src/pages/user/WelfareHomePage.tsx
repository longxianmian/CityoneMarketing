import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer, Button, Tag, Carousel } from 'antd'
import {
  MenuOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  FireOutlined,
  EyeOutlined,
  HomeOutlined,
  RobotOutlined,
  UserOutlined,
  EnvironmentOutlined,
  DownOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { useI18n, type AppLanguage, pickLocalizedText } from '../../i18n'
import UserBottomNav from '../../components/user/UserBottomNav'
import { getActivities } from '../../api/growth'

type LocalizedField = Partial<Record<AppLanguage, string>>

type ContentCard = {
  id: string
  type: 'activity' | 'coupon' | 'redeem' | 'station'
  title: LocalizedField
  badge: LocalizedField
  cover: string
  route?: string
  views?: number
  price?: string        // e.g. "THB 59" — 卡券/可兑换专用
  points?: number       // e.g. 620 — 卡券/可兑换专用
  footerTone?: string
}

const THAILAND_CITIES = [
  { code: 'bangkok', zh: '曼谷', th: 'กรุงเทพฯ', en: 'Bangkok' },
  { code: 'chiang-mai', zh: '清迈', th: 'เชียงใหม่', en: 'Chiang Mai' },
  { code: 'pattaya', zh: '芭堤雅', th: 'พัทยา', en: 'Pattaya' },
  { code: 'phuket', zh: '普吉', th: 'ภูเก็ต', en: 'Phuket' },
  { code: 'khon-kaen', zh: '孔敬', th: 'ขอนแก่น', en: 'Khon Kaen' },
  { code: 'hat-yai', zh: '合艾', th: 'หาดใหญ่', en: 'Hat Yai' },
]

function getCityLabel(cityCode: string, lang: AppLanguage) {
  const item = THAILAND_CITIES.find((x) => x.code === cityCode) || THAILAND_CITIES[0]
  if (lang === 'zh') return item.zh
  if (lang === 'th') return item.th
  return item.en
}

// ---------- 卡片组件 ----------
// 黄金比例容器：宽:高 = 1:1.618
// 图片区 = 卡片高度 2/3 ；信息区 = 1/3
function WaterfallCard({
  type,
  title,
  badge,
  cover,
  views,
  price,
  points,
  footerTone = '#667085',
  onClick,
  lang,
}: {
  type: ContentCard['type']
  title: string
  badge?: string
  cover: string
  views?: number
  price?: string
  points?: number
  footerTone?: string
  onClick: () => void
  lang: AppLanguage
}) {
  const isProduct = type === 'coupon' || type === 'redeem'
  const viewsLabel = views !== undefined
    ? views >= 1000 ? `${(views / 1000).toFixed(1)}k` : String(views)
    : '—'

  const ptLabel = lang === 'zh' ? '积分' : lang === 'th' ? 'คะแนน' : 'pts'

  return (
    <div
      onClick={onClick}
      style={{
        /* 黄金比例 1:1.618 */
        aspectRatio: '1 / 1.618',
        borderRadius: 20,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
        cursor: 'pointer',
        border: '1px solid rgba(15, 23, 42, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        marginBottom: 6,
      }}
    >
      {/* 缩略图区 — 占 2/3 */}
      <div
        style={{
          flex: '2 0 0',
          background: cover,
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          padding: 10,
          minHeight: 0,
        }}
      >
        {badge ? (
          <Tag
            style={{
              margin: 0,
              borderRadius: 999,
              paddingInline: 9,
              paddingBlock: 3,
              border: 'none',
              fontWeight: 700,
              fontSize: 11,
              background: 'rgba(255,255,255,0.92)',
              color: '#111827',
              lineHeight: 1.6,
            }}
          >
            {badge}
          </Tag>
        ) : null}
      </div>

      {/* 信息区 — 占 1/3 */}
      <div
        style={{
          flex: '1 0 0',
          padding: '10px 12px 10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* 标题 */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.35,
            color: '#111827',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: isProduct ? 1 : 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {title}
        </div>

        {/* 底部信息行 */}
        {isProduct ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 价格 + 积分 */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: footerTone !== '#667085' ? footerTone : '#7B61FF',
                lineHeight: 1.3,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {price ? `${price}${points !== undefined ? ` · ${points} ${ptLabel}` : ''}` : points !== undefined ? `${points} ${ptLabel}` : ''}
            </div>
            {/* 热度 */}
            <div
              style={{
                fontSize: 11,
                color: '#9CA3AF',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                lineHeight: 1.3,
              }}
            >
              <EyeOutlined style={{ fontSize: 10 }} />
              {viewsLabel}
            </div>
          </div>
        ) : (
          /* 活动 / 站点：只显示热度 */
          <div
            style={{
              fontSize: 12,
              color: '#9CA3AF',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              lineHeight: 1.3,
            }}
          >
            <FireOutlined style={{ fontSize: 11, color: '#F59E0B' }} />
            {viewsLabel}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- 页面主体 ----------
export default function WelfareHomePage() {
  const navigate = useNavigate()
  const { t, language, setLanguage } = useI18n()

  const [menuOpen, setMenuOpen] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  const [tab, setTab] = useState<'recommend' | 'activity' | 'coupon' | 'redeem' | 'nearby'>('recommend')
  const [cityCode, setCityCode] = useState('bangkok')

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      () => { setCityCode('bangkok') },
      () => { setCityCode('bangkok') }
    )
  }, [])

  const pageText = useMemo(() => {
    const map = {
      zh: { recommend: '推荐', activity: '活动', coupon: '卡券', redeem: '可兑换', nearby: '附近站点', city: '城市', autoLocate: '自动定位' },
      th: { recommend: 'แนะนำ', activity: 'กิจกรรม', coupon: 'คูปอง', redeem: 'แลกได้', nearby: 'สถานีใกล้เคียง', city: 'เมือง', autoLocate: 'ระบุตำแหน่งอัตโนมัติ' },
      en: { recommend: 'Recommended', activity: 'Activities', coupon: 'Coupons', redeem: 'Redeem', nearby: 'Nearby Stations', city: 'City', autoLocate: 'Auto Location' },
    } as const
    return map[language]
  }, [language])

  const bannerItems = useMemo(
    () => [
      { id: '1', title: t('welfare.banner1Title'), subTitle: t('welfare.banner1Sub'), cover: 'linear-gradient(135deg, #FF7A59 0%, #FFB36B 100%)' },
      { id: '2', title: t('welfare.banner2Title'), subTitle: t('welfare.banner2Sub'), cover: 'linear-gradient(135deg, #7B61FF 0%, #2CDBCE 100%)' },
      { id: '3', title: t('welfare.banner3Title'), subTitle: t('welfare.banner3Sub'), cover: 'linear-gradient(135deg, #2CDBCE 0%, #2F80FF 100%)' },
    ],
    [t]
  )

  const [apiActivities, setApiActivities] = useState<ContentCard[]>([])

  useEffect(() => {
    getActivities({ status: 'active' }).then(res => {
      const COVER_GRADIENTS = [
        'linear-gradient(135deg, #2CDBCE 0%, #2F80FF 100%)',
        'linear-gradient(135deg, #7B61FF 0%, #2F80FF 100%)',
        'linear-gradient(135deg, #FF7A59 0%, #FFB36B 100%)',
        'linear-gradient(135deg, #2F80FF 0%, #2CDBCE 100%)',
        'linear-gradient(135deg, #7B61FF 0%, #C3B5FF 100%)',
      ]
      const GOAL_BADGE: Record<string, { zh: string; th: string; en: string }> = {
        '拉新': { zh: '拉新', th: 'หาผู้ใช้ใหม่', en: 'Acquire' },
        '促关注': { zh: '促关注', th: 'เพิ่มผู้ติดตาม', en: 'Follow' },
        '转用户': { zh: '转用户', th: 'แปลงผู้ใช้', en: 'Convert' },
        '转会员': { zh: '转会员', th: 'สมาชิก', en: 'Member' },
        '复购': { zh: '复购', th: 'ซื้อซ้ำ', en: 'Repurchase' },
        '召回': { zh: '召回', th: 'ดึงกลับ', en: 'Recall' },
        '联合活动': { zh: '联合', th: 'ร่วมกิจกรรม', en: 'Joint' },
      }
      const list: any[] = (res as any).data || []
      const cards: ContentCard[] = list.map((a, idx) => ({
        id: a.activity_id,
        type: 'activity' as const,
        title: { zh: a.activity_name || a.activity_title || '活动', th: a.activity_name || a.activity_title || 'กิจกรรม', en: a.activity_name || a.activity_title || 'Activity' },
        badge: GOAL_BADGE[a.goal] || { zh: '活动', th: 'กิจกรรม', en: 'Activity' },
        cover: a.cover_image || COVER_GRADIENTS[idx % COVER_GRADIENTS.length],
        views: 0,
        route: `/activity/${a.activity_id}`,
      }))
      setApiActivities(cards)
    }).catch(() => {})
  }, [])

  const staticNonActivityCards: ContentCard[] = useMemo(() => [
    {
      id: 'r2', type: 'redeem',
      title: { zh: '音乐畅听权益', th: 'สิทธิ์ฟังเพลงไม่จำกัด', en: 'Music unlimited access' },
      badge: { zh: '数字商品', th: 'ดิจิทัล', en: 'Digital' },
      cover: 'linear-gradient(135deg, #2CDBCE 0%, #7B61FF 100%)',
      views: 5400, price: 'THB 59', points: 620,
      route: '/coupon/1?followed=1', footerTone: '#7B61FF',
    },
    {
      id: 'c1', type: 'coupon',
      title: { zh: '15分钟免费时长券', th: 'คูปองเวลาฟรี 15 นาที', en: '15-min free time coupon' },
      badge: { zh: '卡券', th: 'คูปอง', en: 'Coupon' },
      cover: 'linear-gradient(135deg, #2F80FF 0%, #91C4FF 100%)',
      views: 7200, price: 'FREE', points: 0,
      route: '/redeem/1?followed=1', footerTone: '#2F80FF',
    },
    {
      id: 'c2', type: 'coupon',
      title: { zh: '首借免单券', th: 'คูปองยืมครั้งแรกฟรี', en: 'First borrow free coupon' },
      badge: { zh: '高转化', th: 'แปลงผลสูง', en: 'High Conv.' },
      cover: 'linear-gradient(135deg, #FF7A59 0%, #FFB36B 100%)',
      views: 8830, price: 'FREE', points: 0,
      route: '/coupon/2?followed=1', footerTone: '#FF7A59',
    },
    {
      id: 'r1', type: 'redeem',
      title: { zh: '电子书会员包', th: 'แพ็กสมาชิกอีบุ๊ก', en: 'E-book membership pack' },
      badge: { zh: '可兑换', th: 'แลกได้', en: 'Redeem' },
      cover: 'linear-gradient(135deg, #7B61FF 0%, #C3B5FF 100%)',
      views: 3150, price: 'THB 99', points: 990,
      route: '/redeem/2?followed=1', footerTone: '#7B61FF',
    },
    {
      id: 'n1', type: 'station',
      title: { zh: '曼谷 Siam 商圈站点', th: 'สถานี Siam กรุงเทพฯ', en: 'Bangkok Siam station' },
      badge: { zh: '站点', th: 'สถานี', en: 'Station' },
      cover: 'linear-gradient(135deg, #2CDBCE 0%, #61E6DC 100%)',
      views: 4200,
    },
    {
      id: 'n3', type: 'coupon',
      title: { zh: '15分钟券可在附近使用', th: 'คูปอง 15 นาทีใช้ใกล้คุณได้', en: '15-min coupon usable nearby' },
      badge: { zh: '附近可用', th: 'คูปองใกล้คุณ', en: 'Nearby Coupon' },
      cover: 'linear-gradient(135deg, #FFB36B 0%, #FF7A59 100%)',
      views: 5580, price: 'FREE', points: 0,
      route: '/coupon/1?followed=1', footerTone: '#FF7A59',
    },
    {
      id: 'n4', type: 'redeem',
      title: { zh: '附近可兑换联名马克杯', th: 'แก้วคอลแลบแลกได้ใกล้คุณ', en: 'Nearby redeemable co-branded mug' },
      badge: { zh: '附近兑换', th: 'แลกใกล้คุณ', en: 'Nearby Redeem' },
      cover: 'linear-gradient(135deg, #7B61FF 0%, #2CDBCE 100%)',
      views: 2980, price: 'THB 149', points: 1490,
      route: '/redeem/3?followed=1', footerTone: '#7B61FF',
    },
  ], [])

  const allCards: ContentCard[] = useMemo(
    () => [...apiActivities, ...staticNonActivityCards],
    [apiActivities, staticNonActivityCards]
  )

  const filteredCards = useMemo(() => {
    if (tab === 'recommend') return allCards
    if (tab === 'activity') return allCards.filter((c) => c.type === 'activity')
    if (tab === 'coupon') return allCards.filter((c) => c.type === 'coupon')
    if (tab === 'redeem') return allCards.filter((c) => c.type === 'redeem')
    return allCards.filter((c) => c.id.startsWith('n'))
  }, [allCards, tab])

  const langButtonStyle = (lang: AppLanguage): React.CSSProperties => ({
    border: 'none', borderRadius: 999, padding: '8px 12px', cursor: 'pointer', fontWeight: 700,
    background: language === lang ? '#2CDBCE' : '#F0F4FA',
    color: language === lang ? '#fff' : '#555',
  })

  const tabStyle = (active: boolean): React.CSSProperties => ({
    border: 'none', borderRadius: 999, padding: '10px 16px', whiteSpace: 'nowrap',
    background: active ? '#2CDBCE' : '#F4FBFA',
    color: active ? '#fff' : '#4B5563', fontWeight: 700, cursor: 'pointer',
    boxShadow: active ? '0 10px 18px rgba(44,219,206,0.22)' : '0 4px 10px rgba(15,23,42,0.03)',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9FC' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', background: '#F7F9FC' }}>

        {/* 顶部吸顶导航 */}
        <div
          style={{
            position: 'sticky', top: 0, zIndex: 20,
            background: 'rgba(247,249,252,0.92)', backdropFilter: 'blur(12px)',
            padding: '14px 16px 12px', borderBottom: '1px solid rgba(17,24,39,0.04)',
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, minHeight: 44 }}>
            <Button type="text" icon={<MenuOutlined style={{ fontSize: 20 }} />} onClick={() => setMenuOpen(true)} style={{ width: 40, height: 40, flexShrink: 0 }} />
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', whiteSpace: 'nowrap' }}>{t('welfare.title')}</div>
              <div style={{ fontSize: 12, color: '#667085', whiteSpace: 'nowrap' }}>{t('welfare.subtitle')}</div>
            </div>
            <Button type="text" onClick={() => setCityOpen(true)} style={{ height: 40, paddingInline: 8, fontWeight: 700, color: '#2CDBCE', flexShrink: 0 }}>
              {getCityLabel(cityCode, language)} <DownOutlined style={{ fontSize: 11, marginLeft: 3 }} />
            </Button>
          </div>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {(['recommend', 'activity', 'coupon', 'redeem', 'nearby'] as const).map((k) => (
              <button key={k} style={tabStyle(tab === k)} onClick={() => setTab(k)}>
                {pageText[k]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '6px 6px 90px' }}>
          {/* 轮播 Banner */}
          <div style={{ marginBottom: 6, borderRadius: 24, overflow: 'hidden', boxShadow: '0 14px 28px rgba(15,23,42,0.10)' }}>
            <Carousel autoplay dots>
              {bannerItems.map((item) => (
                <div key={item.id}>
                  <div style={{ height: 172, background: item.cover, color: '#fff', padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{item.title}</div>
                    <div style={{ fontSize: 14, opacity: 0.96 }}>{item.subTitle}</div>
                  </div>
                </div>
              ))}
            </Carousel>
          </div>

          {/* 瀑布流卡片 — 黄金比例 1:1.618 */}
          <div style={{ columnCount: 2, columnGap: 6 }}>
            {filteredCards.map((item) => (
              <WaterfallCard
                key={item.id}
                type={item.type}
                title={pickLocalizedText({ title: item.title }, 'title', language)}
                badge={pickLocalizedText({ badge: item.badge }, 'badge', language)}
                cover={item.cover}
                views={item.views}
                price={item.price}
                points={item.points}
                footerTone={item.footerTone}
                lang={language}
                onClick={() => { if (item.route) navigate(item.route) }}
              />
            ))}
          </div>
        </div>

        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <UserBottomNav
            current="home"
            onHome={() => navigate('/welfare')}
            onAgent={() => navigate('/agent/chat')}
            onMine={() => navigate('/mine')}
          />
        </div>
      </div>

      {/* 汉堡菜单 */}
      <Drawer placement="left" open={menuOpen} onClose={() => setMenuOpen(false)} title={t('common.systemMenu')} width="72%" styles={{ body: { paddingTop: 8, background: '#F7F9FC' } }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 14, boxShadow: '0 8px 18px rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 10 }}>
              <GlobalOutlined />{t('common.language')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={langButtonStyle('zh')} onClick={() => setLanguage('zh')}>中文</button>
              <button style={langButtonStyle('th')} onClick={() => setLanguage('th')}>ไทย</button>
              <button style={langButtonStyle('en')} onClick={() => setLanguage('en')}>English</button>
            </div>
          </div>
          {[
            { icon: <InfoCircleOutlined />, title: t('common.systemInfo'), onClick: () => { setMenuOpen(false); navigate('/system-desc') } },
            { icon: <FileTextOutlined />, title: t('common.userAgreement'), onClick: () => { setMenuOpen(false); navigate('/user-agreement') } },
            { icon: <SafetyCertificateOutlined />, title: t('common.privacyPolicy'), onClick: () => { setMenuOpen(false); navigate('/privacy-policy') } },
            { icon: <TeamOutlined />, title: t('common.aboutUs'), onClick: () => { setMenuOpen(false); navigate('/about-us') } },
          ].map((item) => (
            <div
              key={item.title} onClick={item.onClick}
              style={{ background: '#fff', borderRadius: 18, padding: 14, boxShadow: '0 8px 18px rgba(15,23,42,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>{item.icon}{item.title}</div>
              <RightOutlined style={{ fontSize: 12, color: '#A0A7B3' }} />
            </div>
          ))}
        </div>
      </Drawer>

      {/* 城市选择 */}
      <Drawer placement="right" open={cityOpen} onClose={() => setCityOpen(false)} title={pageText.city} styles={{ body: { paddingTop: 8, background: '#F7F9FC' } }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 14, boxShadow: '0 8px 18px rgba(15,23,42,0.06)' }}>
            <div style={{ color: '#667085', marginBottom: 10 }}>{pageText.autoLocate}</div>
            <div style={{ fontWeight: 800, color: '#2CDBCE' }}>{getCityLabel(cityCode, language)}</div>
          </div>
          {THAILAND_CITIES.map((city) => {
            const label = language === 'zh' ? city.zh : language === 'th' ? city.th : city.en
            const active = city.code === cityCode
            return (
              <button key={city.code} onClick={() => { setCityCode(city.code); setCityOpen(false) }}
                style={{ width: '100%', textAlign: 'left', border: 'none', borderRadius: 18, padding: '14px 16px', background: active ? '#2CDBCE' : '#fff', color: active ? '#fff' : '#111827', fontWeight: 700, boxShadow: '0 8px 18px rgba(15,23,42,0.06)', cursor: 'pointer' }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </Drawer>
    </div>
  )
}
