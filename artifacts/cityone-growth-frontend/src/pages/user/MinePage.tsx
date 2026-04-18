import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Card, Tag, Badge, Avatar, Spin, Empty, Modal } from 'antd'
import {
  CreditCardOutlined,
  StarOutlined,
  OrderedListOutlined,
  CrownOutlined,
  ThunderboltOutlined,
  DownOutlined,
  GiftOutlined,
  EnvironmentOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { useI18n, type AppLanguage, pickLocalizedText } from '../../i18n'
import UserBottomNav from '../../components/user/UserBottomNav'
import UserPageHeader from '../../components/user/UserPageHeader'
import useLineUserStore, { type IdentityTag } from '../../store/lineUser'
import {
  getUserPointsSummary,
  getUserPointsLedger,
  getUserPointsRedeems,
  getUserProfile,
  getUserPrizes,
  getUserBenefits,
  getUserOrders,
} from '../../api/growth'
import { useEffectiveUserId } from '../../hooks/useEffectiveUserId'
import {
  buildOwnedBenefitDetailPath,
  getBenefitPrimaryAction,
} from './benefitAction'

// 将 UTC 时间戳转换为曼谷时间（UTC+7）显示
function fmtBKK(iso?: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).replace(/\//g, '-')
  } catch { return iso.slice(0, 16).replace('T', ' ') }
}

type AppLang = AppLanguage
type LocalizedField = Partial<Record<AppLang, string>>

const TAB_PARAM_MAP: Record<string, MainTab> = {
  prizes: 'prize',
  benefits: 'benefit',
  orders: 'order',
  member: 'member',
  prize: 'prize',
  benefit: 'benefit',
  order: 'order',
}

function EarnGuideCard() {
  const [open, setOpen] = useState(false)
  const { t } = useI18n()

  const title = t('mine.earnGuideTitle')

  const ways = [
    { icon: '🤝', label: t('mine.earnWay1') },
    { icon: '⚡', label: t('mine.earnWay2') },
    { icon: '⚠️', label: t('mine.earnWay3') },
    { icon: '🚫', label: t('mine.earnWay4') },
  ]

  const uses = t('mine.earnUses')

  return (
    <div
      style={{
        border: '1px solid #ECF1F6',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 2,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          border: 'none',
          background: open ? 'linear-gradient(90deg, #7B61FF11 0%, #2F80FF11 100%)' : '#fff',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          gap: 10,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>{title}</span>
        <DownOutlined
          style={{
            fontSize: 12,
            color: '#7B61FF',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px', background: '#FAFBFF' }}>
          <div style={{ fontSize: 12, color: '#667085', fontWeight: 600, marginBottom: 8 }}>
            {t('mine.earnWaysLabel')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {ways.map((w, i) => (
              <div
                key={i}
                style={{
                  background: '#fff',
                  border: '1px solid #ECF1F6',
                  borderRadius: 10,
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 16 }}>{w.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{w.label}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              background: 'linear-gradient(90deg, #7B61FF22 0%, #2F80FF22 100%)',
              borderRadius: 10,
              padding: '10px 12px',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>🎁</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7B61FF', marginBottom: 3 }}>
                {t('mine.pointsUsesLabel')}
              </div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{uses}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type MainTab = 'prize' | 'benefit' | 'order' | 'member'
type CouponSubTab = 'available' | 'used' | 'expired'
type PointsSubTab = 'balance' | 'exchange' | 'earn'

function normalizeIdentityLevel(raw: unknown): IdentityTag {
  const level = String(raw || '').trim().toLowerCase()
  if (level === 'user') return 'customer'
  if (level === 'visitor' || level === 'fan' || level === 'customer' || level === 'member') {
    return level
  }
  return 'visitor'
}

export default function MinePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t, language } = useI18n()
  const { profile } = useLineUserStore()

  // 先读规范再改代码：
  // - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-identity-and-business-levels.md
  // - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-external-browser-line-continue-flow.md
  //
  // 强约束：
  // - MinePage 的身份等级只能读后端 /api/user/profile/me
  // - 不允许根据头像昵称、points 账户、前端缓存自行推断 identity_level
  // - LIFF store 只可做展示兜底，不可作为身份真源
  //
  // ── 顶部用户资料（从真实 profile/me 接口取，缺失仅兜底展示字段） ──────────
  const [serverProfile, setServerProfile] = useState<any>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)

  const lineUserId = profile?.lineUserId || ''
  const effectiveUserId = useEffectiveUserId()
  // 是否在 LINE 内置浏览器（含 LIFF）—— 用于 API 调用门控
  const isInLine = /Line\/\d/i.test(navigator.userAgent)

  // LIFF 拿到的 LINE 数据最权威，优先于服务端缓存
  const lineDisplayName =
    profile?.lineDisplayName || serverProfile?.line_display_name || 'CityOne LINE User'
  const linePictureUrl =
    profile?.linePictureUrl || serverProfile?.line_picture_url || ''

  const identityLevel: IdentityTag = normalizeIdentityLevel(
    serverProfile?.identity_level || serverProfile?.identity_tag
  )

  const depositPaid: boolean =
    serverProfile?.deposit_paid ?? profile?.depositPaid ?? false
  const depositAmount: number =
    serverProfile?.deposit_amount ?? profile?.deposit ?? 0

  // 保留会员展示等级字段，但不再把它当成用户身份等级使用
  const memberLevelRaw = serverProfile?.member_level || profile?.memberLevel || ''
  const memberLevel = useMemo(() => {
    const levelMap: Record<string, Record<string, string>> = {
      gold: { zh: '黄金等级', th: 'ระดับโกลด์', en: 'Gold Level' },
      standard: { zh: '标准等级', th: 'ระดับมาตรฐาน', en: 'Standard Level' },
      platinum: { zh: '铂金等级', th: 'ระดับแพลทินัม', en: 'Platinum Level' },
    }
    const mapped = levelMap[memberLevelRaw] || levelMap['standard']
    return mapped[language] || mapped['en']
  }, [memberLevelRaw, language])

  // 可用卡券数：优先从 serverProfile 取
  const couponAvailableCount: number =
    serverProfile?.coupon_count ?? profile?.couponCount ?? 0

  const initialTab: MainTab = TAB_PARAM_MAP[searchParams.get('tab') ?? ''] ?? 'benefit'
  const [mainTab, setMainTab] = useState<MainTab>(initialTab)

  const handleSetMainTab = (tab: MainTab) => {
    setMainTab(tab)
    setSearchParams(
      {
        tab:
          tab === 'prize'
            ? 'prizes'
            : tab === 'benefit'
            ? 'benefits'
            : tab === 'order'
            ? 'orders'
            : 'member',
      },
      { replace: true }
    )
  }

  const [couponSub, setCouponSub] = useState<CouponSubTab>('available')
  const [pointsSub, setPointsSub] = useState<PointsSubTab>('balance')

  // ── 积分（已有真实接口） ──────────────────────────────────────────────────
  const [pointsSummary, setPointsSummary] = useState({
    totalPoints: 0,
    availablePoints: 0,
    pendingPoints: 0,
    consumedPoints: 0,
    revokedPoints: 0,
  })
  const [ledgerItems, setLedgerItems] = useState<any[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [redeemItems, setRedeemItems] = useState<any[]>([])
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [summaryLoaded, setSummaryLoaded] = useState(false)
  const [borrowModalOpen, setBorrowModalOpen] = useState(false)
  const [physicalGiftModalOpen, setPhysicalGiftModalOpen] = useState(false)

  // ── 阶段三：奖品真实接口 ──────────────────────────────────────────────────
  const [prizeItems, setPrizeItems] = useState<any[]>([])
  const [prizeLoading, setPrizeLoading] = useState(false)
  const [prizeLoaded, setPrizeLoaded] = useState(false)

  // ── 阶段三：权益真实接口 ──────────────────────────────────────────────────
  const [benefitItems, setBenefitItems] = useState<any[]>([])
  const [benefitLoading, setBenefitLoading] = useState(false)

  // ── 阶段三：订单真实接口 ──────────────────────────────────────────────────
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderDataNote, setOrderDataNote] = useState<string>('')

  // ── 加载用户资料（身份唯一真源：/api/user/profile/me） ────────────────────
  useEffect(() => {
    // LINE 内置浏览器：等 LIFF 建立 lineUserId 后再请求，避免以 dev_... 设备 ID 查询
    if (isInLine && !lineUserId) return
    const load = async () => {
      try {
        const res: any = await getUserProfile(lineUserId ? { line_user_id: lineUserId } : {})
        if (res?.data) {
          setServerProfile(res.data)
        }
      } catch (e) {
        // fallback 到 store 数据或 mock
      }
      setProfileLoaded(true)
    }
    load()
  }, [lineUserId])

  // ── 加载积分总览 ───────────────────────────────────────────────────────────
  useEffect(() => {
    // LINE 内置浏览器：等 LIFF 建立 lineUserId 后再请求，避免以 dev_... 设备 ID 查询
    if (isInLine && !lineUserId) return
    const load = async () => {
      try {
        const res: any = await getUserPointsSummary(
          { user_id: effectiveUserId }
        )
        const s = res?.data || {}
        setPointsSummary({
          totalPoints: s.total_points || 0,
          availablePoints: s.available_points || 0,
          pendingPoints: s.pending_points || 0,
          consumedPoints: s.consumed_points || 0,
          revokedPoints: s.revoked_points || 0,
        })
      } catch (e) {}
      setSummaryLoaded(true)
    }
    load()
  }, [lineUserId])

  const loadLedger = useCallback(async () => {
    if (isInLine && !lineUserId) return
    setLedgerLoading(true)
    try {
      const res: any = await getUserPointsLedger({
        user_id: effectiveUserId,
        page: 1,
        page_size: 20,
      })
      setLedgerItems(res?.data?.items || [])
    } catch (e) {}
    setLedgerLoading(false)
  }, [lineUserId])

  const loadRedeems = useCallback(async () => {
    if (isInLine && !lineUserId) return
    setRedeemLoading(true)
    try {
      const res: any = await getUserPointsRedeems({
        user_id: effectiveUserId,
        page: 1,
        page_size: 20,
      })
      setRedeemItems(res?.data?.items || [])
    } catch (e) {}
    setRedeemLoading(false)
  }, [lineUserId])

  useEffect(() => {
    if (mainTab === 'member') {
      if (pointsSub === 'balance') loadLedger()
      else if (pointsSub === 'exchange') loadRedeems()
    }
  }, [mainTab, pointsSub])

  // ── 阶段三：加载奖品记录 ──────────────────────────────────────────────────
  const loadPrizes = useCallback(async () => {
    if (isInLine && !lineUserId) return
    setPrizeLoading(true)
    try {
      const res: any = await getUserPrizes({
        user_id: effectiveUserId,
        page: 1,
        page_size: 20,
      })
      setPrizeItems(res?.data?.items || [])
    } catch (e) {
      setPrizeItems([])
    }
    setPrizeLoading(false)
    setPrizeLoaded(true)
  }, [lineUserId])

  useEffect(() => {
    if (mainTab === 'prize' && !prizeLoaded) {
      loadPrizes()
    }
  }, [mainTab])

  // ── 阶段三：加载权益记录（按 tab 状态过滤） ─────────────────────────────
  const loadBenefits = useCallback(
    async (status?: 'available' | 'used' | 'expired') => {
      if (isInLine && !lineUserId) return
      setBenefitLoading(true)
      try {
        const res: any = await getUserBenefits({
          user_id: effectiveUserId,
          status,
          page: 1,
          page_size: 30,
        })
        setBenefitItems(res?.data?.items || [])
      } catch (e) {
        setBenefitItems([])
      }
      setBenefitLoading(false)
    },
    [effectiveUserId]
  )

  useEffect(() => {
    if (mainTab === 'benefit') {
      const statusMap: Record<CouponSubTab, 'available' | 'used' | 'expired'> = {
        available: 'available',
        used: 'used',
        expired: 'expired',
      }
      loadBenefits(statusMap[couponSub])
    }
  }, [mainTab, couponSub, loadBenefits])

  // ── 阶段三：加载订单记录（当前返回空列表+说明） ──────────────────────────
  const loadOrders = useCallback(async () => {
    if (isInLine && !lineUserId) return
    setOrderLoading(true)
    try {
      const res: any = await getUserOrders({
        user_id: effectiveUserId,
        page: 1,
        page_size: 20,
      })
      setOrderItems(res?.data?.items || [])
      setOrderDataNote(res?.data?.data_note || '')
    } catch (e) {
      setOrderItems([])
    }
    setOrderLoading(false)
  }, [lineUserId])

  useEffect(() => {
    if (mainTab === 'order') {
      loadOrders()
    }
  }, [mainTab])

  const mainTabConfig: {
    key: MainTab
    label: string
    icon: React.ReactNode
    color: string
    bg: string
  }[] = [
    { key: 'prize', label: t('mine.tabPrize'), icon: <GiftOutlined />, color: '#FF7A59', bg: '#FFF3EE' },
    { key: 'benefit', label: t('mine.tabBenefit'), icon: <CreditCardOutlined />, color: '#2CDBCE', bg: '#E8FBF8' },
    { key: 'order', label: t('mine.tabOrder'), icon: <OrderedListOutlined />, color: '#2F80FF', bg: '#EAF2FF' },
    { key: 'member', label: t('mine.tabMember'), icon: <CrownOutlined />, color: '#7B61FF', bg: '#F1EDFF' },
  ]

  const couponSubConfig = [
    { key: 'available' as CouponSubTab, label: t('mine.couponTabAvailable') },
    { key: 'used' as CouponSubTab, label: t('mine.couponTabUsed') },
    { key: 'expired' as CouponSubTab, label: t('mine.couponTabExpired') },
  ]

  const pointsSubConfig = [
    { key: 'balance' as PointsSubTab, label: t('mine.pointsTabBalance') },
    { key: 'exchange' as PointsSubTab, label: t('mine.pointsTabExchange') },
    { key: 'earn' as PointsSubTab, label: t('mine.pointsTabEarn') },
  ]

  const activeMain = mainTabConfig.find((tab) => tab.key === mainTab)!

  const subTabStyle = (active: boolean, color: string): React.CSSProperties => ({
    flex: 1,
    border: 'none',
    borderRadius: 20,
    padding: '7px 0',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    background: active ? color : 'transparent',
    color: active ? '#fff' : '#667085',
    transition: 'all 0.2s',
  })

  // 可用卡券数量（来自真实接口 benefitItems 中 status=available 的数量）
  const availableBenefitCount = benefitItems.filter((b) => b.status === 'available').length

  const couponStatusLabel: Record<CouponSubTab, { color: string; text: string }> = {
    available: { color: 'cyan', text: t('mine.couponStatusAvailable') },
    used: { color: 'default', text: t('mine.couponStatusUsed') },
    expired: { color: 'red', text: t('mine.couponStatusExpired') },
  }

  // 互动类型显示名
  function interactionTypeName(type: string) {
    const map: Record<string, string> = {
      wheel_draw: t('mine.wheelDraw'),
      scratch_reveal: t('mine.scratchReveal'),
      fortune_draw: t('mine.fortuneDraw'),
    }
    return map[type] || type
  }

  // 奖品状态显示
  function prizeStatusTag(status: string) {
    if (status === 'granted') return { color: 'green', text: t('mine.prizeStatusGranted') }
    if (status === 'pending') return { color: 'orange', text: t('mine.prizeStatusPending') }
    if (status === 'expired') return { color: 'red', text: t('mine.prizeStatusExpired') }
    return { color: 'default', text: status }
  }

  const mineTitle = t('mine.pageTitle')

  const identityLabel =
    identityLevel === 'visitor'
      ? { zh: '访客', th: 'ผู้เยี่ยมชม', en: 'Visitor' }[language]
      : identityLevel === 'fan'
      ? { zh: '粉丝', th: 'แฟน', en: 'Fan' }[language]
      : identityLevel === 'customer'
      ? { zh: '用户', th: 'ผู้ใช้', en: 'Customer' }[language]
      : { zh: '会员', th: 'สมาชิก', en: 'Member' }[language]

  const identityDesc =
    identityLevel === 'visitor'
      ? { zh: '当前会话尚未识别到 LINE 身份', th: 'เซสชันนี้ยังไม่รู้จัก LINE', en: 'Current session has not identified a LINE identity' }[language]
      : identityLevel === 'fan'
      ? { zh: '已关注 LINE OA，已完成系统注册', th: 'ติดตาม LINE OA แล้ว และลงทะเบียนเข้าระบบแล้ว', en: 'Followed LINE OA and completed system registration' }[language]
      : identityLevel === 'customer'
      ? { zh: '已使用充电服务', th: 'เคยใช้บริการชาร์จแล้ว', en: 'Has used charging service' }[language]
      : { zh: '已缴纳押金，可直接取电', th: 'ชำระเงินมัดจำแล้ว สามารถยืมได้ทันที', en: 'Deposit paid and ready to borrow' }[language]

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9FC' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <UserPageHeader title={mineTitle} onBack={() => navigate('/welfare')} />
      </div>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '8px 16px 90px' }}>

        {/* 用户信息卡 */}
        <div
          style={{
            borderRadius: 24,
            background: 'linear-gradient(135deg, #2CDBCE 0%, #2F80FF 100%)',
            color: '#fff',
            padding: 20,
            marginBottom: 20,
            boxShadow: '0 16px 28px rgba(44,219,206,0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <Avatar
              size={68}
              src={linePictureUrl || undefined}
              style={{
                backgroundColor: 'rgba(255,255,255,0.22)',
                color: '#fff',
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              {lineDisplayName.slice(0, 1).toUpperCase()}
            </Avatar>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, opacity: 0.92, marginBottom: 4 }}>LINE</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{lineDisplayName}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* 身份标签（粉丝/用户/会员）— 独立显示，来自真实接口规则推断 */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background:
                      identityLevel === 'member'
                        ? 'rgba(255,215,0,0.25)'
                        : identityLevel === 'customer'
                        ? 'rgba(255,255,255,0.22)'
                        : 'rgba(255,255,255,0.14)',
                    border:
                      identityLevel === 'member'
                        ? '1px solid rgba(255,215,0,0.5)'
                        : '1px solid rgba(255,255,255,0.25)',
                    padding: '4px 10px',
                    borderRadius: 999,
                  }}
                >
                  <span style={{ fontSize: 13 }}>
                    {identityLevel === 'visitor' ? '🪪' : identityLevel === 'fan' ? '⭐' : identityLevel === 'customer' ? '👤' : '💎'}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>
                    {identityLabel}
                  </span>
                </div>
                {/* 等级（与身份分开）*/}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'rgba(255,255,255,0.12)',
                    padding: '4px 10px',
                    borderRadius: 999,
                  }}
                >
                  <CrownOutlined style={{ fontSize: 13 }} />
                  <span style={{ fontWeight: 600, fontSize: 12, opacity: 0.9 }}>{memberLevel}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 身份等级说明 */}
          <div style={{ marginBottom: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              {
                tag: 'fan' as const,
                icon: '⭐',
                desc: { zh: '关注 LINE OA', th: 'ติดตาม LINE OA', en: 'Followed LINE OA' }[language]!,
                active: identityLevel !== 'visitor',
              },
              {
                tag: 'customer' as const,
                icon: '👤',
                desc: { zh: '使用过充电服务', th: 'ใช้บริการชาร์จแล้ว', en: 'Used charging service' }[language]!,
                active: identityLevel === 'customer' || identityLevel === 'member',
              },
              {
                tag: 'member' as const,
                icon: '💎',
                desc: { zh: '已缴押金 · 充电 9 折', th: 'วางเงินมัดจำ · ลด 10% ชาร์จ', en: 'Deposit paid · 10% off charging' }[language]!,
                active: identityLevel === 'member',
              },
            ].map((tier) => (
              <div
                key={tier.tag}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: tier.active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
                  border: tier.active ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.12)',
                  opacity: tier.active ? 1 : 0.45,
                  fontSize: 12,
                  color: '#fff',
                }}
              >
                <span style={{ fontSize: 12 }}>{tier.icon}</span>
                <span style={{ fontWeight: tier.active ? 700 : 400 }}>{tier.desc}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              {
                label: t('mine.colCoupons'),
                value: serverProfile?.coupon_count ?? couponAvailableCount,
                unit: '',
              },
              {
                label: t('mine.colPoints'),
                value: pointsSummary.availablePoints.toLocaleString(),
                unit: '',
              },
              {
                label: t('mine.colDeposit'),
                value: depositAmount,
                unit: '฿',
              },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  borderRadius: 14,
                  padding: '10px 10px 12px',
                  backdropFilter: 'blur(6px)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.88, marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                  {item.unit && (
                    <span style={{ fontSize: 13, fontWeight: 600, marginRight: 1 }}>
                      {item.unit}
                    </span>
                  )}
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 常用功能：4 个主 tab */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 12 }}>
            {t('mine.menuTitle')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            {mainTabConfig.map((tab) => {
              const active = mainTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => handleSetMainTab(tab.key)}
                  style={{
                    border: active ? `2px solid ${tab.color}` : '2px solid transparent',
                    borderRadius: 18,
                    padding: '14px 8px',
                    background: active ? tab.bg : '#fff',
                    boxShadow: active
                      ? `0 4px 16px ${tab.color}33`
                      : '0 4px 12px rgba(15,23,42,0.06)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 14,
                      background: active ? tab.color : tab.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: active ? '#fff' : tab.color,
                      fontSize: 18,
                      transition: 'all 0.2s',
                    }}
                  >
                    {tab.icon}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: active ? tab.color : '#374151',
                    }}
                  >
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 内容区 */}
        <div
          style={{
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 8px 24px rgba(15,23,42,0.07)',
            overflow: 'hidden',
          }}
        >
          {/* 子 tab 栏 */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '12px 12px 8px',
              background: '#F7F9FC',
              borderBottom: '1px solid #ECF1F6',
            }}
          >
            {mainTab === 'prize' && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 4px',
                  color: '#374151',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                <GiftOutlined style={{ color: activeMain.color }} />
                {t('mine.tabPrize')}
              </div>
            )}
            {mainTab === 'benefit' &&
              couponSubConfig.map((sub) => (
                <button
                  key={sub.key}
                  onClick={() => setCouponSub(sub.key)}
                  style={subTabStyle(couponSub === sub.key, activeMain.color)}
                >
                  {sub.label}
                  {sub.key === 'available' && availableBenefitCount > 0 && (
                    <Badge
                      count={availableBenefitCount}
                      size="small"
                      style={{
                        marginLeft: 4,
                        backgroundColor:
                          couponSub === 'available'
                            ? 'rgba(255,255,255,0.4)'
                            : activeMain.color,
                      }}
                    />
                  )}
                </button>
              ))}
            {mainTab === 'order' && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 4px',
                  color: '#374151',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                <ThunderboltOutlined style={{ color: activeMain.color }} />
                {t('mine.chargingRecords')}
              </div>
            )}
            {mainTab === 'member' &&
              pointsSubConfig.map((sub) => (
                <button
                  key={sub.key}
                  onClick={() => setPointsSub(sub.key)}
                  style={subTabStyle(pointsSub === sub.key, activeMain.color)}
                >
                  {sub.label}
                </button>
              ))}
          </div>

          {/* 内容列表 */}
          <div style={{ padding: 12, display: 'grid', gap: 10 }}>

            {/* ─── 奖品 tab（阶段三：真实接口，来自 activity-interactions） ─────── */}
            {mainTab === 'prize' && (
              <Spin spinning={prizeLoading}>
                {prizeItems.length === 0 && !prizeLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#A0A7B3' }}>
                    <GiftOutlined
                      style={{ fontSize: 40, color: '#FFB49E', marginBottom: 12, display: 'block' }}
                    />
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                      {t('mine.noPrize')}
                    </div>
                    <div style={{ fontSize: 12 }}>{t('mine.noPrizeHint')}</div>
                  </div>
                ) : (
                  prizeItems.map((item, i) => {
                    const statusInfo = prizeStatusTag(item.prize_status || 'granted')
                    return (
                      <div
                        key={item.interaction_id || i}
                        style={{
                          border: '1px solid #ECF1F6',
                          borderRadius: 14,
                          padding: '12px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: 4 }}>
                            <Tag color="orange">{interactionTypeName(item.interaction_type)}</Tag>
                            <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
                          </div>
                          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
                            {item.prize_name || t('mine.defaultPrizeName')}
                          </div>
                          {item.product_name && (
                            <div style={{ color: '#FF7A59', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                              {item.product_name}
                            </div>
                          )}
                          <div style={{ color: '#A0A7B3', fontSize: 12 }}>
                            {item.created_at
                              ? fmtBKK(item.created_at)
                              : '--'}
                          </div>
                        </div>
                        <GiftOutlined style={{ fontSize: 24, color: '#FFB49E' }} />
                      </div>
                    )
                  })
                )}
              </Spin>
            )}

            {/* ─── 权益 tab（阶段三：真实接口，来自 user-products） ────────────── */}
            {mainTab === 'benefit' && (
              <Spin spinning={benefitLoading}>
                {benefitItems.length === 0 && !benefitLoading ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px 0',
                      color: '#A0A7B3',
                      fontSize: 14,
                    }}
                  >
                    {t('mine.noCoupons')}
                  </div>
                ) : (
                  benefitItems.map((item, i) => (
                    (() => {
                      const detailRoute = buildOwnedBenefitDetailPath(item)
                      const primaryAction = getBenefitPrimaryAction({
                        benefit: item,
                        status: item.status,
                        language,
                        couponId: item.product_id,
                        userProductId: item.user_product_id,
                      })
                      const primaryActionRoute =
                        primaryAction.type === 'benefit_detail'
                          ? detailRoute
                          : primaryAction.route

                      return (
                        <div
                          key={item.user_product_id || i}
                          onClick={() => item.product_id && navigate(detailRoute)}
                          style={{
                            border: '1px solid #ECF1F6',
                            borderRadius: 14,
                            padding: '12px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            cursor: item.product_id ? 'pointer' : 'default',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ marginBottom: 4 }}>
                              <Tag color={couponStatusLabel[couponSub].color}>
                                {couponStatusLabel[couponSub].text}
                              </Tag>
                            </div>
                            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
                              {typeof item.product_name === 'object' && item.product_name
                                ? (item.product_name[language] || item.product_name.en || item.product_name.zh || item.product_name.th || t('mine.defaultProductName'))
                                : (item.product_name || t('mine.defaultProductName'))}
                            </div>
                            {item.short_benefit_text && (
                              <div
                                style={{ color: '#FF7A59', fontWeight: 700, fontSize: 13, marginBottom: 4 }}
                              >
                                {item.short_benefit_text}
                              </div>
                            )}
                            <div style={{ color: '#A0A7B3', fontSize: 12 }}>
                              {item.expire_at
                                ? `${t('mine.expireAtPrefix')}${fmtBKK(item.expire_at).slice(0, 10)}`
                                : item.issued_at
                                ? `${t('mine.issuedAtPrefix')}${fmtBKK(item.issued_at).slice(0, 10)}`
                                : ''}
                            </div>
                          </div>
                          {couponSub === 'available' && item.product_id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (!primaryAction.disabled && primaryActionRoute) {
                                  navigate(primaryActionRoute)
                                }
                              }}
                              disabled={primaryAction.disabled}
                              style={{
                                border: `1.5px solid ${primaryAction.disabled ? '#D0D5DD' : '#2CDBCE'}`,
                                borderRadius: 20,
                                padding: '6px 14px',
                                background: 'transparent',
                                color: primaryAction.disabled ? '#98A2B3' : '#2CDBCE',
                                fontWeight: 700,
                                fontSize: 13,
                                cursor: primaryAction.disabled ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {primaryAction.label}
                            </button>
                          )}
                        </div>
                      )
                    })()
                  ))
                )}
              </Spin>
            )}

            {/* ─── 会员 tab（积分真实，身份/押金阶段三真实规则推断） ───────────── */}
            {mainTab === 'member' && (
              <>
                {/* 身份状态卡 */}
                <div
                  style={{
                    border: '1.5px solid #ECF1F6',
                    borderRadius: 14,
                    padding: '14px 16px',
                    marginBottom: 2,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#7B61FF', marginBottom: 10 }}>
                    {t('mine.identityStatus')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: '#F7F3FF', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: '#A0A7B3', marginBottom: 4 }}>{t('mine.identityLevel')}</div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#7B61FF' }}>
                        {identityLevel === 'visitor'
                          ? `🪪 ${identityLabel}`
                          : identityLevel === 'fan'
                          ? `⭐ ${identityLabel}`
                          : identityLevel === 'customer'
                          ? `👤 ${identityLabel}`
                          : `💎 ${identityLabel}`}
                      </div>
                      <div style={{ fontSize: 11, color: '#667085', marginTop: 4 }}>
                        {identityDesc}
                      </div>
                    </div>
                    <div
                      style={{
                        background: depositPaid ? '#ECFDF5' : '#FFF7ED',
                        borderRadius: 10,
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ fontSize: 11, color: '#A0A7B3', marginBottom: 4 }}>{t('mine.memberDepositLabel')}</div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 15,
                          color: depositPaid ? '#2CDBCE' : '#FF7A59',
                        }}
                      >
                        {depositPaid ? t('mine.depositPaidFull') : t('mine.depositUnpaidFull')}
                      </div>
                      <div style={{ fontSize: 11, color: '#667085', marginTop: 4 }}>
                        {depositPaid ? `฿${depositAmount}` : t('mine.depositPayHint')}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#C0C7D0', marginTop: 8 }}>
                    {t('mine.identitySystemHint')}
                  </div>
                </div>

                {pointsSub === 'balance' && (
                  <>
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #7B61FF 0%, #2F80FF 100%)',
                        borderRadius: 16,
                        padding: '16px 18px',
                        color: '#fff',
                        marginBottom: 2,
                      }}
                    >
                      <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>{t('mine.growthPoints')}</div>
                      <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>
                        {t('mine.pointsBalance')}
                      </div>
                      <div style={{ fontSize: 34, fontWeight: 800 }}>
                        {pointsSummary.availablePoints.toLocaleString()}
                      </div>
                      {pointsSummary.pendingPoints > 0 && (
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                          {t('mine.pointsPending')} {pointsSummary.pendingPoints}
                        </div>
                      )}
                    </div>
                    <Spin spinning={ledgerLoading}>
                      {ledgerItems.length === 0 && !ledgerLoading ? (
                        <Empty
                          description={t('mine.noLedger')}
                          style={{ padding: '24px 0' }}
                        />
                      ) : (
                        ledgerItems.map((rec: any, i: number) => (
                          <div
                            key={rec.id || i}
                            style={{
                              border: '1px solid #ECF1F6',
                              borderRadius: 14,
                              padding: '12px 14px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                                {rec.reason || rec.ref_type || '--'}
                              </div>
                              <div style={{ color: '#A0A7B3', fontSize: 12 }}>
                                {rec.created_at
                                  ? fmtBKK(rec.created_at)
                                  : '--'}
                              </div>
                            </div>
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: 16,
                                color:
                                  rec.type === 'credit' || rec.type === 'earn'
                                    ? '#2CDBCE'
                                    : '#FF4D4F',
                              }}
                            >
                              {rec.type === 'credit' || rec.type === 'earn' ? '+' : '-'}
                              {Math.abs(rec.points || 0)}
                            </div>
                          </div>
                        ))
                      )}
                    </Spin>
                  </>
                )}
                {pointsSub === 'exchange' && (
                  <Spin spinning={redeemLoading}>
                    {redeemItems.length === 0 && !redeemLoading ? (
                      <Empty description={t('mine.noRedeem')} style={{ padding: '24px 0' }} />
                    ) : (
                      redeemItems.map((rec: any, i: number) => (
                        <div
                          key={rec.id || i}
                          style={{
                            border: '1px solid #ECF1F6',
                            borderRadius: 14,
                            padding: '12px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                              {rec.reason || rec.product_name || '--'}
                            </div>
                            <div style={{ color: '#A0A7B3', fontSize: 12 }}>
                              {rec.created_at
                                ? fmtBKK(rec.created_at)
                                : '--'}
                            </div>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 16, color: '#7B61FF' }}>
                            -{Math.abs(rec.points || 0)}
                          </div>
                        </div>
                      ))
                    )}
                  </Spin>
                )}
                {pointsSub === 'earn' && <EarnGuideCard />}
              </>
            )}

            {/* ─── 订单 tab — 收货地址入口 ────────────────────────────────────── */}
            {mainTab === 'order' && (
              <div
                onClick={() => navigate('/my-addresses')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'linear-gradient(135deg, #EAF2FF 0%, #F0F7FF 100%)',
                  border: '1.5px solid #BAD9FF',
                  borderRadius: 14,
                  padding: '13px 16px',
                  cursor: 'pointer',
                  marginBottom: 2,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 12, background: '#2F80FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <EnvironmentOutlined style={{ fontSize: 18, color: '#fff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1D3860' }}>
                    {language === 'zh' ? '我的收货地址' : language === 'th' ? 'ที่อยู่จัดส่งของฉัน' : 'My Shipping Addresses'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B9DCF', marginTop: 2 }}>
                    {language === 'zh' ? '管理收货地址，兑换实物商品时快速选用' : language === 'th' ? 'จัดการที่อยู่จัดส่ง เพื่อแลกสินค้าจริงได้รวดเร็ว' : 'Manage addresses for fast physical item checkout'}
                  </div>
                </div>
                <RightOutlined style={{ fontSize: 14, color: '#6B9DCF' }} />
              </div>
            )}

            {/* ─── 订单 tab（阶段三：真实接口，当前返回空列表） ───────────────── */}
            {mainTab === 'order' && (
              <Spin spinning={orderLoading}>
                {orderItems.length === 0 && !orderLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#A0A7B3' }}>
                    <ThunderboltOutlined
                      style={{
                        fontSize: 40,
                        color: '#A5C8FF',
                        marginBottom: 12,
                        display: 'block',
                      }}
                    />
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                      {t('mine.noOrderTitle')}
                    </div>
                    <div style={{ fontSize: 12, marginBottom: 8 }}>
                      {t('mine.noOrderHint')}
                    </div>
                    {orderDataNote && (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#C0C7D0',
                          background: '#F7F9FC',
                          borderRadius: 8,
                          padding: '8px 12px',
                          margin: '0 auto',
                          maxWidth: 260,
                          textAlign: 'left',
                          lineHeight: 1.6,
                        }}
                      >
                        🔗 {orderDataNote}
                      </div>
                    )}
                  </div>
                ) : (
                  orderItems.map((order: any, i: number) => (
                    <div
                      key={order.order_id || i}
                      style={{ border: '1px solid #ECF1F6', borderRadius: 14, padding: '14px' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                          {order.site_name || order.site || '--'}
                        </div>
                        <Tag
                          color={order.status === 'completed' ? 'cyan' : 'orange'}
                          style={{ marginLeft: 8 }}
                        >
                          {order.status_display || order.status || '--'}
                        </Tag>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ fontSize: 13, color: '#667085' }}>
                          <ThunderboltOutlined
                            style={{ color: activeMain.color, marginRight: 4 }}
                          />
                          {order.duration || '--'}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#111827' }}>
                          {order.amount || '--'}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#A0A7B3', marginTop: 6 }}>
                        {order.order_id || ''} · {fmtBKK(order.created_at) || ''}
                      </div>
                    </div>
                  ))
                )}
              </Spin>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={borrowModalOpen}
        onOk={() => setBorrowModalOpen(false)}
        onCancel={() => setBorrowModalOpen(false)}
        okText={t('mine.borrowModalOk')}
        cancelButtonProps={{ style: { display: 'none' } }}
        centered
        title={
          <span style={{ color: '#2CDBCE', fontWeight: 700 }}>
            {t('mine.borrowModalTitle')}
          </span>
        }
      >
        <p style={{ color: '#555', lineHeight: 1.7, margin: '12px 0 4px' }}>
          {t('mine.borrowModalDesc')}
        </p>
      </Modal>

      <Modal
        open={physicalGiftModalOpen}
        onOk={() => setPhysicalGiftModalOpen(false)}
        onCancel={() => setPhysicalGiftModalOpen(false)}
        okText={t('mine.physicalGiftModalOk')}
        cancelButtonProps={{ style: { display: 'none' } }}
        centered
        title={
          <span style={{ color: '#7C3AED', fontWeight: 700 }}>
            🎁 {t('mine.physicalGiftModalTitle')}
          </span>
        }
      >
        <p style={{ color: '#555', lineHeight: 1.7, margin: '12px 0 4px' }}>
          {t('mine.physicalGiftModalDesc')}
        </p>
      </Modal>

      <UserBottomNav
        current="mine"
        onHome={() => navigate('/welfare')}
        onAgent={() => navigate('/agent/chat')}
        onMine={() => navigate('/mine')}
      />
    </div>
  )
}
