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
import request from '../../api/request'
import { isObjectKey, useOssUrl } from '../../components/OssImage'

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

// ---------- cover 样式辅助 ----------
// cover 可能是 CSS 渐变字符串，也可能是真实图片 URL
// 图片 URL 须用 backgroundImage + url() 才能正确显示
function coverBgStyle(cover: string, position = 'center'): React.CSSProperties {
  if (cover && /^(https?:\/\/|\/)/.test(cover)) {
    return { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: position, backgroundColor: '#f0f0f0' }
  }
  if (cover && cover.includes('gradient')) {
    return { background: cover }
  }
  return { backgroundColor: '#f0f0f0' }
}

// ---------- 卡片组件 ----------
// 总高 = 112.5% 宽度；图片区 55%，信息区 45%
function WaterfallCard({
  type,
  title,
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

  // Resolve OSS object keys to signed HTTPS URLs reactively
  const ossUrl = useOssUrl(isObjectKey(cover) ? cover : undefined)
  const resolvedCover = isObjectKey(cover) ? ossUrl : cover

  return (
    /* break-inside: avoid 防止 CSS columns 把卡片切断跨列
       总高 = 2 × 56.25% = 112.5% 宽度
       图片占上半（16:9）= 文字占下半，两区等高，卡片不会太矮 */
    <div
      onClick={onClick}
      style={{
        breakInside: 'avoid',
        marginBottom: 6,
        position: 'relative',
        width: '100%',
        paddingTop: '112.5%',
        borderRadius: 20,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
        cursor: 'pointer',
        border: '1px solid rgba(15, 23, 42, 0.04)',
      }}
    >
      {/* 绝对定位内容层 */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>

        {/* 图片区 — 占 55%（视觉上图片更突出） */}
        <div
          style={{
            flex: '0 0 55%',
            ...coverBgStyle(resolvedCover || '', 'center'),
            position: 'relative',
          }}
        >
          {null}
        </div>

        {/* 信息区 — 占 45% */}
        <div
          style={{
            flex: '0 0 45%',
            padding: '10px 12px 12px',
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
              WebkitLineClamp: isProduct ? 2 : 3,
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

  const fallbackBanners = useMemo(
    () => [
      { id: '1', title: t('welfare.banner1Title'), sub_title: t('welfare.banner1Sub'), image_url: '', link_type: 'internal', link_url: '', cover: 'linear-gradient(135deg, #FF7A59 0%, #FFB36B 100%)' },
      { id: '2', title: t('welfare.banner2Title'), sub_title: t('welfare.banner2Sub'), image_url: '', link_type: 'internal', link_url: '', cover: 'linear-gradient(135deg, #7B61FF 0%, #2CDBCE 100%)' },
      { id: '3', title: t('welfare.banner3Title'), sub_title: t('welfare.banner3Sub'), image_url: '', link_type: 'internal', link_url: '', cover: 'linear-gradient(135deg, #2CDBCE 0%, #2F80FF 100%)' },
    ],
    [t]
  )
  const [apiBanners, setApiBanners] = useState<any[]>([])
  useEffect(() => {
    request.get('/growth/banners', { params: { enabled: 'true' } }).then((res: any) => {
      const list = res.data?.list || []
      if (list.length > 0) setApiBanners(list)
    }).catch(() => {})
  }, [])
  const bannerItems = apiBanners.length > 0 ? apiBanners : fallbackBanners

  const getBannerTitle = (b: any): string => {
    if (typeof b.title === 'string') return b.title
    if (b.title && typeof b.title === 'object') return b.title[language] || b.title.zh || b.title.en || ''
    return ''
  }
  const getBannerSub = (b: any): string => {
    if (typeof b.sub_title === 'string') return b.sub_title
    if (b.sub_title && typeof b.sub_title === 'object') return b.sub_title[language] || b.sub_title.zh || b.sub_title.en || ''
    return ''
  }
  const handleBannerClick = (b: any) => {
    if (!b.link_url) return
    const isAbsoluteUrl = /^https?:\/\//i.test(b.link_url)
    if (isAbsoluteUrl) {
      window.location.href = b.link_url
    } else {
      navigate(b.link_url)
    }
  }

  const [apiActivities, setApiActivities] = useState<ContentCard[]>([])
  const [apiCoupons, setApiCoupons] = useState<ContentCard[]>([])
  const [apiMallItems, setApiMallItems] = useState<ContentCard[]>([])

  useEffect(() => {
    const DISCOUNT_COVERS: Record<string, string> = {
      free_time:  'linear-gradient(135deg, #2F80FF 0%, #91C4FF 100%)',
      free_order: 'linear-gradient(135deg, #FF7A59 0%, #FFB36B 100%)',
      fixed:      'linear-gradient(135deg, #7B61FF 0%, #C3B5FF 100%)',
      percent:    'linear-gradient(135deg, #2CDBCE 0%, #2F80FF 100%)',
    }
    const fmtPrice = (c: any) => {
      const val = Number(c.discount_value || 0)
      if (c.discount_type === 'free_time')  return `FREE ${val} min`
      if (c.discount_type === 'free_order') return 'FREE'
      if (c.discount_type === 'percent')    return `${100 - val}% OFF`
      return `฿${val} OFF`
    }
    ;(request.get('/user/coupons') as any).then((res: any) => {
      const list: any[] = res.data || []
      const rawCards: ContentCard[] = list.map(c => ({
        id: c.id,
        type: 'coupon' as const,
        title: (c.name && typeof c.name === 'object' && !Array.isArray(c.name)) ? c.name : { zh: c.name, th: c.name, en: c.name },
        badge: { zh: '卡券', th: 'คูปอง', en: 'Coupon' },
        cover: c.cover_image || DISCOUNT_COVERS[c.discount_type] || DISCOUNT_COVERS.fixed,
        views: c.claimed_count || 0,
        price: fmtPrice(c),
        points: 0,
        route: `/coupon/${c.id}`,
        footerTone: '#2F80FF',
      }))
      setApiCoupons(rawCards)
    }).catch(() => {})
  }, [])

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
      const toML = (v: any, fb: Record<string, string>) =>
        (v && typeof v === 'object' && !Array.isArray(v)) ? v : (v ? { zh: v, th: v, en: v } : fb)
      const rawCards: ContentCard[] = list.map((a, idx) => ({
        id: a.activity_id,
        type: 'activity' as const,
        title: toML(a.activity_name || a.activity_title, { zh: '活动', th: 'กิจกรรม', en: 'Activity' }),
        badge: GOAL_BADGE[a.goal] || { zh: '活动', th: 'กิจกรรม', en: 'Activity' },
        cover: a.cover_image || COVER_GRADIENTS[idx % COVER_GRADIENTS.length],
        views: 0,
        route: `/activity/${a.activity_id}`,
      }))
      setApiActivities(rawCards)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const ITEM_TYPE_COVERS: Record<string, string> = {
      digital:  'linear-gradient(135deg, #7B61FF 0%, #2CDBCE 100%)',
      physical: 'linear-gradient(135deg, #FF7A59 0%, #FFB36B 100%)',
      service:  'linear-gradient(135deg, #2F80FF 0%, #91C4FF 100%)',
    }
    ;(request.get('/growth/mall/items', { params: { onShelf: 'true', pageSize: 50 } }) as any)
      .then((res: any) => {
        const list: any[] = (res.data || res)?.list || []
        const rawCards: ContentCard[] = list.map(item => ({
          id: item.id,
          type: 'redeem' as const,
          title: item.name,
          badge: { zh: '积分兑换', th: 'แลกพอยต์', en: 'Redeem' },
          cover: item.cover_image || ITEM_TYPE_COVERS[item.item_type] || ITEM_TYPE_COVERS.digital,
          views: 0,
          price: item.price_thb ? `THB ${item.price_thb}` : undefined,
          points: item.points_required || 0,
          route: `/redeem/${item.id}`,
          footerTone: '#7B61FF',
        }))
        setApiMallItems(rawCards)
      })
      .catch(() => {})
  }, [])

  const allCards: ContentCard[] = useMemo(
    () => [...apiActivities, ...apiCoupons, ...apiMallItems],
    [apiActivities, apiCoupons, apiMallItems]
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
            <Carousel autoplay dots swipe={false} touchMove={false}>
              {bannerItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleBannerClick(item)}
                  style={{ cursor: item.link_url ? 'pointer' : 'default' }}
                >
                  {item.image_url ? (
                    <div style={{ height: 172, position: 'relative', overflow: 'hidden' }}>
                      <img src={item.image_url} alt={getBannerTitle(item)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      {(getBannerTitle(item) || getBannerSub(item)) && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px 20px 16px', background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)' }}>
                          {getBannerTitle(item) && <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{getBannerTitle(item)}</div>}
                          {getBannerSub(item) && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.92)' }}>{getBannerSub(item)}</div>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ height: 172, ...(item.cover ? coverBgStyle(item.cover) : {}), color: '#fff', padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{getBannerTitle(item)}</div>
                      <div style={{ fontSize: 14, opacity: 0.96 }}>{getBannerSub(item)}</div>
                    </div>
                  )}
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
      <Drawer placement="right" open={cityOpen} onClose={() => setCityOpen(false)} title={pageText.city} width="30%" styles={{ body: { paddingTop: 8, padding: '8px 10px', background: '#F7F9FC' } }}>
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
                style={{ width: '100%', textAlign: 'left', border: 'none', borderRadius: 14, padding: '10px 12px', background: active ? '#2CDBCE' : '#fff', color: active ? '#fff' : '#111827', fontWeight: 700, boxShadow: '0 4px 12px rgba(15,23,42,0.06)', cursor: 'pointer', fontSize: 13 }}
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
