// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止页面自行恢复兑换动作或跳首页/个人中心。
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Space, Tag, Spin, Modal, App } from 'antd'
import { ShoppingCartOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n'
import request from '../../api/request'
import { useEffectiveUserId } from '../../hooks/useEffectiveUserId'
import { useOssUrl } from '../../components/OssImage'
import { useFollowGate } from '../../hooks/useFollowGate'

const PLAY_ICON_STYLE: React.CSSProperties = {
  width: 34, height: 34, borderRadius: '50%',
  background: 'rgba(0,0,0,0.28)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const PLAY_ICON_SPAN = (paused: boolean): React.CSSProperties => ({
  fontSize: 13, color: '#fff', lineHeight: 1, marginLeft: paused ? 2 : 0,
})

function VideoClickPlay({ src, poster }: { src: string; poster?: string }) {
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)
  const ref = useRef<HTMLVideoElement>(null)

  const togglePlay = () => {
    const el = ref.current
    if (!el) return
    if (el.paused) { el.play(); setPaused(false) }
    else { el.pause(); setPaused(true) }
  }

  if (started) {
    return (
      <div style={{ position: 'relative', cursor: 'pointer', borderRadius: 12, overflow: 'hidden' }} onClick={togglePlay}>
        <video ref={ref} src={src} autoPlay loop playsInline style={{ width: '100%', display: 'block' }} />
        {paused && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={PLAY_ICON_STYLE}>
              <span style={PLAY_ICON_SPAN(true)}>▶</span>
            </div>
          </div>
        )}
      </div>
    )
  }
  return (
    <div style={{ position: 'relative', cursor: 'pointer', background: poster ? 'transparent' : '#111', borderRadius: 12, overflow: 'hidden' }}
         onClick={() => setStarted(true)}>
      {poster
        ? <img src={poster} alt="" style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: 220 }} />
        : <div style={{ height: 160 }} />}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.12)' }}>
        <div style={PLAY_ICON_STYLE}>
          <span style={PLAY_ICON_SPAN(true)}>▶</span>
        </div>
      </div>
    </div>
  )
}

const ITEM_TYPE_GRADIENT: Record<string, string> = {
  digital:  'linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)',
  voucher:  'linear-gradient(135deg, #fa8c16 0%, #ffd666 100%)',
  ai:       'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
  physical: 'linear-gradient(135deg, #FF7A59 0%, #FFB36B 100%)',
  flash:    'linear-gradient(135deg, #f5222d 0%, #ff7875 100%)',
}


function pickML(field: any, lang?: string): string {
  if (!field) return ''
  if (typeof field === 'string') return field
  if (typeof field === 'object' && !Array.isArray(field)) {
    const l = lang || 'en'
    return field[l] || field.en || field.zh || field.th || ''
  }
  return ''
}

function pickStrings(field: any, lang?: string): string[] {
  if (!field) return []
  const l = lang || 'en'
  if (typeof field === 'object' && !Array.isArray(field)) {
    const str = field[l] || field.en || field.zh || field.th || ''
    return str.split('\n').filter(Boolean)
  }
  if (Array.isArray(field)) {
    return field.map((item: any) =>
      (item && typeof item === 'object') ? (item[l] || item.en || item.zh || item.th || '') : String(item || '')
    ).filter(Boolean)
  }
  return []
}

export default function RedeemUserPage() {
  const { message, modal } = App.useApp()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { language } = useI18n()
  const effectiveUserId = useEffectiveUserId()
  const { guard, checking } = useFollowGate()

  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [acting, setActing] = useState(false)
  const resolvedCoverImage = useOssUrl(item?.cover_image)

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return }
    setLoading(true)
    ;(request.get(`/growth/mall/items/${id}`) as any)
      .then((res: any) => {
        const data = res.data || res
        if (!data || !data.id) { setNotFound(true) } else { setItem(data) }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  const queueRedeemIntent = async () => {
    if (!item) return
    setConfirmOpen(false)
    try {
      await guard(
        {
          label: itemName,
          returnPath: `/redeem/${id}`,
          successPath: '/mine?tab=member',
          failPath: `/redeem/${id}`,
          back: '/my-points',
          intentAction: 'redeem_product',
          resourceId: item.id,
          source: {},
        }
      )
    } catch {
      // guard handles error messaging
    }
  }

  const handleRedeem = async () => {
    if (item?.item_type === 'physical') {
      message.info(labels.physicalTip)
      return
    }
    try {
      const userId = effectiveUserId
      const pointsRequired = Number(item?.points_required) || 0
      if (pointsRequired > 0) {
        try {
          const summaryRes: any = await (request.get as any)(`/growth/user/points/summary?user_id=${encodeURIComponent(userId)}`)
          const summaryData = summaryRes?.data || summaryRes
          const available = Number(summaryData?.available_points) || 0
          if (available < pointsRequired) {
            modal.warning({
              title: language === 'zh' ? '积分不足' : language === 'th' ? 'คะแนนไม่เพียงพอ' : 'Insufficient Points',
              content: language === 'zh'
                ? `当前可用积分 ${available} 分，兑换此商品需要 ${pointsRequired} 分，差 ${pointsRequired - available} 分。`
                : language === 'th'
                  ? `คะแนนปัจจุบัน ${available} คะแนน ต้องการ ${pointsRequired} คะแนน ขาด ${pointsRequired - available} คะแนน`
                  : `You have ${available} pts but need ${pointsRequired} pts (short by ${pointsRequired - available} pts).`,
              okText: language === 'zh' ? '知道了' : language === 'th' ? 'ตกลง' : 'OK',
              centered: true,
            })
            return
          }
        } catch {
          // 查询失败时不阻止，让后端做最终验证
        }
      }
      setConfirmOpen(true)
    } finally {}
  }

  const labels = {
    backLabel:    language === 'zh' ? '返回' : language === 'th' ? 'กลับ' : 'Back',
    pointsUnit:   language === 'zh' ? '积分' : language === 'th' ? 'คะแนน' : 'pts',
    thbLabel:     '+ ฿',
    redeemBtn:    language === 'zh' ? '立即积分兑换' : language === 'th' ? 'แลกด้วยคะแนน' : 'Redeem with Points',
    backWelfare:  language === 'zh' ? '返回福利中心' : language === 'th' ? 'กลับศูนย์สิทธิ์' : 'Back to Benefits',
    descLabel:    language === 'zh' ? '商品说明' : language === 'th' ? 'รายละเอียด' : 'Description',
    highlightsL:  language === 'zh' ? '权益亮点' : language === 'th' ? 'จุดเด่น' : 'Highlights',
    rulesLabel:   language === 'zh' ? '兑换须知' : language === 'th' ? 'เงื่อนไข' : 'Terms',
    notFound:     language === 'zh' ? '商品不存在' : language === 'th' ? 'ไม่พบสินค้า' : 'Item not found',
    notFoundSub:  language === 'zh' ? '该商品可能已下架或链接有误' : language === 'th' ? 'สินค้าอาจถูกนำออกหรือลิงก์ผิด' : 'This item may be unavailable or the link is invalid',
    checkingLabel:language === 'zh' ? '验证中...' : language === 'th' ? 'กำลังตรวจสอบ...' : 'Checking...',
    confirmTitle: language === 'zh' ? '确认积分兑换' : language === 'th' ? 'ยืนยันการแลกคะแนน' : 'Confirm Redemption',
    confirmOk:    language === 'zh' ? '确认兑换' : language === 'th' ? 'ยืนยัน' : 'Confirm',
    confirmCancel:language === 'zh' ? '取消' : language === 'th' ? 'ยกเลิก' : 'Cancel',
    physicalTip:  language === 'zh' ? '实物商品兑换逻辑后续开放，敬请期待。' : language === 'th' ? 'การแลกสินค้าจริงจะเปิดให้บริการเร็ว ๆ นี้' : 'Physical item redemption will be available soon.',
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (notFound || !item) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fb', padding: '32px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔍</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{labels.notFound}</div>
          <div style={{ color: '#888', marginBottom: 24 }}>{labels.notFoundSub}</div>
          <Button type="primary" onClick={() => navigate('/welfare')}>{labels.backWelfare}</Button>
        </div>
      </div>
    )
  }

  const coverBg = resolvedCoverImage
    ? { backgroundImage: `url(${resolvedCoverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: ITEM_TYPE_GRADIENT[item.item_type] || ITEM_TYPE_GRADIENT.digital }

  const pointsLabel = item.points_required != null
    ? `${item.points_required} ${labels.pointsUnit}`
    : '—'

  const priceLabel = item.exchange_mode === 'mix' && item.price_thb
    ? ` ${labels.thbLabel}${item.price_thb}`
    : ''

  const highlights = pickStrings(item.highlights, language)
  const rules = pickStrings(item.rules, language)
  const itemName = pickML(item.name, language) || ''
  const itemDesc = pickML(item.description, language) || ''

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <div style={{ maxWidth: 540, margin: '0 auto', paddingBottom: 32 }}>
        <div style={{ height: 280, ...coverBg, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 20 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.9)', border: 'none' }}
            onClick={() => navigate('/welfare')}
          >
            {labels.backLabel}
          </Button>
          <div style={{ color: '#fff' }}>
            <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 6, textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{itemName}</div>
            {itemDesc && (
              <div style={{ fontSize: 14, opacity: 0.92, textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>{itemDesc}</div>
            )}
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {item.cover_video ? (
            <Card style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', padding: 0 }}>
              <VideoClickPlay src={item.cover_video} poster={resolvedCoverImage || undefined} />
            </Card>
          ) : null}

          <Card style={{ marginBottom: 16, borderRadius: 16, background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 100%)', border: '1px solid #adc6ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#1677ff' }}>{pointsLabel}</span>
              {priceLabel && <span style={{ fontSize: 16, color: '#fa8c16', fontWeight: 600 }}>{priceLabel}</span>}
              {item.tag && <Tag color="orange">{item.tag}</Tag>}
            </div>
          </Card>

          {highlights.length > 0 && (
            <Card style={{ marginBottom: 16, borderRadius: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>{labels.highlightsL}</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#555', lineHeight: 2 }}>
                {highlights.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
            </Card>
          )}

          {item.detailTitle || itemDesc ? (
            <Card style={{ marginBottom: 16, borderRadius: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>{labels.descLabel}</div>
              <div style={{ color: '#555', lineHeight: 1.9 }}>{item.detailTitle || itemDesc}</div>
            </Card>
          ) : null}

          {rules.length > 0 && (
            <Card style={{ marginBottom: 20, borderRadius: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>{labels.rulesLabel}</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#555', lineHeight: 2 }}>
                {rules.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </Card>
          )}

          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              type="primary" size="large" block
              icon={<ShoppingCartOutlined />}
              disabled={item.item_type === 'physical' || checking}
              loading={checking}
              onClick={handleRedeem}
            >
              {checking
                ? labels.checkingLabel
                : item.item_type === 'physical'
                  ? (language === 'zh' ? '实物商品，后续开放' : language === 'th' ? 'เปิดให้บริการเร็ว ๆ นี้' : 'Coming Soon')
                  : labels.redeemBtn}
            </Button>
            <Button size="large" block onClick={() => navigate('/welfare')}>{labels.backWelfare}</Button>
          </Space>
        </div>
      </div>

      <Modal
        title={labels.confirmTitle}
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={queueRedeemIntent}
        okText={labels.confirmOk}
        cancelText={labels.confirmCancel}
        confirmLoading={checking}
      >
        <div style={{ display: 'grid', gap: 12, lineHeight: 1.8 }}>
          <div><strong>{language === 'zh' ? '商品名称：' : 'Item: '}</strong>{itemName}</div>
          <div><strong>{language === 'zh' ? '所需积分：' : 'Points: '}</strong>{pointsLabel}{priceLabel}</div>
          {item.exchange_mode === 'points' && (
            <div><strong>{language === 'zh' ? '说明：' : 'Note: '}</strong>
              {language === 'zh' ? '数字商品兑换成功后将直接发放到账号。' : language === 'th' ? 'สินค้าดิจิทัลจะมอบให้บัญชีทันทีหลังแลกสำเร็จ' : 'Digital items will be granted to your account immediately.'}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
