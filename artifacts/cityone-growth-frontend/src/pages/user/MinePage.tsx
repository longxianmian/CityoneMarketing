import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Tag, Badge, Avatar, Spin, Empty, Modal } from 'antd'
import {
  CreditCardOutlined,
  StarOutlined,
  OrderedListOutlined,
  CrownOutlined,
  ThunderboltOutlined,
  DownOutlined,
  GiftOutlined,
} from '@ant-design/icons'
import { useI18n, type AppLanguage, pickLocalizedText } from '../../i18n'
import UserBottomNav from '../../components/user/UserBottomNav'
import UserPageHeader from '../../components/user/UserPageHeader'
import useLineUserStore from '../../store/lineUser'
import { getUserPointsSummary, getUserPointsLedger, getUserPointsRedeems } from '../../api/growth'

type AppLang = AppLanguage
type LocalizedField = Partial<Record<AppLang, string>>

const mockProfile = {
  lineName: 'CityOne LINE User',
  memberLevel: {
    zh: '黄金会员',
    th: 'สมาชิกระดับโกลด์',
    en: 'Gold Member',
  } as LocalizedField,
  avatarUrl: '',
}

const couponList = [
  {
    id: '1',
    title: { zh: '关注 LINE 领 15 分钟券', th: 'ติดตาม LINE รับคูปอง 15 นาที', en: 'Follow LINE 15-min coupon' } as LocalizedField,
    valueText: { zh: '15分钟免费时长', th: 'เวลาฟรี 15 นาที', en: '15 minutes free' } as LocalizedField,
    expireText: { zh: '2026-04-07 到期', th: 'หมดอายุ 2026-04-07', en: 'Expires 2026-04-07' } as LocalizedField,
    status: 'available',
  },
  {
    id: '2',
    title: { zh: '首借免单券', th: 'คูปองยืมครั้งแรกฟรี', en: 'First borrow free coupon' } as LocalizedField,
    valueText: { zh: '首单免单', th: 'ฟรีออเดอร์แรก', en: 'First order free' } as LocalizedField,
    expireText: { zh: '2026-04-03 到期', th: 'หมดอายุ 2026-04-03', en: 'Expires 2026-04-03' } as LocalizedField,
    status: 'available',
  },
  {
    id: '3',
    title: { zh: '好友邀请奖励券', th: 'คูปองรางวัลชวนเพื่อน', en: 'Referral reward coupon' } as LocalizedField,
    valueText: { zh: '30分钟免费时长', th: 'เวลาฟรี 30 นาที', en: '30 minutes free' } as LocalizedField,
    expireText: { zh: '2026-03-20 到期', th: 'หมดอายุ 2026-03-20', en: 'Expires 2026-03-20' } as LocalizedField,
    status: 'used',
  },
  {
    id: '4',
    title: { zh: '节日限定优惠券', th: 'คูปองวันหยุดพิเศษ', en: 'Holiday special coupon' } as LocalizedField,
    valueText: { zh: '50分钟免费时长', th: 'เวลาฟรี 50 นาที', en: '50 minutes free' } as LocalizedField,
    expireText: { zh: '2026-01-10 到期', th: 'หมดอายุ 2026-01-10', en: 'Expires 2026-01-10' } as LocalizedField,
    status: 'expired',
  },
]

const pointsLedger = [
  { id: '1', type: 'balance', title: { zh: '参与活动奖励', th: 'รางวัลกิจกรรม', en: 'Activity reward' } as LocalizedField, points: '+100', time: '2026-03-31 10:00' },
  { id: '2', type: 'balance', title: { zh: '邀请好友奖励', th: 'รางวัลชวนเพื่อน', en: 'Referral reward' } as LocalizedField, points: '+50', time: '2026-03-30 18:20' },
  { id: '3', type: 'balance', title: { zh: '完成任务奖励', th: 'รางวัลงาน', en: 'Task completion reward' } as LocalizedField, points: '+30', time: '2026-03-28 09:10' },
]

const exchangeRecords = [
  { id: '1', title: { zh: '兑换 15 分钟券', th: 'แลกคูปอง 15 นาที', en: 'Exchanged 15-min coupon' } as LocalizedField, points: '-200', time: '2026-03-29 14:15' },
  { id: '2', title: { zh: '兑换电子书权益', th: 'แลกสิทธิ์อีบุ๊ก', en: 'Exchanged e-book benefit' } as LocalizedField, points: '-500', time: '2026-03-22 11:30' },
]

const earnRecords = [
  { id: '1', title: { zh: '关注 LINE OA 奖励', th: 'รางวัลติดตาม LINE OA', en: 'Follow LINE OA reward' } as LocalizedField, points: '+200', time: '2026-03-25 08:00' },
  { id: '2', title: { zh: '首次借充电宝', th: 'ยืมพาวเวอร์แบงก์ครั้งแรก', en: 'First borrow reward' } as LocalizedField, points: '+150', time: '2026-03-20 15:45' },
]

const orderRecords = [
  {
    id: 'ORD-001',
    site: { zh: '曼谷中央世界', th: 'เซ็นทรัลเวิลด์', en: 'CentralWorld Bangkok' } as LocalizedField,
    duration: { zh: '45 分钟', th: '45 นาที', en: '45 minutes' } as LocalizedField,
    amount: 'THB 15.00',
    status: { zh: '已完成', th: 'เสร็จสิ้น', en: 'Completed' } as LocalizedField,
    statusColor: '#2CDBCE',
    time: '2026-03-30 20:15',
  },
  {
    id: 'ORD-002',
    site: { zh: '终端 21 商场', th: 'เทอร์มินัล 21', en: 'Terminal 21' } as LocalizedField,
    duration: { zh: '120 分钟', th: '120 นาที', en: '120 minutes' } as LocalizedField,
    amount: 'THB 40.00',
    status: { zh: '已完成', th: 'เสร็จสิ้น', en: 'Completed' } as LocalizedField,
    statusColor: '#2CDBCE',
    time: '2026-03-28 14:20',
  },
  {
    id: 'ORD-003',
    site: { zh: '尚泰百货', th: 'เซ็นทรัล', en: 'Central Dept. Store' } as LocalizedField,
    duration: { zh: '15 分钟（免单券）', th: '15 นาที (ฟรีคูปอง)', en: '15 min (free coupon)' } as LocalizedField,
    amount: 'THB 0.00',
    status: { zh: '卡券抵扣', th: 'หักด้วยคูปอง', en: 'Coupon offset' } as LocalizedField,
    statusColor: '#FF7A59',
    time: '2026-03-25 11:05',
  },
]

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
      {/* 横条标题行（可点击） */}
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

      {/* 展开内容 */}
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

export default function MinePage() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const { profile } = useLineUserStore()

  const lineDisplayName = profile?.lineDisplayName || mockProfile.lineName
  const linePictureUrl = profile?.linePictureUrl || mockProfile.avatarUrl
  const couponAvailableCount = profile?.couponCount ?? couponList.filter((c) => c.status === 'available').length
  const depositAmount = profile?.deposit ?? 0

  const [mainTab, setMainTab] = useState<MainTab>('benefit')
  const [couponSub, setCouponSub] = useState<CouponSubTab>('available')
  const [pointsSub, setPointsSub] = useState<PointsSubTab>('balance')

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

  useEffect(() => {
    const load = async () => {
      try {
        const res: any = await getUserPointsSummary(
          profile?.lineUserId ? { line_user_id: profile.lineUserId } : undefined
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
  }, [profile?.lineUserId])

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true)
    try {
      const res: any = await getUserPointsLedger({
        line_user_id: profile?.lineUserId,
        page: 1,
        page_size: 20,
      })
      setLedgerItems(res?.data?.items || [])
    } catch (e) {}
    setLedgerLoading(false)
  }, [profile?.lineUserId])

  const loadRedeems = useCallback(async () => {
    setRedeemLoading(true)
    try {
      const res: any = await getUserPointsRedeems({
        line_user_id: profile?.lineUserId,
        page: 1,
        page_size: 20,
      })
      setRedeemItems(res?.data?.items || [])
    } catch (e) {}
    setRedeemLoading(false)
  }, [profile?.lineUserId])

  useEffect(() => {
    if (mainTab === 'points') {
      if (pointsSub === 'balance') loadLedger()
      else if (pointsSub === 'exchange') loadRedeems()
    }
  }, [mainTab, pointsSub])

  const memberLevel = profile?.memberLevel
    ? profile.memberLevel
    : pickLocalizedText({ level: mockProfile.memberLevel }, 'level', language)

  const mainTabConfig: { key: MainTab; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
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

  const filteredCoupons = couponList.filter((c) => c.status === couponSub)

  const couponStatusLabel: Record<CouponSubTab, { color: string; text: string }> = {
    available: { color: 'cyan', text: t('mine.couponStatusAvailable') },
    used: { color: 'default', text: t('mine.couponStatusUsed') },
    expired: { color: 'red', text: t('mine.couponStatusExpired') },
  }

  const mineTitle = t('mine.pageTitle')

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
              style={{ backgroundColor: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 28, fontWeight: 800 }}
            >
              {lineDisplayName.slice(0, 1).toUpperCase()}
            </Avatar>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, opacity: 0.92, marginBottom: 4 }}>LINE</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{lineDisplayName}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', padding: '5px 10px', borderRadius: 999 }}>
                <CrownOutlined />
                <span style={{ fontWeight: 700 }}>{memberLevel}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              {
                label: t('mine.colCoupons'),
                value: couponAvailableCount,
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
              <div key={i} style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 14, padding: '10px 10px 12px', backdropFilter: 'blur(6px)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, opacity: 0.88, marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                  {item.unit && <span style={{ fontSize: 13, fontWeight: 600, marginRight: 1 }}>{item.unit}</span>}
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 常用功能：3 横置主 tab */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 12 }}>{t('mine.menuTitle')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            {mainTabConfig.map((tab) => {
              const active = mainTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setMainTab(tab.key)}
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
                  <span style={{ fontSize: 13, fontWeight: 700, color: active ? tab.color : '#374151' }}>
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
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px', color: '#374151', fontWeight: 700, fontSize: 14 }}>
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
                  {sub.key === 'available' && (
                    <Badge
                      count={couponList.filter((c) => c.status === 'available').length}
                      size="small"
                      style={{ marginLeft: 4, backgroundColor: couponSub === 'available' ? 'rgba(255,255,255,0.4)' : activeMain.color }}
                    />
                  )}
                </button>
              ))}
            {mainTab === 'order' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px', color: '#374151', fontWeight: 700, fontSize: 14 }}>
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

            {/* 奖品内容 */}
            {mainTab === 'prize' && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#A0A7B3' }}>
                <GiftOutlined style={{ fontSize: 40, color: '#FFB49E', marginBottom: 12, display: 'block' }} />
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{t('mine.noPrize')}</div>
                <div style={{ fontSize: 12 }}>{t('mine.noPrizeHint')}</div>
              </div>
            )}

            {/* 权益内容（原卡券）*/}
            {mainTab === 'benefit' && (
              <>
                {filteredCoupons.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#A0A7B3', fontSize: 14 }}>
                    {t('mine.noCoupons')}
                  </div>
                ) : (
                  filteredCoupons.map((item) => (
                    <div
                      key={item.id}
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
                          <Tag color={couponStatusLabel[couponSub].color}>
                            {couponStatusLabel[couponSub].text}
                          </Tag>
                        </div>
                        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
                          {pickLocalizedText({ title: item.title }, 'title', language)}
                        </div>
                        <div style={{ color: '#FF7A59', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                          {pickLocalizedText({ valueText: item.valueText }, 'valueText', language)}
                        </div>
                        <div style={{ color: '#A0A7B3', fontSize: 12 }}>
                          {pickLocalizedText({ expireText: item.expireText }, 'expireText', language)}
                        </div>
                      </div>
                      {couponSub === 'available' && (
                        <button
                          onClick={() => {
                            // TODO: 对接共享充电宝系统后，在此处调用借电 API
                            // e.g. POST /api/borrow/start { couponId: item.id, userId }
                            setBorrowModalOpen(true)
                          }}
                          style={{
                            border: `1.5px solid #2CDBCE`,
                            borderRadius: 20,
                            padding: '6px 14px',
                            background: 'transparent',
                            color: '#2CDBCE',
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('mine.useNowCoupon')}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </>
            )}

            {/* 会员内容（原积分）*/}
            {mainTab === 'member' && (
              <>
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
                        <Empty description={t('mine.noLedger')} style={{ padding: '24px 0' }} />
                      ) : (
                        ledgerItems.map((rec: any, i: number) => (
                          <div
                            key={rec.id || i}
                            style={{ border: '1px solid #ECF1F6', borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                                {rec.reason || rec.ref_type || '--'}
                              </div>
                              <div style={{ color: '#A0A7B3', fontSize: 12 }}>{rec.created_at ? rec.created_at.slice(0, 16).replace('T', ' ') : '--'}</div>
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: (rec.type === 'credit' || rec.type === 'earn') ? '#2CDBCE' : '#FF4D4F' }}>
                              {(rec.type === 'credit' || rec.type === 'earn') ? '+' : '-'}{Math.abs(rec.points || 0)}
                            </div>
                          </div>
                        ))
                      )}
                    </Spin>
                  </>
                )}
                {pointsSub === 'exchange' && (
                  <>
                    <Spin spinning={redeemLoading}>
                      {redeemItems.length === 0 && !redeemLoading ? (
                        <Empty description={t('mine.noRedeem')} style={{ padding: '24px 0' }} />
                      ) : (
                        redeemItems.map((rec: any, i: number) => (
                          <div
                            key={rec.id || i}
                            style={{ border: '1px solid #ECF1F6', borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                                {rec.reason || rec.product_name || '--'}
                              </div>
                              <div style={{ color: '#A0A7B3', fontSize: 12 }}>{rec.created_at ? rec.created_at.slice(0, 16).replace('T', ' ') : '--'}</div>
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: '#7B61FF' }}>
                              -{Math.abs(rec.points || 0)}
                            </div>
                          </div>
                        ))
                      )}
                    </Spin>
                  </>
                )}
                {pointsSub === 'earn' && (
                  <>
                    <EarnGuideCard />
                  </>
                )}
              </>
            )}

            {/* 订单内容 */}
            {mainTab === 'order' && (
              <>
                {orderRecords.map((order) => (
                  <div
                    key={order.id}
                    style={{ border: '1px solid #ECF1F6', borderRadius: 14, padding: '14px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                        {pickLocalizedText({ site: order.site }, 'site', language)}
                      </div>
                      <Tag color={order.statusColor === '#2CDBCE' ? 'cyan' : 'orange'} style={{ marginLeft: 8 }}>
                        {pickLocalizedText({ status: order.status }, 'status', language)}
                      </Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, color: '#667085' }}>
                        <ThunderboltOutlined style={{ color: activeMain.color, marginRight: 4 }} />
                        {pickLocalizedText({ duration: order.duration }, 'duration', language)}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#111827' }}>{order.amount}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#A0A7B3', marginTop: 6 }}>
                      {order.id} · {order.time}
                    </div>
                  </div>
                ))}
              </>
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

      <UserBottomNav
        current="mine"
        onHome={() => navigate('/welfare')}
        onAgent={() => navigate('/agent/chat')}
        onMine={() => navigate('/mine')}
      />
    </div>
  )
}
