import React, { useState } from 'react'
import { Modal, Button, message } from 'antd'
import { CopyOutlined, CheckOutlined, ShareAltOutlined, LinkOutlined } from '@ant-design/icons'

type ShareContentType = 'coupon' | 'activity' | 'product'

interface Props {
  open: boolean
  onClose: () => void
  type: ShareContentType
  id: number | string
  name: string
  sharerUserId?: string
  campaignId?: string
}

function generateShareToken(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function getContentPath(type: ShareContentType, id: number | string): string {
  if (type === 'coupon') return `/coupon/${id}`
  if (type === 'product') return `/redeem/${id}`
  return `/activity/${id}`
}

function buildShareUrl(
  type: ShareContentType,
  id: number | string,
  opts: { sharerUserId?: string; campaignId?: string; shareToken?: string; channel?: string },
): string {
  const base = window.location.origin
  const path = getContentPath(type, id)
  const params = new URLSearchParams()
  if (opts.sharerUserId) params.set('sharer_user_id', opts.sharerUserId)
  params.set('share_content_type', type)
  params.set('share_content_id', String(id))
  if (opts.campaignId) params.set('campaign_id', opts.campaignId)
  if (opts.shareToken) params.set('share_token', opts.shareToken)
  if (opts.channel) params.set('channel', opts.channel)
  const qs = params.toString()
  return `${base}${path}${qs ? '?' + qs : ''}`
}

const PLATFORMS = [
  {
    key: 'line',
    label: 'LINE',
    color: '#06C755',
    bg: '#F0FFF4',
    icon: '💬',
    channel: 'line',
    tip: '点击直接打开 LINE 分享',
    getShareUrl: (url: string, text: string) =>
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    openNew: true,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    bg: '#EFF6FF',
    icon: '📘',
    channel: 'facebook',
    tip: '点击直接打开 Facebook 分享',
    getShareUrl: (url: string, text: string) =>
      `https://www.facebook.com/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
    openNew: true,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    color: '#010101',
    bg: '#F9F9F9',
    icon: '🎵',
    channel: 'tiktok',
    tip: '链接已复制，打开 TikTok 粘贴发布',
    getShareUrl: null,
    openNew: false,
  },
  {
    key: 'instagram',
    label: 'IG',
    color: '#E1306C',
    bg: '#FFF0F6',
    icon: '📸',
    channel: 'instagram',
    tip: '链接已复制，打开 IG 粘贴发布',
    getShareUrl: null,
    openNew: false,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    color: '#FF0000',
    bg: '#FFF5F5',
    icon: '▶️',
    channel: 'youtube',
    tip: '链接已复制，打开 YouTube 粘贴发布',
    getShareUrl: null,
    openNew: false,
  },
]

const SHARE_TEXT_MAP: Record<ShareContentType, (name: string) => string> = {
  activity: (name) => `🎉 ${name}\n限时活动开启，点击参与赢好礼！`,
  coupon: (name) => `🎫 ${name}\n领取专属优惠券，扫码借充电宝立享折扣！`,
  product: (name) => `🛍️ ${name}\n点击查看并兑换专属好礼！`,
}

export default function SharePromoModal({ open, onClose, type, id, name, sharerUserId, campaignId }: Props) {
  const [copiedPlatform, setCopiedPlatform] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedText, setCopiedText] = useState(false)
  const [shareToken] = useState(() => generateShareToken())
  const [showLink, setShowLink] = useState(false)

  const shareText = SHARE_TEXT_MAP[type]?.(name) ?? `${name}\n点击查看详情！`
  const baseUrl = buildShareUrl(type, id, { sharerUserId, campaignId, shareToken, channel: 'direct' })
  const typeLabel = type === 'activity' ? '活动' : type === 'coupon' ? '卡券' : '商品'

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(`${shareText}\n${baseUrl}`)
    setCopiedText(true)
    message.success('文案已复制，去粘贴给好友吧 🎉')
    setTimeout(() => setCopiedText(false), 2500)
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(baseUrl)
    setCopiedLink(true)
    message.success('链接已复制')
    setTimeout(() => setCopiedLink(false), 2500)
  }

  const handlePlatformAction = async (platform: typeof PLATFORMS[0]) => {
    const platformUrl = buildShareUrl(type, id, { sharerUserId, campaignId, shareToken, channel: platform.channel })
    if (platform.openNew && platform.getShareUrl) {
      window.open(platform.getShareUrl(platformUrl, shareText), '_blank', 'noopener,noreferrer')
    } else {
      await navigator.clipboard.writeText(`${shareText}\n${platformUrl}`)
      setCopiedPlatform(platform.key)
      message.success(platform.tip)
      setTimeout(() => setCopiedPlatform(''), 2500)
    }
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShareAltOutlined style={{ color: '#7B61FF' }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>分享{typeLabel}给好友</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={460}
      styles={{ body: { padding: '16px 20px 20px' } }}
    >

      {/* ── 1. 分享内容预览 ──────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #F5F3FF 0%, #EEF2FF 100%)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 18,
        border: '1px solid #DDD6FE',
      }}>
        <div style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600, marginBottom: 8, letterSpacing: 0.3 }}>
          📢 发给好友看的内容
        </div>
        <div style={{ fontSize: 14, color: '#1F2937', lineHeight: 1.8, whiteSpace: 'pre-line', marginBottom: 12 }}>
          {shareText}
        </div>
        <Button
          block
          icon={copiedText ? <CheckOutlined /> : <CopyOutlined />}
          onClick={handleCopyText}
          style={{
            borderRadius: 10, fontWeight: 700, fontSize: 14, height: 42,
            background: copiedText ? '#059669' : '#7B61FF',
            borderColor: copiedText ? '#059669' : '#7B61FF',
            color: '#fff',
          }}
        >
          {copiedText ? '✅ 已复制，去粘贴给好友' : '复制文案（含链接）'}
        </Button>
      </div>

      {/* ── 2. 平台直接分享 ──────────────────────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 10, letterSpacing: 0.3 }}>
          或直接分享到
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PLATFORMS.map(p => (
            <button
              key={p.key}
              onClick={() => handlePlatformAction(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 10,
                border: `1.5px solid ${copiedPlatform === p.key ? p.color : p.color + '44'}`,
                background: copiedPlatform === p.key ? p.color + '18' : p.bg,
                color: p.color, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                transition: 'all 0.15s',
                minWidth: 80, justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 16 }}>{p.icon}</span>
              <span>{copiedPlatform === p.key ? '已复制' : p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. 复制链接（折叠，次要） ────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => setShowLink(v => !v)}
          style={{
            background: 'none', border: 'none', padding: 0,
            color: '#9CA3AF', fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <LinkOutlined />
          <span>{showLink ? '收起链接' : '只复制链接'}</span>
        </button>
        {showLink && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              flex: 1, fontSize: 11, color: '#6B7280', background: '#F9FAFB',
              border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 10px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {baseUrl}
            </div>
            <Button
              size="small"
              icon={copiedLink ? <CheckOutlined /> : <CopyOutlined />}
              onClick={handleCopyLink}
              style={{ borderRadius: 8, flexShrink: 0, fontSize: 12 }}
            >
              {copiedLink ? '已复制' : '复制'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
