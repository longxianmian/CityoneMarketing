import React, { useState } from 'react'
import { Modal, Input, Button, message, Divider, Space, Typography, Tag } from 'antd'
import { CopyOutlined, CheckOutlined, ShareAltOutlined } from '@ant-design/icons'

const { Text } = Typography

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
  opts: {
    sharerUserId?: string
    campaignId?: string
    shareToken?: string
    channel?: string
  },
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
    icon: '💬',
    channel: 'line',
    getShareUrl: (url: string, text: string) =>
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    openNew: true,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    icon: '📘',
    channel: 'facebook',
    getShareUrl: (url: string, text: string) =>
      `https://www.facebook.com/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
    openNew: true,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    color: '#010101',
    icon: '🎵',
    channel: 'tiktok',
    getShareUrl: null,
    openNew: false,
  },
  {
    key: 'instagram',
    label: 'IG',
    color: '#E1306C',
    icon: '📸',
    channel: 'instagram',
    getShareUrl: null,
    openNew: false,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    color: '#FF0000',
    icon: '▶️',
    channel: 'youtube',
    getShareUrl: null,
    openNew: false,
  },
]

const SHARE_TEXT_MAP: Record<ShareContentType, (name: string) => string> = {
  activity: (name) => `🎉 ${name}\n限时活动开启，点击参与赢好礼！`,
  coupon: (name) => `🎫 ${name}\n领取专属优惠券，扫码借充电宝立享折扣！`,
  product: (name) => `🛍️ ${name}\n点击查看并兑换专属好礼！`,
}

export default function SharePromoModal({
  open,
  onClose,
  type,
  id,
  name,
  sharerUserId,
  campaignId,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [copiedPlatform, setCopiedPlatform] = useState('')
  const [shareToken] = useState(() => generateShareToken())

  const shareText = SHARE_TEXT_MAP[type]?.(name) ?? `${name}\n点击查看详情！`

  const baseUrl = buildShareUrl(type, id, {
    sharerUserId,
    campaignId,
    shareToken,
    channel: 'direct',
  })

  const fullCopyText = `${shareText}\n${baseUrl}`

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(baseUrl)
    setCopied(true)
    message.success('落地页链接已复制')
    setTimeout(() => setCopied(false), 2500)
  }

  const handlePlatformAction = async (platform: typeof PLATFORMS[0]) => {
    const platformUrl = buildShareUrl(type, id, {
      sharerUserId,
      campaignId,
      shareToken,
      channel: platform.channel,
    })
    if (platform.openNew && platform.getShareUrl) {
      window.open(platform.getShareUrl(platformUrl, shareText), '_blank', 'noopener,noreferrer')
    } else {
      await navigator.clipboard.writeText(platformUrl)
      setCopiedPlatform(platform.key)
      message.success(`链接已复制，请在 ${platform.label} 中粘贴发布`)
      setTimeout(() => setCopiedPlatform(''), 2500)
    }
  }

  const typeLabel = type === 'activity' ? '活动' : type === 'coupon' ? '卡券' : '商品'

  return (
    <Modal
      title={
        <Space>
          <ShareAltOutlined style={{ color: '#1677ff' }} />
          <span>分享{typeLabel} — {name}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
    >
      {/* 落地页 URL */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>
          📎 H5 落地页链接（含归因参数）
        </div>
        <Input.Group compact style={{ display: 'flex' }}>
          <Input
            value={baseUrl}
            readOnly
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 11, background: '#f8f8f8' }}
          />
          <Button
            type="primary"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={handleCopyUrl}
            style={{ flexShrink: 0 }}
          >
            {copied ? '已复制' : '复制'}
          </Button>
        </Input.Group>
        <div style={{ marginTop: 6, fontSize: 11, color: '#999' }}>
          链接已带入归因参数（sharer_user_id / share_token / campaign_id / channel），用户点击后系统可识别分享来源
        </div>
      </div>

      <Divider style={{ margin: '12px 0' }}>
        <span style={{ fontSize: 12, color: '#999' }}>一键分享到平台</span>
      </Divider>

      {/* 平台按钮 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {PLATFORMS.map(p => (
          <button
            key={p.key}
            onClick={() => handlePlatformAction(p)}
            title={p.openNew ? `直接分享到 ${p.label}` : `复制链接，在 ${p.label} 中粘贴`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10, border: `1.5px solid ${p.color}44`,
              background: copiedPlatform === p.key ? p.color + '18' : '#FAFAFA',
              color: p.color, fontWeight: 700, fontSize: 14, cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: 100, justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 18 }}>{p.icon}</span>
            <span>{copiedPlatform === p.key ? '已复制' : p.label}</span>
          </button>
        ))}
      </div>

      {/* 预览文案 */}
      <Divider style={{ margin: '12px 0' }}>
        <span style={{ fontSize: 12, color: '#999' }}>分享文案预览</span>
      </Divider>
      <div style={{
        background: '#F6F8FA', borderRadius: 10, padding: '12px 14px',
        fontSize: 13, lineHeight: 1.7, color: '#333',
        border: '1px solid #E8ECF0', whiteSpace: 'pre-line',
      }}>
        {fullCopyText}
      </div>
      <Button
        block
        icon={<CopyOutlined />}
        style={{ marginTop: 10 }}
        onClick={async () => {
          await navigator.clipboard.writeText(fullCopyText)
          message.success('完整文案已复制')
        }}
      >
        复制完整文案
      </Button>

      <div style={{ marginTop: 14, padding: '10px 12px', background: '#F0FDF4', borderRadius: 8, fontSize: 12, color: '#166534', border: '1px solid #BBF7D0' }}>
        💡 <Text style={{ fontSize: 12, color: '#166534' }}>LINE 和 Facebook 点击后直接打开分享页。TikTok / IG / YouTube 不支持直接跳转，点击会自动复制落地页链接，在对应 App 中粘贴即可。</Text>
      </div>
    </Modal>
  )
}
