import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

type AppLanguage = 'zh' | 'th' | 'en'
type LocalizedField = Partial<Record<AppLanguage, string>>
const STORAGE_KEY = 'cityone_growth_lang'
const STORAGE_MODE_KEY = 'cityone_growth_lang_mode'

function normalizeLanguage(input?: string | null): AppLanguage {
  const raw = (input || '').toLowerCase()
  if (raw.startsWith('zh')) return 'zh'
  if (raw.startsWith('th')) return 'th'
  return 'en'
}

function detectBrowserLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') return 'en'
  const browserLang = navigator.language || (Array.isArray(navigator.languages) ? navigator.languages[0] : 'en')
  return normalizeLanguage(browserLang)
}

function detectHomeLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'en'
  const mode = window.localStorage.getItem(STORAGE_MODE_KEY)
  if (mode === 'manual') {
    return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY))
  }
  return detectBrowserLanguage()
}

function pickLocalizedValue(value: LocalizedField | string | undefined, language: AppLanguage, fallback = '') {
  if (!value) return fallback
  if (typeof value === 'string') return value
  return value[language] || value.zh || value.en || value.th || fallback
}

const HOME_MESSAGES = {
  zh: {
    common: {
      home: '首页',
      agent: '问问',
      mine: '我的',
      systemMenu: '系统菜单',
      language: '增长系统语言',
      systemInfo: '系统说明',
      userAgreement: '用户协议',
      privacyPolicy: '隐私政策',
      aboutUs: '关于我们',
    },
    welfare: {
      title: '福利中心',
      subtitle: 'CityOne Growth Hub',
      banner1Title: '首借福利季',
      banner1Sub: '新用户关注 OA 即享专属权益',
      banner2Title: 'Battery SOS',
      banner2Sub: '低电量也能快速找到附近站点',
      banner3Title: '闪电券限时开抢',
      banner3Sub: '限量福利，先到先得',
    },
  },
  th: {
    common: {
      home: 'หน้าแรก',
      agent: 'ผู้ช่วย',
      mine: 'ของฉัน',
      systemMenu: 'เมนูระบบ',
      language: 'ภาษาระบบ',
      systemInfo: 'คำอธิบายระบบ',
      userAgreement: 'ข้อตกลงผู้ใช้',
      privacyPolicy: 'นโยบายความเป็นส่วนตัว',
      aboutUs: 'เกี่ยวกับเรา',
    },
    welfare: {
      title: 'ศูนย์สิทธิประโยชน์',
      subtitle: 'CityOne Growth Hub',
      banner1Title: 'สิทธิพิเศษผู้ใช้ใหม่',
      banner1Sub: 'ติดตาม OA เพื่อรับสิทธิ์พิเศษทันที',
      banner2Title: 'Battery SOS',
      banner2Sub: 'แบตใกล้หมดก็หาสถานีใกล้คุณได้ทันที',
      banner3Title: 'คูปองด่วนจำนวนจำกัด',
      banner3Sub: 'สิทธิ์มีจำนวนจำกัด มาก่อนได้ก่อน',
    },
  },
  en: {
    common: {
      home: 'Home',
      agent: 'Agent',
      mine: 'Mine',
      systemMenu: 'System Menu',
      language: 'System Language',
      systemInfo: 'System Info',
      userAgreement: 'User Agreement',
      privacyPolicy: 'Privacy Policy',
      aboutUs: 'About Us',
    },
    welfare: {
      title: 'Welfare Center',
      subtitle: 'CityOne Growth Hub',
      banner1Title: 'First Borrow Season',
      banner1Sub: 'Follow the OA to unlock newcomer benefits',
      banner2Title: 'Battery SOS',
      banner2Sub: 'Find nearby stations even on low battery',
      banner3Title: 'Flash Coupon Drop',
      banner3Sub: 'Limited quantity, first come first served',
    },
  },
} as const

function getHomeMessage(language: AppLanguage, group: 'common' | 'welfare', key: string) {
  const messages = HOME_MESSAGES[language] || HOME_MESSAGES.en
  return (messages[group] as Record<string, string>)[key] || (HOME_MESSAGES.en[group] as Record<string, string>)[key] || key
}

// ─── 双层 Stale-While-Revalidate 缓存 ────────────────────────────
//
// L1（内存）：组件 unmount 后驻留，重挂载 0ms 命中，同一 Session 内极速
// L2（localStorage）：跨 Session 持久化，LINE 重启 WebView 后依然 0ms 显示
//
// 策略：
//   1. 模块加载时立即从 localStorage 预热 L1
//   2. L1 预热数据标记 stale（bannersAt=0），useEffect 仍触发后台刷新
//   3. 新数据返回后同时写入 L1 + L2
//   4. L2 TTL = 30 分钟（允许展示稍旧内容），内存 TTL = 2 分钟（控制请求频率）
//
// 效果：即使用户完全关闭 LINE 再打开，内容仍在 ~0ms 显示，刷新在背后静默完成
const CACHE_TTL_MS = 2 * 60 * 1000           // 内存：2 分钟内不重复请求
const LS_KEY = 'cityone_welfare_v3'
const LS_TTL_MS = 30 * 60 * 1000             // localStorage：30 分钟有效
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

async function fetchPublicJson(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    url.searchParams.set(key, String(value))
  })
  const res = await fetch(url.toString(), { credentials: 'same-origin' })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.msg || json?.message || `Request failed: ${path}`)
  }
  return json
}

function isObjectKey(v?: string): boolean {
  if (!v) return false
  if (v.startsWith('http') || v.startsWith('/')) return false
  return v.includes('/')
}

function usePublicOssUrl(src?: string) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!src) {
      setUrl('')
      return
    }
    if (!isObjectKey(src)) {
      setUrl(src)
      return
    }

    let cancelled = false
    fetchPublicJson('/media/view-url', { key: src })
      .then((json: any) => {
        if (cancelled) return
        setUrl(json?.data?.previewUrl || '')
      })
      .catch(() => {
        if (!cancelled) setUrl('')
      })

    return () => {
      cancelled = true
    }
  }, [src])

  return url
}

function isLegacyLocalUpload(value: any) {
  return typeof value === 'string' && value.trim().startsWith('/uploads/')
}

function sanitizeCachedCard(card: ContentCard): ContentCard {
  if (!isLegacyLocalUpload(card?.cover)) return card
  return { ...card, cover: '' }
}

function sanitizeCachedBanner(banner: any) {
  if (!banner || typeof banner !== 'object') return banner
  if (!isLegacyLocalUpload(banner.image_url) && !isLegacyLocalUpload(banner.cover)) return banner
  return {
    ...banner,
    image_url: isLegacyLocalUpload(banner.image_url) ? '' : banner.image_url,
    cover: isLegacyLocalUpload(banner.cover) ? '' : banner.cover,
  }
}

function lsLoad(): { banners: any[]; activities: ContentCard[]; coupons: ContentCard[]; mallItems: ContentCard[] } | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - (parsed.savedAt || 0) > LS_TTL_MS) return null
    return {
      banners: Array.isArray(parsed?.banners) ? parsed.banners.map(sanitizeCachedBanner) : [],
      activities: Array.isArray(parsed?.activities) ? parsed.activities.map(sanitizeCachedCard) : [],
      coupons: Array.isArray(parsed?.coupons) ? parsed.coupons.map(sanitizeCachedCard) : [],
      mallItems: Array.isArray(parsed?.mallItems) ? parsed.mallItems.map(sanitizeCachedCard) : [],
    }
  } catch { return null }
}

function lsSave(data: { banners: any[]; activities: ContentCard[]; coupons: ContentCard[]; mallItems: ContentCard[] }) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ...data, savedAt: Date.now() })) } catch {}
}

// 模块加载时（在任何组件渲染之前）立刻从 localStorage 预热
const _lsInit = lsLoad()
const _pageCache: {
  banners: any[];     bannersAt: number
  activities: ContentCard[]; activitiesAt: number
  coupons: ContentCard[];    couponsAt: number
  mallItems: ContentCard[];  mallItemsAt: number
} = {
  // 有 localStorage 数据则立即填入，bannersAt=0 让 useEffect 仍做后台刷新
  banners:    _lsInit?.banners    ?? [],  bannersAt:    0,
  activities: _lsInit?.activities ?? [],  activitiesAt: 0,
  coupons:    _lsInit?.coupons    ?? [],  couponsAt:    0,
  mallItems:  _lsInit?.mallItems  ?? [],  mallItemsAt:  0,
}

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

function InlineIcon({
  label,
  children,
  color = '#667085',
  size = 16,
}: {
  label: string
  children: React.ReactNode
  color?: string
  size?: number
}) {
  return (
    <span
      aria-label={label}
      style={{
        color,
        fontSize: size,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: size,
      }}
    >
      {children}
    </span>
  )
}

// ---------- cover 样式辅助 ----------
// cover 可能是 CSS 渐变字符串，也可能是真实图片 URL
// 图片 URL 须用 backgroundImage + url() 才能正确显示
function coverBgStyle(cover: string, position = 'center'): React.CSSProperties {
  if (cover && cover.includes('gradient')) {
    return { backgroundImage: cover, backgroundSize: '100% 100%' }
  }
  if (cover && /^(https?:\/\/|\/)/.test(cover)) {
    return { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: position, backgroundColor: '#f0f0f0' }
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
  const ossUrl = usePublicOssUrl(isObjectKey(cover) ? cover : undefined)
  const resolvedCover = isObjectKey(cover) ? ossUrl : cover

  return (
    <div
      onClick={onClick}
      style={{
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
                <InlineIcon label="views" size={10}>◔</InlineIcon>
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
              <InlineIcon label="hot" size={11} color="#F59E0B">✦</InlineIcon>
              {viewsLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PlainIconButton({
  children,
  onClick,
  style,
}: {
  children: React.ReactNode
  onClick: () => void
  style?: React.CSSProperties
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: 0,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function SidePanel({
  open,
  onClose,
  side,
  title,
  width,
  children,
}: {
  open: boolean
  onClose: () => void
  side: 'left' | 'right'
  title: string
  width: string
  children: React.ReactNode
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.32)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
          zIndex: 80,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          [side]: 0,
          width,
          maxWidth: '88vw',
          background: '#F7F9FC',
          boxShadow: side === 'left' ? '10px 0 24px rgba(15,23,42,0.16)' : '-10px 0 24px rgba(15,23,42,0.16)',
          transform: open ? 'translateX(0)' : side === 'left' ? 'translateX(-100%)' : 'translateX(100%)',
          transition: 'transform 0.22s ease',
          zIndex: 81,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid rgba(17,24,39,0.06)',
            background: '#fff',
            fontWeight: 800,
            color: '#111827',
          }}
        >
          <span>{title}</span>
          <PlainIconButton onClick={onClose} style={{ width: 32, height: 32, fontSize: 20, color: '#667085' }}>
            ×
          </PlainIconButton>
        </div>
        <div style={{ padding: side === 'right' ? '8px 10px' : '8px 16px', overflowY: 'auto' }}>{children}</div>
      </div>
    </>
  )
}

// ---------- 页面主体 ----------
export default function WelfareHomePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [language, setLanguageState] = useState<AppLanguage>(() => detectHomeLanguage())

  const t = React.useCallback((key: string) => {
    const [group, name] = key.split('.')
    if (group !== 'common' && group !== 'welfare') return key
    return getHomeMessage(language, group, name)
  }, [language])

  const setLanguage = React.useCallback((next: AppLanguage) => {
    setLanguageState(next)
    try {
      window.localStorage.setItem(STORAGE_MODE_KEY, 'manual')
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }, [])

  const [menuOpen, setMenuOpen] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)

  const VALID_TABS = ['recommend', 'activity', 'mall'] as const
  type TabKey = typeof VALID_TABS[number]
  const rawTab = searchParams.get('tab') as TabKey | null
  const tab: TabKey = VALID_TABS.includes(rawTab as TabKey) ? (rawTab as TabKey) : 'recommend'
  const setTab = (k: TabKey) => setSearchParams({ tab: k }, { replace: true })
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
      zh: { recommend: '推荐', activity: '活动中心', mall: '积分商城', nearby: '附近站点', city: '城市', autoLocate: '自动定位' },
      th: { recommend: 'แนะนำ', activity: 'ศูนย์กิจกรรม', mall: 'ร้านแลกคะแนน', nearby: 'สถานีใกล้เคียง', city: 'เมือง', autoLocate: 'ระบุตำแหน่งอัตโนมัติ' },
      en: { recommend: 'Recommended', activity: 'Activities', mall: 'Points Mall', nearby: 'Nearby', city: 'City', autoLocate: 'Auto Location' },
    } as const
    return map[language]
  }, [language])

  const [bannerIndex, setBannerIndex] = useState(0)

  const fallbackBanners = useMemo(
    () => [
      { id: '1', title: t('welfare.banner1Title'), sub_title: t('welfare.banner1Sub'), image_url: '', link_type: 'internal', link_url: '', cover: 'linear-gradient(135deg, #FF7A59 0%, #FFB36B 100%)' },
      { id: '2', title: t('welfare.banner2Title'), sub_title: t('welfare.banner2Sub'), image_url: '', link_type: 'internal', link_url: '', cover: 'linear-gradient(135deg, #7B61FF 0%, #2CDBCE 100%)' },
      { id: '3', title: t('welfare.banner3Title'), sub_title: t('welfare.banner3Sub'), image_url: '', link_type: 'internal', link_url: '', cover: 'linear-gradient(135deg, #2CDBCE 0%, #2F80FF 100%)' },
    ],
    [t]
  )
  const [apiBanners, setApiBanners] = useState<any[]>(_pageCache.banners)
  useEffect(() => {
    if (Date.now() - _pageCache.bannersAt < CACHE_TTL_MS) return
    fetchPublicJson('/growth/banners', { enabled: 'true' }).then((res: any) => {
      const list = res?.data?.list || res?.list || []
      if (list.length > 0) {
        _pageCache.banners = list; _pageCache.bannersAt = Date.now(); setApiBanners(list)
        lsSave({ banners: list, activities: _pageCache.activities, coupons: _pageCache.coupons, mallItems: _pageCache.mallItems })
      }
    }).catch(() => {})
  }, [])
  const bannerItems = apiBanners.length > 0 ? apiBanners : fallbackBanners

  useEffect(() => {
    if (bannerItems.length <= 1) return
    const timer = window.setInterval(() => {
      setBannerIndex((current) => (current + 1) % bannerItems.length)
    }, 4200)
    return () => window.clearInterval(timer)
  }, [bannerItems.length])

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
      try {
        const url = new URL(b.link_url)
        if (url.hostname === window.location.hostname) {
          navigate(url.pathname + url.search + url.hash)
        } else {
          window.open(b.link_url, '_blank')
        }
      } catch {
        window.location.href = b.link_url
      }
    } else {
      navigate(b.link_url)
    }
  }

  const [apiActivities, setApiActivities] = useState<ContentCard[]>(_pageCache.activities)
  const [apiCoupons, setApiCoupons] = useState<ContentCard[]>(_pageCache.coupons)
  const [apiMallItems, setApiMallItems] = useState<ContentCard[]>(_pageCache.mallItems)

  useEffect(() => {
    if (Date.now() - _pageCache.couponsAt < CACHE_TTL_MS) return
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
    fetchPublicJson('/user/coupons').then((res: any) => {
      const list: any[] = res?.data || []
      const rawCards: ContentCard[] = list.map(c => ({
        id: c.id,
        type: 'coupon' as const,
        title: (c.name && typeof c.name === 'object' && !Array.isArray(c.name)) ? c.name : { zh: c.name, th: c.name, en: c.name },
        badge: { zh: '卡券', th: 'คูปอง', en: 'Coupon' },
        cover: isLegacyLocalUpload(c.cover_image) ? (DISCOUNT_COVERS[c.discount_type] || DISCOUNT_COVERS.fixed) : (c.cover_image || DISCOUNT_COVERS[c.discount_type] || DISCOUNT_COVERS.fixed),
        views: c.claimed_count || 0,
        price: fmtPrice(c),
        points: 0,
        route: `/coupon/${c.id}`,
        footerTone: '#2F80FF',
      }))
      _pageCache.coupons = rawCards; _pageCache.couponsAt = Date.now()
      setApiCoupons(rawCards)
      lsSave({ banners: _pageCache.banners, activities: _pageCache.activities, coupons: rawCards, mallItems: _pageCache.mallItems })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (Date.now() - _pageCache.activitiesAt < CACHE_TTL_MS) return
    fetchPublicJson('/activities', { status: 'active' }).then((res: any) => {
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
      const list: any[] = res?.data || []
      const toML = (v: any, fb: Record<string, string>) =>
        (v && typeof v === 'object' && !Array.isArray(v)) ? v : (v ? { zh: v, th: v, en: v } : fb)
      const rawCards: ContentCard[] = list.map((a, idx) => ({
        id: a.activity_id,
        type: 'activity' as const,
        title: toML(a.activity_name || a.activity_title, { zh: '活动', th: 'กิจกรรม', en: 'Activity' }),
        badge: GOAL_BADGE[a.goal] || { zh: '活动', th: 'กิจกรรม', en: 'Activity' },
        cover: isLegacyLocalUpload(a.cover_image) ? COVER_GRADIENTS[idx % COVER_GRADIENTS.length] : (a.cover_image || COVER_GRADIENTS[idx % COVER_GRADIENTS.length]),
        views: 0,
        route: `/activity/${a.activity_id}`,
      }))
      _pageCache.activities = rawCards; _pageCache.activitiesAt = Date.now()
      setApiActivities(rawCards)
      lsSave({ banners: _pageCache.banners, activities: rawCards, coupons: _pageCache.coupons, mallItems: _pageCache.mallItems })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (Date.now() - _pageCache.mallItemsAt < CACHE_TTL_MS) return
    const ITEM_TYPE_COVERS: Record<string, string> = {
      digital:  'linear-gradient(135deg, #7B61FF 0%, #2CDBCE 100%)',
      physical: 'linear-gradient(135deg, #FF7A59 0%, #FFB36B 100%)',
      service:  'linear-gradient(135deg, #2F80FF 0%, #91C4FF 100%)',
    }
    fetchPublicJson('/growth/mall/items', { onShelf: 'true', pageSize: 50 })
      .then((res: any) => {
        const list: any[] = res?.data?.list || res?.list || []
        const toML = (v: any, fb: Record<string, string>) =>
          (v && typeof v === 'object' && !Array.isArray(v)) ? v : (v ? { zh: v, th: v, en: v } : fb)
        const rawCards: ContentCard[] = list.map(item => ({
          id: item.id,
          type: 'redeem' as const,
          title: toML(item.name, { zh: '商品', th: 'สินค้า', en: 'Item' }),
          badge: { zh: '积分兑换', th: 'แลกพอยต์', en: 'Redeem' },
          cover: isLegacyLocalUpload(item.cover_image) ? (ITEM_TYPE_COVERS[item.item_type] || ITEM_TYPE_COVERS.digital) : (item.cover_image || ITEM_TYPE_COVERS[item.item_type] || ITEM_TYPE_COVERS.digital),
          views: 0,
          price: item.price_thb ? `THB ${item.price_thb}` : undefined,
          points: item.points_required || 0,
          route: `/redeem/${item.id}`,
          footerTone: '#7B61FF',
        }))
        _pageCache.mallItems = rawCards; _pageCache.mallItemsAt = Date.now()
        setApiMallItems(rawCards)
        lsSave({ banners: _pageCache.banners, activities: _pageCache.activities, coupons: _pageCache.coupons, mallItems: rawCards })
      })
      .catch(() => {})
  }, [])

  const allCards: ContentCard[] = useMemo(
    () => [...apiActivities, ...apiCoupons, ...apiMallItems],
    [apiActivities, apiCoupons, apiMallItems]
  )

  const filteredCards = useMemo(() => {
    if (tab === 'activity') return allCards.filter((c) => c.type === 'activity')
    if (tab === 'mall') return allCards.filter((c) => c.type === 'coupon' || c.type === 'redeem')
    return allCards
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
            <PlainIconButton onClick={() => setMenuOpen(true)} style={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
              <InlineIcon label="menu" size={20}>☰</InlineIcon>
            </PlainIconButton>
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', whiteSpace: 'nowrap' }}>{t('welfare.title')}</div>
              <div style={{ fontSize: 12, color: '#667085', whiteSpace: 'nowrap' }}>{t('welfare.subtitle')}</div>
            </div>
            <PlainIconButton onClick={() => setCityOpen(true)} style={{ height: 40, paddingInline: 8, fontWeight: 700, color: '#2CDBCE', flexShrink: 0 }}>
              {getCityLabel(cityCode, language)} <InlineIcon label="expand" size={11} color="#2CDBCE">▾</InlineIcon>
            </PlainIconButton>
          </div>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {(['recommend', 'activity', 'mall'] as const).map((k) => (
              <button key={k} style={tabStyle(tab === k)} onClick={() => setTab(k)}>
                {pageText[k]}
              </button>
            ))}
            <button style={tabStyle(false)} onClick={() => navigate('/nearby')}>
              {pageText.nearby}
            </button>
          </div>
        </div>

        <div style={{ padding: '6px 6px 90px' }}>
          {/* 轮播 Banner */}
          <div style={{ marginBottom: 6, borderRadius: 24, overflow: 'hidden', boxShadow: '0 14px 28px rgba(15,23,42,0.10)' }}>
            <div style={{ position: 'relative', height: 172, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  width: `${bannerItems.length * 100}%`,
                  transform: `translateX(-${bannerIndex * (100 / bannerItems.length)}%)`,
                  transition: 'transform 0.28s ease',
                  height: '100%',
                }}
              >
                {bannerItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleBannerClick(item)}
                    style={{ cursor: item.link_url ? 'pointer' : 'default', flex: `0 0 ${100 / bannerItems.length}%`, height: '100%' }}
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
              </div>
              {bannerItems.length > 1 && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, display: 'flex', justifyContent: 'center', gap: 6 }}>
                  {bannerItems.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setBannerIndex(idx)}
                      style={{
                        width: bannerIndex === idx ? 18 : 6,
                        height: 6,
                        borderRadius: 999,
                        border: 'none',
                        background: bannerIndex === idx ? '#fff' : 'rgba(255,255,255,0.45)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 双列网格卡片 — CSS Grid 保证各浏览器排列一致（行→列），避免 Safari/LINE 分栏错位 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignItems: 'start' }}>
            {filteredCards.map((item) => (
              <WaterfallCard
                key={item.id}
                type={item.type}
                title={pickLocalizedValue(item.title, language)}
                cover={item.cover}
                views={item.views}
                price={item.price}
                points={item.points}
                footerTone={item.footerTone}
                lang={language}
                onClick={() => {
                  if (!item.route) return
                  const backTo = tab === 'mall' ? '/welfare?tab=mall'
                    : tab === 'activity' ? '/welfare?tab=activity'
                    : '/welfare'
                  // 直接进详情页，门控在详情页操作按钮处处理，不在入口拦截
                  navigate(item.route, { state: { backTo } })
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 100,
              background: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(10px)',
              borderTop: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              paddingBottom: 8,
              paddingTop: 4,
            }}
          >
            {[
              { key: 'home', label: t('common.home'), icon: '⌂', onClick: () => navigate('/welfare') },
              { key: 'agent', label: t('common.agent'), icon: '◎', onClick: () => navigate('/agent/chat') },
              { key: 'mine', label: t('common.mine'), icon: '◉', onClick: () => navigate('/mine') },
            ].map((item) => (
              <button
                key={item.key}
                onClick={item.onClick}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  padding: '10px 0 8px',
                  color: item.key === 'home' ? '#2CDBCE' : '#7a7a7a',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: item.key === 'home' ? 700 : 500,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 汉堡菜单 */}
      <SidePanel open={menuOpen} onClose={() => setMenuOpen(false)} side="left" title={t('common.systemMenu')} width="72%">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 14, boxShadow: '0 8px 18px rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 10 }}>
              <InlineIcon label="language">🌐</InlineIcon>{t('common.language')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={langButtonStyle('zh')} onClick={() => setLanguage('zh')}>中文</button>
              <button style={langButtonStyle('th')} onClick={() => setLanguage('th')}>ไทย</button>
              <button style={langButtonStyle('en')} onClick={() => setLanguage('en')}>English</button>
            </div>
          </div>
          {[
            { icon: <InlineIcon label="info">ⓘ</InlineIcon>, title: t('common.systemInfo'), onClick: () => { setMenuOpen(false); navigate('/system-desc') } },
            { icon: <InlineIcon label="agreement">≣</InlineIcon>, title: t('common.userAgreement'), onClick: () => { setMenuOpen(false); navigate('/user-agreement') } },
            { icon: <InlineIcon label="privacy">☑</InlineIcon>, title: t('common.privacyPolicy'), onClick: () => { setMenuOpen(false); navigate('/privacy-policy') } },
            { icon: <InlineIcon label="about">◎</InlineIcon>, title: t('common.aboutUs'), onClick: () => { setMenuOpen(false); navigate('/about-us') } },
          ].map((item) => (
            <div
              key={item.title} onClick={item.onClick}
              style={{ background: '#fff', borderRadius: 18, padding: 14, boxShadow: '0 8px 18px rgba(15,23,42,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>{item.icon}{item.title}</div>
              <InlineIcon label="next" size={12} color="#A0A7B3">›</InlineIcon>
            </div>
          ))}
        </div>
      </SidePanel>

      {/* 城市选择 */}
      <SidePanel open={cityOpen} onClose={() => setCityOpen(false)} side="right" title={pageText.city} width="30%">
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
      </SidePanel>
    </div>
  )
}
