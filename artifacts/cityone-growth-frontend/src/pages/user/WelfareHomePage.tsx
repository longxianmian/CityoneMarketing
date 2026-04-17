import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiff, getLiff } from '../../providers/LiffProvider'
import useLineUserStore from '../../store/lineUser'
import { Drawer, Button, Tag, Carousel, Modal } from 'antd'
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
import { prefetchActivity } from '../../cache/activityCache'
import { setRuntimeLineConfig, resolveRuntimeLiffUrl } from '../../lib/line'
import { hasFreshResumePending } from '../../hooks/useFollowGate'
import { isFollowFlowV2Enabled } from '../../lib/followFlow'

type LocalizedField = Partial<Record<AppLanguage, string>>

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
const RESUME_KEYS = [
  'cityone_resume_pending',
  'cityone_resume_at',
  'cityone_resume_return_path',
  'cityone_resume_back_path',
  'cityone_resume_action',
  'cityone_resume_name',
]
const FOLLOW_SESSION_KEYS = [
  'cityone_follow_pending',
  'cityone_follow_return_path',
  'cityone_follow_back_path',
  'cityone_follow_action',
  'cityone_follow_name',
]

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
  const ossUrl = useOssUrl(isObjectKey(cover) ? cover : undefined)
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
  const [searchParams, setSearchParams] = useSearchParams()
  const { t, language, setLanguage } = useI18n()
  const { liffReady } = useLiff()
  const mergeProfile  = useLineUserStore((s) => s.mergeProfile)
  const recoveryRef   = useRef(false)
  const isInLineBrowser = /Line\/\d/i.test(navigator.userAgent)
  const useFollowV2 = isFollowFlowV2Enabled()

  // 关注弹层状态（Step D：身份已建立但未关注）
  const [showFollowModal,    setShowFollowModal]    = useState(false)
  const [followReturnPath,   setFollowReturnPath]   = useState('/welfare')
  const [followChecking,     setFollowChecking]     = useState(false)
  const [followOaId,         setFollowOaId]         = useState('')

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

  const fallbackBanners = useMemo(
    () => [
      { id: '1', title: t('welfare.banner1Title'), sub_title: t('welfare.banner1Sub'), image_url: '', link_type: 'internal', link_url: '', cover: 'linear-gradient(135deg, #FF7A59 0%, #FFB36B 100%)' },
      { id: '2', title: t('welfare.banner2Title'), sub_title: t('welfare.banner2Sub'), image_url: '', link_type: 'internal', link_url: '', cover: 'linear-gradient(135deg, #7B61FF 0%, #2CDBCE 100%)' },
      { id: '3', title: t('welfare.banner3Title'), sub_title: t('welfare.banner3Sub'), image_url: '', link_type: 'internal', link_url: '', cover: 'linear-gradient(135deg, #2CDBCE 0%, #2F80FF 100%)' },
    ],
    [t]
  )
  // 进入 /welfare 时清除 liff_redirect，防止用户从详情页返回后被再次跳走（死循环）
  useEffect(() => {
    sessionStorage.removeItem('liff_redirect')
  }, [])

  // 拉取 OA ID（供关注弹层 line:// 降级使用）
  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
    fetch(`${API_BASE}/api/growth/line/config`)
      .then((r) => r.json())
      .then((j) => {
        setRuntimeLineConfig(j?.data || null)
        const id: string = j?.data?.officialAccountId || ''
        if (id && id !== '@YOUR_OA_ID') setFollowOaId(id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    // 非 LINE 浏览器没有 LIFF 恢复链路，但 guard 仍会把用户带回 /welfare。
    // 这里补上“待恢复动作 -> 关注弹层”的显示，避免用户点击领取/参加后没有任何提示。
    if (useFollowV2 || liffReady || isInLineBrowser || !followOaId) return

    const clearStaleResumeKeys = () => {
      RESUME_KEYS.forEach((k) => localStorage.removeItem(k))
      ;[...RESUME_KEYS, ...FOLLOW_SESSION_KEYS].forEach((k) => sessionStorage.removeItem(k))
    }

    const hasStoredPending =
      hasFreshResumePending(localStorage) ||
      hasFreshResumePending(sessionStorage as Storage)

    // 生产级规则：只有 guard 真实写下“待恢复动作”标记时，/welfare 才允许恢复。
    // 不能仅凭 URL 上残留的 rp/back/action 就把首页误判成“需要先关注”。
    if (!hasStoredPending) {
      clearStaleResumeKeys()
      return
    }

    const directRp = searchParams.get('rp') || searchParams.get('resume_return') || ''
    const rawLiffState = searchParams.get('liff.state') || ''
    const rpFromLiffState = (() => {
      if (!rawLiffState) return ''
      try {
        const qIdx = rawLiffState.indexOf('?')
        if (qIdx < 0) return ''
        const lsParams = new URLSearchParams(rawLiffState.slice(qIdx + 1))
        return lsParams.get('rp') || lsParams.get('resume_return') || ''
      } catch {
        return ''
      }
    })()

    const returnPath =
      directRp ||
      rpFromLiffState ||
      localStorage.getItem('cityone_resume_return_path') ||
      sessionStorage.getItem('cityone_resume_return_path') ||
      ''

    if (returnPath) {
      setFollowReturnPath(returnPath)
      setShowFollowModal(true)
    }
  }, [followOaId, isInLineBrowser, liffReady, searchParams, useFollowV2])

  const clearResumeAndFollowKeys = () => {
    RESUME_KEYS.forEach((k) => localStorage.removeItem(k))
    ;[...RESUME_KEYS, ...FOLLOW_SESSION_KEYS].forEach((k) => sessionStorage.removeItem(k))
  }

  const dismissFollowModal = () => {
    clearResumeAndFollowKeys()
    setFollowReturnPath('/welfare')
    setShowFollowModal(false)
  }

  // ── 身份 + 关注恢复器：/welfare 作为唯一身份恢复中心 ────────────────────────
  //
  // 无条件触发（只要 liffReady=true）：
  //   步骤 A：getProfile → mergeProfile（头像/昵称无条件写入，不依赖 pending 标记）
  //   步骤 B：getFriendship
  //   步骤 C：已关注 → mergeProfile(isFriend:true)
  //           若 localStorage 有 pending → 读取 returnPath → 清理所有键 → navigate(returnPath)
  //   步骤 D：未关注 → mergeProfile(isFriend:false)
  //           若 localStorage 有 pending → 显示关注弹层（不清理键，弹层完成后再清）
  //
  // 恢复键存储优先级：localStorage（主） > sessionStorage（兼容旧版）
  useEffect(() => {
    if (useFollowV2 || !liffReady) return
    if (recoveryRef.current) return
    recoveryRef.current = true

    // ── 在 effect 启动时快照 URL 参数 ──────────────────────────────────────
    // 读取优先级：①直接 URL ?rp= ②liff.state 解码后提取 ?rp= ③localStorage ④sessionStorage
    const directRp     = searchParams.get('rp') || searchParams.get('resume_return') || ''
    const rawLiffState = searchParams.get('liff.state') || ''

    /** 从 liff.state query-string 中解析 rp 参数（LINE 官方格式：liffId/?rp=...） */
    const rpFromLiffState = (): string => {
      if (!rawLiffState) return ''
      try {
        const qIdx = rawLiffState.indexOf('?')
        if (qIdx < 0) return ''
        const lsParams = new URLSearchParams(rawLiffState.slice(qIdx + 1))
        return lsParams.get('rp') || lsParams.get('resume_return') || ''
      } catch { return '' }
    }

    const clearAllResumeKeys = () => {
      clearResumeAndFollowKeys()
    }

    // 读取 returnPath：①URL直接参数 ②liff.state ③localStorage ④sessionStorage
    const readResumeReturnPath = (): string =>
      directRp ||
      rpFromLiffState() ||
      localStorage.getItem('cityone_resume_return_path') ||
      sessionStorage.getItem('cityone_resume_return_path') ||
      ''

    const hasPendingResume = (): boolean => {
      const hasStoredPending =
        hasFreshResumePending(localStorage) ||
        hasFreshResumePending(sessionStorage as Storage)

      // 生产链路里，外部浏览器点击业务动作后会跳到 LINE / LIFF，
      // 回流回 /welfare 时 localStorage 里的 pending 可能不存在，
      // 但 URL 上会明确带回 rp/back/action（或完整 liff.state）。
      // 这类 URL-driven resume 是一次真实的待恢复动作，不能因为 storage 丢失就放弃继续。
      const hasUrlDrivenResume = Boolean(directRp || rawLiffState)

      return hasStoredPending || hasUrlDrivenResume
    }

    /** 用服务端 check-follow 判断关注状态（getFriendship 失败时的兜底） */
    const checkFollowViaApi = async (lineUserId: string): Promise<boolean | null> => {
      try {
        const base = import.meta.env.VITE_API_BASE_URL || ''
        const res  = await fetch(`${base}/api/user/check-follow?user_id=${encodeURIComponent(lineUserId)}`)
        const json = await res.json()
        return json?.data?.is_fan === true ? true : false
      } catch {
        return null  // 服务端也查不了，返回 null 表示未知
      }
    }

    const run = async () => {
      const liff = getLiff()
      if (!liff) {
        recoveryRef.current = false
        return
      }

      // 步骤 A：无条件建立 LINE 身份（头像、昵称）—— 不依赖 pending 标记
      let lineUserId = ''
      try {
        const p = await liff.getProfile()
        lineUserId = p.userId
        mergeProfile({
          lineUserId:      p.userId,
          lineDisplayName: p.displayName,
          linePictureUrl:  p.pictureUrl || '',
        })
      } catch {
        // dev 环境 LIFF 未初始化，忽略
      }

      // 步骤 B：验证关注状态
      //   主路：liff.getFriendship()
      //   兜底：若 LIFF scope 不支持或抛异常 → 调 /api/user/check-follow
      let friendFlag: boolean | null = null
      if (liff.isInClient?.() === true) {
        try {
          const friendship = await liff.getFriendship()
          friendFlag = friendship.friendFlag
        } catch {
          // getFriendship 失败（scope 未开通等），用服务端粉丝列表兜底
          if (lineUserId) {
            friendFlag = await checkFollowViaApi(lineUserId)
          }
        }
      } else if (lineUserId) {
        // 外部浏览器里直接走后端 check-follow，避免 friendship/v1/status 400 噪音
        friendFlag = await checkFollowViaApi(lineUserId)
      }

      const pending    = hasPendingResume()
      const returnPath = readResumeReturnPath()

      if (friendFlag === true) {
        // 步骤 C：已关注
        mergeProfile({ isFriend: true })
        clearAllResumeKeys()
        if (pending && returnPath && returnPath !== '/welfare') {
          navigate(returnPath, { replace: true })
        }
      } else if (friendFlag === false) {
        // 步骤 D：未关注
        mergeProfile({ isFriend: false })
        if (pending && returnPath) {
          setFollowReturnPath(returnPath)
          setShowFollowModal(true)
        }
        recoveryRef.current = false
      } else {
        // null：两路均查不到（开发环境/网络异常），不阻断用户
        recoveryRef.current = false
      }
    }

    run()
  }, [liffReady, mergeProfile, navigate, searchParams, useFollowV2])

  // ── /welfare 内关注按钮处理（弹层主链路 + line:// 降级）──────────────────
  const handleFollowInModal = async () => {
    const liff = getLiff()
    if (!liff || !liffReady) {
      const id = followOaId || ''
      const liffUrl = resolveRuntimeLiffUrl()
      if (!id) {
        Modal.warning({
          title: 'LINE OA 未完成正式配置',
          content: '当前系统尚未配置真实 LINE Official Account，请先在管理端完成 OA 配置后再测试关注链路。',
        })
        return
      }

      // 非 LINE 浏览器下，“关注并继续”不能只跳到 OA 首页，否则原动作无法恢复。
      // 这里优先带着 resume 参数进入正式 LIFF URL，让用户在 LINE / LIFF 完成登录与关注后，
      // /welfare 恢复器继续接管原动作。
      if (liffUrl) {
        const returnPath =
          followReturnPath ||
          localStorage.getItem('cityone_resume_return_path') ||
          sessionStorage.getItem('cityone_resume_return_path') ||
          '/welfare'
        const backPath =
          localStorage.getItem('cityone_resume_back_path') ||
          sessionStorage.getItem('cityone_resume_back_path') ||
          '/welfare'
        const actionName =
          localStorage.getItem('cityone_resume_action') ||
          sessionStorage.getItem('cityone_resume_action') ||
          ''
        const next =
          `${liffUrl}/?rp=${encodeURIComponent(returnPath)}` +
          `&back=${encodeURIComponent(backPath)}` +
          `&action=${encodeURIComponent(actionName)}`
        window.location.href = next
        return
      }

      window.location.href = `line://ti/p/${encodeURIComponent(id)}`
      return
    }
    setFollowChecking(true)
    const canRequest =
      liff.isInClient?.() === true &&
      liff.isApiAvailable?.('requestFriendship') === true
    if (canRequest) {
      try {
        await liff.requestFriendship()
        const friendship = await liff.getFriendship()
        if (!friendship.friendFlag) {
          setFollowChecking(false)
          return
        }
        const p = await liff.getProfile()
        mergeProfile({
          lineUserId:      p.userId,
          lineDisplayName: p.displayName,
          linePictureUrl:  p.pictureUrl || '',
          isFriend:        true,
        })
        // 清理 localStorage（主键）+ sessionStorage（兼容键）
        clearResumeAndFollowKeys()
        setShowFollowModal(false)
        setFollowChecking(false)
        if (followReturnPath && followReturnPath !== '/welfare') {
          navigate(followReturnPath, { replace: true })
        }
        return
      } catch {
        setFollowChecking(false)
      }
    } else {
      setFollowChecking(false)
    }
    // 降级 line:// — 用户返回后恢复器继续接管（cityone_resume_pending 仍在）
    const id = followOaId || ''
    if (!id) {
      Modal.warning({
        title: 'LINE OA 未完成正式配置',
        content: '当前系统尚未配置真实 LINE Official Account，请先在管理端完成 OA 配置后再测试关注链路。',
      })
      return
    }
    window.location.href = `line://ti/p/${encodeURIComponent(id)}`
  }

  const [apiBanners, setApiBanners] = useState<any[]>(_pageCache.banners)
  useEffect(() => {
    if (Date.now() - _pageCache.bannersAt < CACHE_TTL_MS) return
    request.get('/growth/banners', { params: { enabled: 'true' } }).then((res: any) => {
      const list = res.data?.list || []
      if (list.length > 0) {
        _pageCache.banners = list; _pageCache.bannersAt = Date.now(); setApiBanners(list)
        list.forEach((b: any) => {
          const m = typeof b.link_url === 'string' && b.link_url.match(/\/activity\/([^/?]+)/)
          if (m) prefetchActivity(m[1])
        })
        lsSave({ banners: list, activities: _pageCache.activities, coupons: _pageCache.coupons, mallItems: _pageCache.mallItems })
      }
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
    ;(request.get('/user/coupons') as any).then((res: any) => {
      const list: any[] = res.data || []
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
        cover: isLegacyLocalUpload(a.cover_image) ? COVER_GRADIENTS[idx % COVER_GRADIENTS.length] : (a.cover_image || COVER_GRADIENTS[idx % COVER_GRADIENTS.length]),
        views: 0,
        route: `/activity/${a.activity_id}`,
      }))
      _pageCache.activities = rawCards; _pageCache.activitiesAt = Date.now()
      setApiActivities(rawCards)
      rawCards.forEach(c => prefetchActivity(c.id))
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
    ;(request.get('/growth/mall/items', { params: { onShelf: 'true', pageSize: 50 } }) as any)
      .then((res: any) => {
        const list: any[] = (res.data || res)?.list || []
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

          {/* 双列网格卡片 — CSS Grid 保证各浏览器排列一致（行→列），避免 Safari/LINE 分栏错位 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignItems: 'start' }}>
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

      {/* ── 关注弹层（Step D：身份已建立但未关注，或 guard 写 resume_pending=1 后导航到此）── */}
      <Modal
        open={showFollowModal}
        footer={null}
        closable={false}
        centered
        styles={{ body: { padding: 0 } }}
        width={320}
      >
        <div style={{ borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #06c755 0%, #00a84e 100%)', padding: '18px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 6 }}>💬</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>CityOne</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.15)', display: 'inline-block', padding: '2px 10px', borderRadius: 20 }}>
              {{ zh: '官方认证帐号', th: 'บัญชีที่ได้รับการยืนยัน', en: 'Verified Official Account' }[language]}
            </div>
          </div>
          <div style={{ padding: '20px 20px 24px', background: '#fff' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8, color: '#1a1a1a' }}>
              {{ zh: '需先关注 CityOne LINE OA', th: 'กรุณาติดตาม CityOne LINE OA ก่อน', en: 'Follow CityOne LINE OA First' }[language]}
            </div>
            <div style={{ fontSize: 13, color: '#666', lineHeight: 1.7, marginBottom: 20 }}>
              {{ zh: '关注后即可享受专属福利，领取卡券、参与活动、兑换积分礼品。', th: 'ติดตามเพื่อรับสิทธิพิเศษ คูปอง กิจกรรม และรางวัล', en: 'Follow to enjoy exclusive benefits: coupons, activities, and rewards.' }[language]}
            </div>
            <Button
              type="primary"
              size="large"
              block
              loading={followChecking}
              disabled={followChecking}
              onClick={handleFollowInModal}
              style={{ height: 48, borderRadius: 50, fontSize: 15, fontWeight: 700, background: 'linear-gradient(135deg, #06c755, #00a84e)', border: 'none', boxShadow: '0 4px 16px rgba(6,199,85,0.35)', marginBottom: 10 }}
            >
              {{ zh: followChecking ? '正在验证…' : '关注 LINE OA 并继续', th: followChecking ? 'กำลังตรวจสอบ…' : 'ติดตาม LINE OA แล้วดำเนินการต่อ', en: followChecking ? 'Verifying…' : 'Follow LINE OA & Continue' }[language]}
            </Button>
            <Button
              block
              size="large"
              onClick={dismissFollowModal}
              style={{ height: 44, borderRadius: 50, fontSize: 14, color: '#888', border: '1px solid #e8e8e8' }}
            >
              {{ zh: '稍后再说', th: 'ภายหลัง', en: 'Maybe Later' }[language]}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
