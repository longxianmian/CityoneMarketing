import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Spin, message } from 'antd'
import { ArrowLeftOutlined, FireOutlined, ShareAltOutlined } from '@ant-design/icons'
import { useI18n, type AppLanguage } from '../../i18n'
import SharePromoModal from '../../components/SharePromoModal'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const ACTION_MAP: Record<string, { text: string; color: string }> = {
  free_claim: { text: '立即领取', color: 'linear-gradient(135deg, #52c41a, #73d13d)' },
  points_redeem: { text: '积分兑换', color: 'linear-gradient(135deg, #1677ff, #4096ff)' },
  cash_buy: { text: '立即购买', color: 'linear-gradient(135deg, #fa8c16, #ffc53d)' },
  use_now: { text: '去使用', color: 'linear-gradient(135deg, #722ed1, #9254de)' },
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { language } = useI18n()
  const lang = language as AppLanguage
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [shareVisible, setShareVisible] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/digital-products/${id}`)
        const json = await res.json()
        setProduct(json.data || json)
      } catch { setProduct(null) }
      finally { setLoading(false) }
    }
    load()
  }, [id])

  const pick = (field: any): string => {
    if (!field) return ''
    if (typeof field === 'string') return field
    if (typeof field === 'object') return field[lang] || field.en || field.zh || field.th || ''
    return ''
  }

  const handleAction = async () => {
    if (!product) return
    setActing(true)
    try {
      const res = await fetch(`${API_BASE}/api/digital-products/${id}/claim`, { method: 'POST' })
      const json = await res.json()
      if (json.code === 200) {
        message.success('操作成功！')
        setTimeout(() => nav('/my-coupons'), 1000)
      } else {
        message.error(json.message || '操作失败，请重试')
      }
    } catch {
      message.error('网络错误，请重试')
    } finally {
      setActing(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Spin size="large" />
    </div>
  )

  const title = pick(product?.title) || product?.name || '商品详情'
  const subTitle = pick(product?.subTitle) || ''
  const benefitContent = pick(product?.benefitContent) || product?.benefitContent || ''
  const usageRules = pick(product?.usageRules) || product?.usageRules || ''
  const redeemNotice = pick(product?.redeemNotice) || product?.redeemNotice || ''
  const coverImage = product?.coverImage || ''
  const coverVideo = product?.coverVideo || ''
  const pointsPrice = product?.pointsPrice || 0
  const cashPrice = product?.cashPrice || 0
  const actionType = product?.actionType || 'free_claim'
  const actionText = pick(product?.actionText) || ACTION_MAP[actionType]?.text || '立即领取'
  const actionColor = ACTION_MAP[actionType]?.color || ACTION_MAP.free_claim.color
  const linkedActivities: any[] = product?.linkedActivities || []

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: 100 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, borderBottom: '1px solid #f0f0f0' }}>
        <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, marginRight: 8, display: 'flex', alignItems: 'center', color: '#333' }}>
          <ArrowLeftOutlined style={{ fontSize: 20 }} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 16, flex: 1 }}>商品详情</span>
        <button
          onClick={() => setShareVisible(true)}
          title="分享好友赚积分"
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
          <ProdSection title="价格">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {pointsPrice > 0 && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>{pointsPrice}</span>
                  <span style={{ fontSize: 13, color: '#1677ff' }}>积分</span>
                </div>
              )}
              {cashPrice > 0 && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 14, color: '#fa8c16' }}>฿</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: '#fa8c16' }}>{cashPrice}</span>
                </div>
              )}
              {pointsPrice === 0 && cashPrice === 0 && (
                <span style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>免费</span>
              )}
            </div>
          </ProdSection>
        )}

        {pointsPrice === 0 && cashPrice === 0 && (
          <ProdSection title="获取方式">
            <span style={{ fontSize: 20, fontWeight: 700, color: '#52c41a' }}>免费领取</span>
          </ProdSection>
        )}

        {benefitContent && (
          <ProdSection title="权益内容">
            {benefitContent.split(/\n/).filter(Boolean).map((line: string, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <FireOutlined style={{ color: '#fa8c16', flexShrink: 0, marginTop: 3 }} />
                <span style={{ fontSize: 14, color: '#444', lineHeight: 1.7 }}>{line.trim()}</span>
              </div>
            ))}
          </ProdSection>
        )}

        {usageRules && (
          <ProdSection title="使用规则">
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.8, margin: 0 }}>{usageRules}</p>
          </ProdSection>
        )}

        {redeemNotice && (
          <ProdSection title="兑换须知">
            <p style={{ fontSize: 13, color: '#999', lineHeight: 1.8, margin: 0 }}>{redeemNotice}</p>
          </ProdSection>
        )}

        {linkedActivities.length > 0 && (
          <ProdSection title="可通过哪些活动获得">
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
          disabled={acting}
          style={{ width: '100%', padding: '14px 0', background: acting ? '#d9d9d9' : actionColor, border: 'none', borderRadius: 50, color: '#fff', fontSize: 17, fontWeight: 700, cursor: acting ? 'default' : 'pointer', boxShadow: acting ? 'none' : '0 4px 16px rgba(0,0,0,0.2)', letterSpacing: 0.5, transition: 'all 0.2s' }}
        >
          {acting ? '处理中...' : actionText}
        </button>
      </div>
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
