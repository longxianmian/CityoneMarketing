// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止页面自行 redeem / use 或复活旧 fallback。
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { Spin, App, Modal, Button, Space, Form, Input, Radio, Tag, Divider } from 'antd'
import {
  ArrowLeftOutlined, FireOutlined, ShareAltOutlined, CheckCircleOutlined,
  CarOutlined, EnvironmentOutlined, BoxPlotOutlined, ShopOutlined,
} from '@ant-design/icons'
import { useI18n, type AppLanguage } from '../../i18n'
import OssImage, { useOssUrl } from '../../components/OssImage'
import SharePromoModal from '../../components/SharePromoModal'
import request from '../../api/request'
import { useEffectiveUserId } from '../../hooks/useEffectiveUserId'
import { useFollowGate } from '../../hooks/useFollowGate'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export default function ProductDetailPage() {
  const { message, modal } = App.useApp()
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { language, t } = useI18n()
  const lang = language as AppLanguage
  const couponExchangeMode = searchParams.get('coupon_owned') === '1' && !!searchParams.get('coupon_id')
  const couponId = searchParams.get('coupon_id') || ''
  const couponUserProductId = searchParams.get('up') || ''
  const currentDetailPath = `${location.pathname}${location.search}`
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { guard, checking } = useFollowGate()
  const effectiveUserId = useEffectiveUserId()
  const [shareVisible, setShareVisible] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [redeemSuccess, setRedeemSuccess] = useState(false)
  const [redeemIsPhysical, setRedeemIsPhysical] = useState(false)
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [deliveryMode, setDeliveryMode] = useState<'courier' | 'pickup'>('courier')
  const [deliveryForm] = Form.useForm()
  const [savedAddresses, setSavedAddresses] = useState<any[]>([])
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null)
  const [videoStarted, setVideoStarted] = useState(false)
  const [videoPaused, setVideoPaused] = useState(false)
  const heroVideoRef = useRef<HTMLVideoElement>(null)

  const handleStartVideo = async () => {
    setVideoStarted(true)
    const el = heroVideoRef.current
    if (!el) return
    setVideoPaused(false)
    try {
      await el.play()
    } catch {
      setVideoPaused(true)
    }
  }

  const toggleVideoPlay = async () => {
    const el = heroVideoRef.current
    if (!el) return
    if (el.paused) {
      try {
        await el.play()
        setVideoPaused(false)
      } catch {
        setVideoPaused(true)
      }
      return
    }
    el.pause()
    setVideoPaused(true)
  }

  const ACTION_MAP: Record<string, { text: string; color: string }> = {
    free_claim: { text: t('productDetail.actionFreeClaim'), color: 'linear-gradient(135deg, #52c41a, #73d13d)' },
    points_redeem: { text: t('productDetail.actionPointsRedeem'), color: 'linear-gradient(135deg, #1677ff, #4096ff)' },
    cash_buy: { text: t('productDetail.actionCashBuy'), color: 'linear-gradient(135deg, #fa8c16, #ffc53d)' },
    use_now: { text: t('productDetail.actionUseNow'), color: 'linear-gradient(135deg, #722ed1, #9254de)' },
  }

  useEffect(() => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    ;(request.get(`/growth/mall/items/${id}`) as any)
      .then((res: any) => { setProduct(res.data || res) })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [id])

  const pick = (field: any): string => {
    if (!field) return ''
    if (typeof field === 'string') return field
    if (typeof field === 'object') return field[lang] || field.en || field.zh || field.th || ''
    return ''
  }

  const coverImage = product?.cover_image || ''
  const coverVideo = product?.cover_video || ''
  const resolvedCoverImage = useOssUrl(coverImage || undefined)
  const resolvedCoverVideo = useOssUrl(coverVideo || undefined)
  const videoReady = !!resolvedCoverVideo

  const queueRedeemIntent = (extraFields?: Record<string, any>) => {
    if (!product) return
    setConfirmOpen(false)
    setDeliveryOpen(false)
    guard(
      {
        label: pick(product?.name) || '',
        returnPath: currentDetailPath,
        successPath: couponExchangeMode ? '/mine?tab=benefit' : '/mine?tab=member',
        failPath: currentDetailPath,
        back: couponExchangeMode ? currentDetailPath : '/my-points',
        intentAction: 'redeem_product',
        resourceId: product.id,
        source: {
          ...(couponExchangeMode && { coupon_id: couponId }),
          ...(couponExchangeMode && couponUserProductId ? { user_product_id: couponUserProductId } : {}),
          ...(extraFields || {}),
        },
      }
    )
  }

  // 实物商品：确认配送信息后提交订单
  const doPhysicalRedeem = async () => {
    try {
      const values = await deliveryForm.validateFields()
      const extraFields: Record<string, any> = { delivery_type: deliveryMode }
      if (deliveryMode === 'courier') {
        extraFields.delivery_name    = values.delivery_name
        extraFields.delivery_phone   = values.delivery_phone
        extraFields.delivery_address = values.delivery_address
      } else {
        extraFields.delivery_name    = values.pickup_name
        extraFields.delivery_phone   = values.pickup_phone
        extraFields.delivery_station_id = values.pickup_station || ''
      }
      queueRedeemIntent(extraFields)
    } catch {
      // form validation failed
    }
  }

  // 公共前置检查（fan + 积分），通过后 openModal 回调
  const runPreChecks = async (openModal: () => void) => {
    const userId = effectiveUserId
    const pointsRequired = Number(product.points_required) || 0
    if (!couponExchangeMode && pointsRequired > 0) {
      try {
        const summaryRes: any = await (request.get as any)(`/growth/user/points/summary?user_id=${encodeURIComponent(userId)}`)
        const summaryData = summaryRes?.data || summaryRes
        const available = Number(summaryData?.available_points) || 0
        if (available < pointsRequired) {
          modal.warning({
            title: lang === 'zh' ? '积分不足' : lang === 'th' ? 'คะแนนไม่เพียงพอ' : 'Insufficient Points',
            content: lang === 'zh'
              ? `当前可用积分 ${available} 分，兑换此商品需要 ${pointsRequired} 分，差 ${pointsRequired - available} 分。`
              : lang === 'th'
                ? `คะแนนปัจจุบัน ${available} คะแนน ต้องการ ${pointsRequired} คะแนน ขาด ${pointsRequired - available} คะแนน`
                : `You have ${available} pts but need ${pointsRequired} pts (short by ${pointsRequired - available} pts).`,
            okText: lang === 'zh' ? '知道了' : lang === 'th' ? 'ตกลง' : 'OK',
            centered: true,
          })
          return
        }
      } catch {
        // 查询失败时让后端做最终验证
      }
    }
    openModal()
  }

  // 加载已保存收货地址
  const loadSavedAddresses = async () => {
    try {
      const userId = effectiveUserId
      const res: any = await (request.get as any)(`/growth/user/addresses?user_id=${encodeURIComponent(userId)}`)
      const list = res?.data || res || []
      setSavedAddresses(list)
      // 自动选中默认地址并填入表单
      const def = list.find((a: any) => a.is_default) || list[0] || null
      if (def) {
        setSelectedAddrId(def.id)
        deliveryForm.setFieldsValue({
          delivery_name: def.contact_name,
          delivery_phone: def.contact_phone,
          delivery_address: def.address,
        })
      } else {
        setSelectedAddrId(null)
      }
    } catch {
      setSavedAddresses([])
      setSelectedAddrId(null)
    }
  }

  // 点击按钮入口
  const handleAction = async () => {
    if (!product) return
    if (product.item_type === 'physical') {
      const dt = product.delivery_type || 'courier'
      setDeliveryMode(dt === 'pickup' ? 'pickup' : 'courier')
      deliveryForm.resetFields()
      setSavedAddresses([])
      setSelectedAddrId(null)
      await runPreChecks(async () => {
        await loadSavedAddresses()
        setDeliveryOpen(true)
      })
      return
    }
    await runPreChecks(() => setConfirmOpen(true))
  }

  // ── 兑换成功页 ──────────────────────────────────────────────────────────────
  if (redeemSuccess && product) {
    const title = pick(product.name)
    const pointsSpent = couponExchangeMode ? 0 : (product.points_required || 0)
    const successColor = redeemIsPhysical ? 'linear-gradient(180deg, #fa8c16 0%, #ffc53d 100%)' : 'linear-gradient(180deg, #1677ff 0%, #69b1ff 100%)'
    const successIcon = redeemIsPhysical ? <BoxPlotOutlined style={{ fontSize: 64, color: '#fa8c16', marginBottom: 16 }} /> : <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
    const successTitle = redeemIsPhysical
      ? (lang === 'zh' ? '订单已提交！' : lang === 'th' ? 'สั่งซื้อสำเร็จ!' : 'Order Placed!')
      : couponExchangeMode
        ? (lang === 'zh' ? '用券成功！' : lang === 'th' ? 'ใช้คูปองสำเร็จ!' : 'Coupon Applied!')
        : (lang === 'zh' ? '兑换成功！' : lang === 'th' ? 'แลกสำเร็จ!' : 'Redeemed!')
    const successDesc = redeemIsPhysical
      ? (lang === 'zh' ? '实物商品订单已提交，我们将尽快审核并安排配送，请留意站内通知。' : lang === 'th' ? 'คำสั่งสินค้าจริงถูกส่งแล้ว เราจะรีวิวและจัดส่งโดยเร็ว โปรดตรวจสอบการแจ้งเตือน' : 'Your physical order has been submitted. We\'ll process and ship it soon.')
      : couponExchangeMode
        ? (lang === 'zh' ? '该商品已按卡券权益兑换成功。' : lang === 'th' ? 'สินค้านี้ถูกใช้สิทธิ์จากคูปองเรียบร้อยแล้ว' : 'This item has been redeemed through your coupon benefit.')
        : (lang === 'zh' ? '数字商品已成功兑换，即时发放到账户。' : lang === 'th' ? 'สินค้าดิจิทัลแลกสำเร็จแล้ว ส่งไปยังบัญชีของคุณทันที' : 'Your digital item has been redeemed and delivered to your account.')
    return (
      <div style={{ minHeight: '100vh', background: successColor, padding: '24px 16px' }}>
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '32px 20px', textAlign: 'center' }}>
            {successIcon}
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{successTitle}</div>
            <div style={{ fontSize: 14, color: '#888', lineHeight: 1.8, marginBottom: 20 }}>{successDesc}</div>
            <div style={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 100%)', border: '1px solid #adc6ff', borderRadius: 14, padding: '16px', marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#333', marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 13, color: '#1677ff' }}>
                {couponExchangeMode
                  ? (lang === 'zh' ? '已使用绑定卡券兑换' : lang === 'th' ? 'ใช้คูปองที่ผูกไว้ในการแลก' : 'Redeemed with linked coupon')
                  : (lang === 'zh' ? `消耗 ${pointsSpent} 积分` : lang === 'th' ? `ใช้ ${pointsSpent} คะแนน` : `${pointsSpent} pts spent`)}
              </div>
            </div>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" size="large" block onClick={() => nav('/welfare')}>
                { lang === 'zh' ? '返回福利中心' : lang === 'th' ? 'กลับศูนย์สิทธิ์' : 'Back to Benefits' }
              </Button>
              <Button size="large" block onClick={() => nav(couponExchangeMode ? '/mine?tab=benefit' : '/mine?tab=member')}>
                { couponExchangeMode
                  ? (lang === 'zh' ? '查看我的权益' : lang === 'th' ? 'ดูสิทธิ์ของฉัน' : 'My Benefits')
                  : (lang === 'zh' ? '查看我的积分' : lang === 'th' ? 'ดูคะแนนของฉัน' : 'My Points') }
              </Button>
            </Space>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Spin size="large" />
    </div>
  )

  if (!product) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🔍</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{lang === 'zh' ? '商品不存在' : lang === 'th' ? 'ไม่พบสินค้า' : 'Item not found'}</div>
      <button onClick={() => nav('/welfare')} style={{ padding: '10px 24px', borderRadius: 24, background: '#1677ff', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15 }}>
        {lang === 'zh' ? '返回福利中心' : lang === 'th' ? 'กลับสู่ศูนย์สิทธิ์' : 'Back to Benefits'}
      </button>
    </div>
  )

  // 字段映射：后端 snake_case → 展示，兼容 {zh,th,en} 对象或字符串数组
  const pickStrings = (field: any): string[] => {
    if (!field) return []
    if (typeof field === 'object' && !Array.isArray(field)) {
      const str = field[lang] || field.en || field.zh || field.th || ''
      return str.split('\n').filter(Boolean)
    }
    if (Array.isArray(field)) {
      return field.map((item: any) =>
        (item && typeof item === 'object') ? (item[lang] || item.en || item.zh || item.th || '') : String(item || '')
      ).filter(Boolean)
    }
    return []
  }
  const title = pick(product.name) || t('productDetail.pageTitle')
  const subTitle = pick(product.description) || ''
  const highlights = pickStrings(product.highlights)
  const rules = pickStrings(product.rules)
  const benefitContent = highlights.join('\n')
  const usageRules = rules.join('\n')
  const redeemNotice = ''
  const pointsPrice = couponExchangeMode ? 0 : (product.points_required || 0)
  const cashPrice = (product.exchange_mode === 'mix' && product.price_thb) ? product.price_thb : 0
  const isPhysical = product.item_type === 'physical'
  const deliveryType = product.delivery_type || 'courier'
  const stock = product.stock != null ? Number(product.stock) : -1
  const isOutOfStock = stock === 0
  const stockLabel = stock === -1
    ? null
    : stock === 0
      ? (lang === 'zh' ? '已售罄' : lang === 'th' ? 'สินค้าหมด' : 'Out of Stock')
      : (lang === 'zh' ? `剩余 ${stock} 件` : lang === 'th' ? `เหลือ ${stock} ชิ้น` : `${stock} left`)
  const deliveryLabel = isPhysical
    ? (deliveryType === 'courier'
        ? (lang === 'zh' ? '快递配送' : lang === 'th' ? 'จัดส่งพัสดุ' : 'Courier Delivery')
        : deliveryType === 'pickup'
          ? (lang === 'zh' ? '站点自取' : lang === 'th' ? 'รับที่สาขา' : 'Station Pickup')
          : (lang === 'zh' ? '快递/自取均可' : lang === 'th' ? 'จัดส่ง/รับเอง' : 'Delivery or Pickup'))
    : null
  const actionType = isOutOfStock ? 'out_of_stock' : isPhysical ? 'physical_redeem' : pointsPrice > 0 ? 'points_redeem' : 'free_claim'
  const actionText = isOutOfStock
    ? (lang === 'zh' ? '已售罄' : lang === 'th' ? 'สินค้าหมด' : 'Out of Stock')
    : couponExchangeMode
      ? (lang === 'zh' ? '立即用券兑换' : lang === 'th' ? 'ใช้คูปองแลกทันที' : 'Redeem with Coupon')
    : isPhysical
      ? (lang === 'zh' ? '立即兑换' : lang === 'th' ? 'แลกเดี๋ยวนี้' : 'Redeem Now')
      : ACTION_MAP[actionType]?.text || t('productDetail.actionFreeClaim')
  const actionColor = isOutOfStock
    ? 'linear-gradient(135deg, #bbb, #d9d9d9)'
    : isPhysical
      ? 'linear-gradient(135deg, #fa8c16, #ffc53d)'
      : (ACTION_MAP[actionType]?.color || ACTION_MAP.free_claim.color)
  const linkedActivities: any[] = product.linkedActivities || []

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f5f5f5' }}>
      <div style={{ flexShrink: 0, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, borderBottom: '1px solid #f0f0f0' }}>
        <button onClick={() => { const b = (location.state as any)?.backTo; b ? nav(b) : location.key !== 'default' ? nav(-1) : nav('/welfare') }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, marginRight: 8, display: 'flex', alignItems: 'center', color: '#333' }}>
          <ArrowLeftOutlined style={{ fontSize: 20 }} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 16, flex: 1 }}>{t('productDetail.pageTitle')}</span>
        <button
          onClick={() => setShareVisible(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', color: '#52c41a' }}
        >
          <ShareAltOutlined style={{ fontSize: 20 }} />
        </button>
      </div>

      <SharePromoModal
        open={shareVisible}
        onClose={() => setShareVisible(false)}
        type="product"
        id={id!}
        name={title}
        campaignId={product?.campaign_id}
      />

      <div style={{ flexShrink: 0, width: '100%', aspectRatio: '16/9', background: '#f0f0f0', overflow: 'hidden', position: 'relative' } as React.CSSProperties}>
        {videoReady && (
          <video
            ref={heroVideoRef}
            src={resolvedCoverVideo}
            loop
            playsInline
            preload="metadata"
            poster={resolvedCoverImage || undefined}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                     visibility: videoStarted ? 'visible' : 'hidden' } as React.CSSProperties}
            onClick={toggleVideoPlay}
            onPlay={() => setVideoPaused(false)}
            onPause={() => setVideoPaused(videoStarted)}
          />
        )}
        {videoStarted && videoPaused && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, color: '#fff', lineHeight: 1, marginLeft: 2 }}>▶</span>
            </div>
          </div>
        )}
        {!videoStarted && (
          coverImage ? (
            <div style={{ position: 'absolute', inset: 0, cursor: videoReady ? 'pointer' : 'default' }}
                 onClick={videoReady ? handleStartVideo : undefined}>
              <OssImage src={coverImage} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} placeholderStyle={{ width: '100%', height: '100%' }} />
              {videoReady && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.12)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 16, color: '#fff', lineHeight: 1, marginLeft: 3 }}>▶</span>
                  </div>
                </div>
              )}
            </div>
          ) : videoReady ? (
            <div style={{ position: 'absolute', inset: 0, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                 onClick={handleStartVideo}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, color: '#fff', lineHeight: 1, marginLeft: 3 }}>▶</span>
              </div>
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #52c41a20, #52c41a40)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 64 }}>🎫</span>
            </div>
          )
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>{title}</h1>
          {subTitle && <p style={{ fontSize: 14, color: '#666', margin: 0 }}>{subTitle}</p>}
        </div>

        {(pointsPrice > 0 || cashPrice > 0) && (
          <ProdSection title={t('productDetail.sectionPrice')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'baseline' }}>
                {pointsPrice > 0 && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>{pointsPrice}</span>
                    <span style={{ fontSize: 13, color: '#1677ff' }}>{t('productDetail.pts')}</span>
                  </div>
                )}
                {cashPrice > 0 && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 14, color: '#fa8c16' }}>฿</span>
                    <span style={{ fontSize: 28, fontWeight: 700, color: '#fa8c16' }}>{cashPrice}</span>
                  </div>
                )}
                {pointsPrice === 0 && cashPrice === 0 && (
                  <span style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>{t('productDetail.free')}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {stockLabel && (
                  <Tag color={isOutOfStock ? 'default' : 'orange'} style={{ fontSize: 12, margin: 0 }}>{stockLabel}</Tag>
                )}
                {deliveryLabel && (
                  <Tag color="blue" icon={deliveryType === 'pickup' ? <ShopOutlined /> : <CarOutlined />} style={{ fontSize: 12, margin: 0 }}>
                    {deliveryLabel}
                  </Tag>
                )}
              </div>
            </div>
          </ProdSection>
        )}

        {couponExchangeMode && (
          <ProdSection title={lang === 'zh' ? '兑换方式' : lang === 'th' ? 'วิธีใช้งาน' : 'Redemption Method'}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#722ed1' }}>
              {lang === 'zh' ? '已绑定卡券兑换' : lang === 'th' ? 'แลกด้วยคูปองที่ผูกไว้' : 'Redeem with Linked Coupon'}
            </span>
          </ProdSection>
        )}

        {!couponExchangeMode && pointsPrice === 0 && cashPrice === 0 && (
          <ProdSection title={t('productDetail.sectionGetMethod')}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#52c41a' }}>{t('productDetail.freeClaim')}</span>
          </ProdSection>
        )}

        {benefitContent && (
          <ProdSection title={t('productDetail.sectionBenefit')}>
            {benefitContent.split(/\n/).filter(Boolean).map((line: string, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <FireOutlined style={{ color: '#fa8c16', flexShrink: 0, marginTop: 3 }} />
                <span style={{ fontSize: 14, color: '#444', lineHeight: 1.7 }}>{line.trim()}</span>
              </div>
            ))}
          </ProdSection>
        )}

        {usageRules && (
          <ProdSection title={t('productDetail.sectionRules')}>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.8, margin: 0 }}>{usageRules}</p>
          </ProdSection>
        )}

        {redeemNotice && (
          <ProdSection title={t('productDetail.sectionRedeemNotice')}>
            <p style={{ fontSize: 13, color: '#999', lineHeight: 1.8, margin: 0 }}>{redeemNotice}</p>
          </ProdSection>
        )}

        {linkedActivities.length > 0 && (
          <ProdSection title={t('productDetail.sectionLinkedActivities')}>
            {linkedActivities.map((a: any) => (
              <div
                key={a.id}
                onClick={() => nav(`/activity/${a.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: '#f8f8f8', marginBottom: 8, cursor: 'pointer', border: '1px solid #ebebeb' }}
              >
                <span style={{ fontSize: 22 }}>🎯</span>
                <span style={{ flex: 1, fontSize: 14, color: '#333' }}>{pick(a.title) || a.name}</span>
                <span style={{ color: '#bbb', fontSize: 18 }}>›</span>
              </div>
            ))}
          </ProdSection>
        )}
      </div>
      </div>

      <div style={{ flexShrink: 0, padding: '12px 16px 24px', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
        <button
          onClick={isOutOfStock ? undefined : handleAction}
          disabled={checking || isOutOfStock}
          style={{ width: '100%', padding: '14px 0', background: (checking || isOutOfStock) ? '#d9d9d9' : actionColor, border: 'none', borderRadius: 50, color: '#fff', fontSize: 17, fontWeight: 700, cursor: (checking || isOutOfStock) ? 'default' : 'pointer', boxShadow: (checking || isOutOfStock) ? 'none' : '0 4px 16px rgba(0,0,0,0.2)', letterSpacing: 0.5, transition: 'all 0.2s' }}
        >
          {checking
            ? (lang === 'zh' ? '验证中...' : lang === 'th' ? 'กำลังตรวจสอบ...' : 'Checking...')
            : actionText}
        </button>
      </div>

      {/* 确认兑换弹窗（数字商品） */}
      <Modal
        title={couponExchangeMode
          ? (lang === 'zh' ? '确认用券兑换' : lang === 'th' ? 'ยืนยันการใช้คูปองแลก' : 'Confirm Coupon Redemption')
          : (lang === 'zh' ? '确认积分兑换' : lang === 'th' ? 'ยืนยันการแลกคะแนน' : 'Confirm Redemption')}
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={() => queueRedeemIntent()}
        okText={lang === 'zh' ? '确认兑换' : lang === 'th' ? 'ยืนยัน' : 'Confirm'}
        cancelText={lang === 'zh' ? '取消' : lang === 'th' ? 'ยกเลิก' : 'Cancel'}
        confirmLoading={checking}
      >
        <div style={{ display: 'grid', gap: 12, lineHeight: 1.8, padding: '8px 0' }}>
          <div>
            <strong>{lang === 'zh' ? '商品名称：' : lang === 'th' ? 'สินค้า: ' : 'Item: '}</strong>
            {pick(product?.name)}
          </div>
          {!couponExchangeMode && (product?.points_required || 0) > 0 && (
            <div>
              <strong>{lang === 'zh' ? '所需积分：' : lang === 'th' ? 'คะแนนที่ใช้: ' : 'Points: '}</strong>
              {product.points_required} {lang === 'zh' ? '积分' : lang === 'th' ? 'คะแนน' : 'pts'}
            </div>
          )}
          <div style={{ fontSize: 13, color: '#888', background: '#f5f5f5', borderRadius: 8, padding: '10px 12px' }}>
            {couponExchangeMode
              ? (lang === 'zh' ? '确认后将直接消耗这张已拥有卡券，并完成商品兑换。' : lang === 'th' ? 'หลังยืนยัน ระบบจะใช้คูปองใบนี้และแลกสินค้าให้ทันที' : 'Confirming will consume this owned coupon and complete the linked item redemption.')
              : (lang === 'zh' ? '确认兑换后积分立即扣除，数字商品即时到账。' : lang === 'th' ? 'หลังยืนยัน คะแนนจะถูกหักทันที สินค้าดิจิทัลส่งถึงบัญชีทันที' : 'Points will be deducted immediately and the digital item delivered instantly.')}
          </div>
        </div>
      </Modal>

      {/* 实物商品配送弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EnvironmentOutlined style={{ color: '#fa8c16' }} />
            <span>{lang === 'zh' ? '填写配送信息' : lang === 'th' ? 'ข้อมูลการจัดส่ง' : 'Delivery Info'}</span>
          </div>
        }
        open={deliveryOpen}
        onCancel={() => !checking && setDeliveryOpen(false)}
        onOk={doPhysicalRedeem}
        okText={lang === 'zh' ? '确认下单' : lang === 'th' ? 'ยืนยันการสั่งซื้อ' : 'Place Order'}
        cancelText={lang === 'zh' ? '取消' : lang === 'th' ? 'ยกเลิก' : 'Cancel'}
        confirmLoading={checking}
        destroyOnHidden
      >
        <div style={{ paddingTop: 8 }}>
          {/* 消耗积分提示 */}
          <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#d46b08' }}>
            {couponExchangeMode
              ? (lang === 'zh'
                  ? '本次将直接消耗这张已拥有卡券，不再扣减积分'
                  : lang === 'th'
                    ? 'ครั้งนี้จะใช้คูปองใบนี้โดยตรง และจะไม่หักคะแนน'
                    : 'This action will consume the owned coupon directly and will not deduct points.')
              : (lang === 'zh'
                  ? `兑换将消耗 ${product?.points_required || 0} 积分，确认后立即扣除`
                  : lang === 'th'
                    ? `การแลกจะใช้ ${product?.points_required || 0} คะแนน หักทันทีหลังยืนยัน`
                    : `Redeeming will use ${product?.points_required || 0} pts, deducted immediately`)}
          </div>

          {/* 已保存地址选择区（快递模式） */}
          {deliveryMode !== 'pickup' && savedAddresses.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 8 }}>
                {lang === 'zh' ? '选择已保存的地址' : lang === 'th' ? 'เลือกที่อยู่ที่บันทึกไว้' : 'Select a saved address'}
              </div>
              <div style={{ display: 'grid', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                {savedAddresses.map((addr: any) => (
                  <div
                    key={addr.id}
                    onClick={() => {
                      setSelectedAddrId(addr.id)
                      deliveryForm.setFieldsValue({
                        delivery_name: addr.contact_name,
                        delivery_phone: addr.contact_phone,
                        delivery_address: addr.address,
                      })
                    }}
                    style={{
                      border: selectedAddrId === addr.id ? '2px solid #fa8c16' : '1.5px solid #e8e8e8',
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      background: selectedAddrId === addr.id ? '#fff7e6' : '#fafafa',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{addr.contact_name}</span>
                      <span style={{ fontSize: 12, color: '#888' }}>{addr.contact_phone}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>{addr.address}</div>
                    {addr.is_default && <span style={{ fontSize: 11, color: '#fa8c16', fontWeight: 600 }}>
                      {lang === 'zh' ? '默认' : lang === 'th' ? 'ค่าเริ่มต้น' : 'Default'}
                    </span>}
                  </div>
                ))}
              </div>
              <Divider style={{ margin: '12px 0 8px' }}>
                <span style={{ fontSize: 12, color: '#bbb' }}>
                  {lang === 'zh' ? '或手动填写' : lang === 'th' ? 'หรือกรอกเอง' : 'or enter manually'}
                </span>
              </Divider>
            </div>
          )}

          {/* 配送方式选择（both 时显示） */}
          {deliveryType === 'both' && (
            <>
              <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14 }}>
                {lang === 'zh' ? '选择配送方式' : lang === 'th' ? 'เลือกวิธีจัดส่ง' : 'Delivery Method'}
              </div>
              <Radio.Group
                value={deliveryMode}
                onChange={e => { setDeliveryMode(e.target.value); deliveryForm.resetFields(); setSelectedAddrId(null) }}
                style={{ width: '100%', marginBottom: 16 }}
              >
                <Radio.Button value="courier" style={{ width: '50%', textAlign: 'center' }}>
                  <CarOutlined /> {lang === 'zh' ? '快递' : lang === 'th' ? 'พัสดุ' : 'Courier'}
                </Radio.Button>
                <Radio.Button value="pickup" style={{ width: '50%', textAlign: 'center' }}>
                  <ShopOutlined /> {lang === 'zh' ? '自取' : lang === 'th' ? 'รับเอง' : 'Pickup'}
                </Radio.Button>
              </Radio.Group>
              <Divider style={{ margin: '0 0 16px' }} />
            </>
          )}

          <Form form={deliveryForm} layout="vertical" size="middle">
            {(deliveryMode === 'courier' || (deliveryType !== 'pickup')) && deliveryMode !== 'pickup' ? (
              <>
                <Form.Item
                  name="delivery_name"
                  label={lang === 'zh' ? '收货人姓名' : lang === 'th' ? 'ชื่อผู้รับ' : 'Recipient Name'}
                  rules={[{ required: true, message: lang === 'zh' ? '请填写收货人姓名' : 'Required' }]}
                >
                  <Input placeholder={lang === 'zh' ? '请输入姓名' : lang === 'th' ? 'กรอกชื่อผู้รับ' : 'Full name'} />
                </Form.Item>
                <Form.Item
                  name="delivery_phone"
                  label={lang === 'zh' ? '手机号码' : lang === 'th' ? 'เบอร์โทรศัพท์' : 'Phone'}
                  rules={[{ required: true, message: lang === 'zh' ? '请填写手机号' : 'Required' }]}
                >
                  <Input placeholder={lang === 'zh' ? '请输入手机号' : lang === 'th' ? 'กรอกเบอร์โทร' : 'Phone number'} />
                </Form.Item>
                <Form.Item
                  name="delivery_address"
                  label={lang === 'zh' ? '收货地址' : lang === 'th' ? 'ที่อยู่จัดส่ง' : 'Delivery Address'}
                  rules={[{ required: true, message: lang === 'zh' ? '请填写收货地址' : 'Required' }]}
                >
                  <Input.TextArea rows={3} placeholder={lang === 'zh' ? '请填写详细地址（省市区街道门牌号）' : lang === 'th' ? 'กรอกที่อยู่จัดส่งแบบละเอียด' : 'Full shipping address including city, district, street'} />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item
                  name="pickup_name"
                  label={lang === 'zh' ? '取货人姓名' : lang === 'th' ? 'ชื่อผู้รับ' : 'Pickup Name'}
                  rules={[{ required: true, message: lang === 'zh' ? '请填写取货人姓名' : 'Required' }]}
                >
                  <Input placeholder={lang === 'zh' ? '请输入姓名' : lang === 'th' ? 'กรอกชื่อ' : 'Full name'} />
                </Form.Item>
                <Form.Item
                  name="pickup_phone"
                  label={lang === 'zh' ? '联系手机' : lang === 'th' ? 'เบอร์โทร' : 'Phone'}
                  rules={[{ required: true, message: lang === 'zh' ? '请填写手机号' : 'Required' }]}
                >
                  <Input placeholder={lang === 'zh' ? '请输入手机号' : lang === 'th' ? 'กรอกเบอร์โทร' : 'Phone number'} />
                </Form.Item>
                <div style={{ fontSize: 13, color: '#888', background: '#f5f5f5', borderRadius: 8, padding: '10px 14px' }}>
                  <ShopOutlined style={{ marginRight: 6, color: '#1677ff' }} />
                  {lang === 'zh' ? '工作人员会联系您确认取货站点及时间，请保持手机畅通。' : lang === 'th' ? 'เจ้าหน้าที่จะติดต่อคุณเพื่อยืนยันจุดรับสินค้า' : 'Our team will contact you to confirm the pickup station and schedule.'}
                </div>
              </>
            )}
          </Form>
        </div>
      </Modal>
    </div>
  )
}

function ProdSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 12, borderLeft: '3px solid #52c41a', paddingLeft: 10 }}>{title}</h3>
      {children}
    </div>
  )
}
