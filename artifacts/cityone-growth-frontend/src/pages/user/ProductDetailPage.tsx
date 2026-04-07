import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { Spin, message, Modal, Button, Space } from 'antd'
import { ArrowLeftOutlined, FireOutlined, ShareAltOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useI18n, type AppLanguage } from '../../i18n'
import SharePromoModal from '../../components/SharePromoModal'
import request from '../../api/request'
import { getDeviceUserId } from '../../utils/deviceUserId'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

async function checkFanStatus(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/user/check-follow?user_id=${encodeURIComponent(userId)}`)
    const json = await res.json()
    return json?.data?.is_fan === true
  } catch {
    return false
  }
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { language, t } = useI18n()
  const lang = language as AppLanguage
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [shareVisible, setShareVisible] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [redeemSuccess, setRedeemSuccess] = useState(false)

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

  // 来自 FollowOAPage 回跳：auto=redeem → 自动打开确认弹窗
  useEffect(() => {
    if (searchParams.get('auto') === 'redeem' && product) {
      setConfirmOpen(true)
    }
  }, [product, searchParams.get('auto')])

  // 实际执行兑换（确认后调用）—— 调用真实 API，含余额验证
  const doRedeem = async () => {
    setActing(true)
    try {
      const userId = getDeviceUserId()
      const res: any = await (request.post as any)('/growth/mall/redeem', {
        user_id: userId,
        item_id: product.id,
      })
      const data = res?.data || res
      if (data?.error === 'INSUFFICIENT_POINTS' || res?.code === 400) {
        message.error(lang === 'zh' ? '积分不足，无法兑换' : lang === 'th' ? 'คะแนนไม่เพียงพอ' : 'Insufficient points')
        setConfirmOpen(false)
        return
      }
      setConfirmOpen(false)
      setRedeemSuccess(true)
    } catch (err: any) {
      const msg = err?.response?.data?.msg || err?.message || ''
      if (msg.includes('积分不足') || msg.includes('INSUFFICIENT')) {
        const zh = msg.includes('当前可用') ? msg : '积分不足，无法兑换'
        message.error(lang === 'zh' ? zh : lang === 'th' ? 'คะแนนไม่เพียงพอ' : 'Insufficient points')
      } else {
        message.error(lang === 'zh' ? '兑换失败，请稍后重试' : lang === 'th' ? 'แลกไม่สำเร็จ กรุณาลองใหม่' : 'Redemption failed, please try again')
      }
      setConfirmOpen(false)
    } finally {
      setActing(false)
    }
  }

  // 点击按钮：先检查粉丝身份，再检查积分余额，最后开确认弹窗
  const handleAction = async () => {
    if (!product) return
    if (product.item_type === 'physical') {
      Modal.info({
        title: pick(product.name),
        content: lang === 'zh' ? '实物商品兑换逻辑后续开放，敬请期待。' : lang === 'th' ? 'การแลกสินค้าจริงจะเปิดให้บริการเร็ว ๆ นี้' : 'Physical item redemption will be available soon.',
        okText: 'OK',
      })
      return
    }
    setChecking(true)
    try {
      const userId = getDeviceUserId()
      const isFan = await checkFanStatus(userId)
      if (!isFan) {
        const redirectTo = `/redeem/${id}?auto=redeem`
        const name = pick(product.name)
        nav(`/follow-oa?to=${encodeURIComponent(redirectTo)}&name=${encodeURIComponent(name)}&back=${encodeURIComponent(`/redeem/${id}`)}`)
        return
      }
      // 检查积分余额
      const pointsRequired = Number(product.points_required) || 0
      if (pointsRequired > 0) {
        try {
          const summaryRes: any = await (request.get as any)(`/growth/user/points/summary?user_id=${encodeURIComponent(userId)}`)
          const summaryData = summaryRes?.data || summaryRes
          const available = Number(summaryData?.available_points) || 0
          if (available < pointsRequired) {
            Modal.warning({
              title: lang === 'zh' ? '积分不足' : lang === 'th' ? 'คะแนนไม่เพียงพอ' : 'Insufficient Points',
              content: lang === 'zh'
                ? `当前可用积分 ${available}，兑换需要 ${pointsRequired} 积分，积分不足无法兑换。`
                : lang === 'th'
                  ? `คะแนนที่มี ${available} คะแนน ต้องการ ${pointsRequired} คะแนน`
                  : `You have ${available} pts, but need ${pointsRequired} pts to redeem.`,
              okText: 'OK',
            })
            return
          }
        } catch {
          // 查询失败时不阻止，让后端做最终验证
        }
      }
      setConfirmOpen(true)
    } finally {
      setChecking(false)
    }
  }

  // ── 兑换成功页 ──────────────────────────────────────────────────────────────
  if (redeemSuccess && product) {
    const title = pick(product.name)
    const pointsSpent = product.points_required || 0
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #1677ff 0%, #69b1ff 100%)', padding: '24px 16px' }}>
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '32px 20px', textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              { lang === 'zh' ? '兑换成功！' : lang === 'th' ? 'แลกสำเร็จ!' : 'Redeemed!' }
            </div>
            <div style={{ fontSize: 14, color: '#888', lineHeight: 1.8, marginBottom: 20 }}>
              { lang === 'zh' ? '数字商品已成功兑换，即时发放到账户。' : lang === 'th' ? 'สินค้าดิจิทัลแลกสำเร็จแล้ว ส่งไปยังบัญชีของคุณทันที' : 'Your digital item has been redeemed and delivered to your account.' }
            </div>
            <div style={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 100%)', border: '1px solid #adc6ff', borderRadius: 14, padding: '16px', marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#333', marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 13, color: '#1677ff' }}>
                { lang === 'zh' ? `消耗 ${pointsSpent} 积分` : lang === 'th' ? `ใช้ ${pointsSpent} คะแนน` : `${pointsSpent} pts spent` }
              </div>
            </div>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" size="large" block onClick={() => nav('/welfare')}>
                { lang === 'zh' ? '返回福利中心' : lang === 'th' ? 'กลับศูนย์สิทธิ์' : 'Back to Benefits' }
              </Button>
              <Button size="large" block onClick={() => nav('/mine?tab=member')}>
                { lang === 'zh' ? '查看我的积分' : lang === 'th' ? 'ดูคะแนนของฉัน' : 'My Points' }
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
  const coverImage = product.cover_image || ''
  const coverVideo = product.coverVideo || ''
  const pointsPrice = product.points_required || 0
  const cashPrice = (product.exchange_mode === 'mix' && product.price_thb) ? product.price_thb : 0
  const isPhysical = product.item_type === 'physical'
  const actionType = isPhysical ? 'coming_soon' : pointsPrice > 0 ? 'points_redeem' : 'free_claim'
  const actionText = isPhysical
    ? (lang === 'zh' ? '实物商品，后续开放' : lang === 'th' ? 'เปิดให้บริการเร็ว ๆ นี้' : 'Coming Soon')
    : ACTION_MAP[actionType]?.text || t('productDetail.actionFreeClaim')
  const actionColor = isPhysical ? 'linear-gradient(135deg, #bbb, #d9d9d9)' : (ACTION_MAP[actionType]?.color || ACTION_MAP.free_claim.color)
  const linkedActivities: any[] = product.linkedActivities || []

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: 100 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, borderBottom: '1px solid #f0f0f0' }}>
        <button onClick={() => location.key !== 'default' ? nav(-1) : nav('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, marginRight: 8, display: 'flex', alignItems: 'center', color: '#333' }}>
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

      {coverVideo ? (
        <video src={coverVideo} autoPlay muted loop playsInline style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
      ) : coverImage ? (
        <img src={coverImage} alt={title} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ height: 200, background: 'linear-gradient(135deg, #52c41a20, #52c41a40)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 64 }}>🎫</span>
        </div>
      )}

      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>{title}</h1>
          {subTitle && <p style={{ fontSize: 14, color: '#666', margin: 0 }}>{subTitle}</p>}
        </div>

        {(pointsPrice > 0 || cashPrice > 0) && (
          <ProdSection title={t('productDetail.sectionPrice')}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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
          </ProdSection>
        )}

        {pointsPrice === 0 && cashPrice === 0 && (
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

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 24px', background: '#fff', borderTop: '1px solid #f0f0f0', zIndex: 20 }}>
        <button
          onClick={handleAction}
          disabled={acting || checking}
          style={{ width: '100%', padding: '14px 0', background: (acting || checking) ? '#d9d9d9' : actionColor, border: 'none', borderRadius: 50, color: '#fff', fontSize: 17, fontWeight: 700, cursor: (acting || checking) ? 'default' : 'pointer', boxShadow: (acting || checking) ? 'none' : '0 4px 16px rgba(0,0,0,0.2)', letterSpacing: 0.5, transition: 'all 0.2s' }}
        >
          {checking
            ? (lang === 'zh' ? '验证中...' : lang === 'th' ? 'กำลังตรวจสอบ...' : 'Checking...')
            : acting ? t('productDetail.processing') : actionText}
        </button>
      </div>

      {/* 确认兑换弹窗 */}
      <Modal
        title={lang === 'zh' ? '确认积分兑换' : lang === 'th' ? 'ยืนยันการแลกคะแนน' : 'Confirm Redemption'}
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={doRedeem}
        okText={lang === 'zh' ? '确认兑换' : lang === 'th' ? 'ยืนยัน' : 'Confirm'}
        cancelText={lang === 'zh' ? '取消' : lang === 'th' ? 'ยกเลิก' : 'Cancel'}
        confirmLoading={acting}
      >
        <div style={{ display: 'grid', gap: 12, lineHeight: 1.8, padding: '8px 0' }}>
          <div>
            <strong>{lang === 'zh' ? '商品名称：' : lang === 'th' ? 'สินค้า: ' : 'Item: '}</strong>
            {pick(product?.name)}
          </div>
          {(product?.points_required || 0) > 0 && (
            <div>
              <strong>{lang === 'zh' ? '所需积分：' : lang === 'th' ? 'คะแนนที่ใช้: ' : 'Points: '}</strong>
              {product.points_required} {lang === 'zh' ? '积分' : lang === 'th' ? 'คะแนน' : 'pts'}
            </div>
          )}
          <div style={{ fontSize: 13, color: '#888', background: '#f5f5f5', borderRadius: 8, padding: '10px 12px' }}>
            {lang === 'zh' ? '确认兑换后积分立即扣除，数字商品即时到账。' : lang === 'th' ? 'หลังยืนยัน คะแนนจะถูกหักทันที สินค้าดิจิทัลส่งถึงบัญชีทันที' : 'Points will be deducted immediately and the digital item delivered instantly.'}
          </div>
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
