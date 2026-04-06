import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, Space, Tag, Spin, Modal } from 'antd'
import { ShoppingCartOutlined, ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n'
import request from '../../api/request'

const ITEM_TYPE_GRADIENT: Record<string, string> = {
  digital:  'linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)',
  voucher:  'linear-gradient(135deg, #fa8c16 0%, #ffd666 100%)',
  ai:       'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
  physical: 'linear-gradient(135deg, #FF7A59 0%, #FFB36B 100%)',
  flash:    'linear-gradient(135deg, #f5222d 0%, #ff7875 100%)',
}

function formatNow() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 多语字段 pick 工具（降级顺序：当前语言 → en → zh → th，与 pickLocalizedText 一致）
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
  const { id = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { language } = useI18n()

  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const followed = searchParams.get('followed') === '1'

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

  const handleFollowDone = () => {
    const next = new URLSearchParams(searchParams)
    next.set('followed', '1')
    setSearchParams(next)
  }

  const handleConfirmRedeem = () => {
    const spendPoints = item?.points_required || 0
    const title = pickML(item?.name, language) || ''
    const localKey = 'cityone_local_point_records'
    const current = (() => {
      try { return JSON.parse(localStorage.getItem(localKey) || '[]') } catch { return [] }
    })()
    localStorage.setItem(localKey, JSON.stringify([{
      id: `redeem_${Date.now()}`,
      type: 'spend',
      title,
      points: -spendPoints,
      createdAt: formatNow(),
      source: 'digital_redeem',
    }, ...current]))
    setConfirmOpen(false)
    setTimeout(() => navigate('/my-points'), 120)
  }

  const labels = {
    backLabel:    language === 'zh' ? '返回' : language === 'th' ? 'กลับ' : 'Back',
    pointsUnit:   language === 'zh' ? '积分' : language === 'th' ? 'คะแนน' : 'pts',
    thbLabel:     language === 'zh' ? '+ ฿' : language === 'th' ? '+ ฿' : '+ ฿',
    redeemBtn:    language === 'zh' ? '立即积分兑换' : language === 'th' ? 'แลกด้วยคะแนน' : 'Redeem with Points',
    backWelfare:  language === 'zh' ? '返回福利中心' : language === 'th' ? 'กลับศูนย์สิทธิ์' : 'Back to Benefits',
    descLabel:    language === 'zh' ? '商品说明' : language === 'th' ? 'รายละเอียด' : 'Description',
    highlightsL:  language === 'zh' ? '权益亮点' : language === 'th' ? 'จุดเด่น' : 'Highlights',
    rulesLabel:   language === 'zh' ? '兑换须知' : language === 'th' ? 'เงื่อนไข' : 'Terms',
    notFound:     language === 'zh' ? '商品不存在' : language === 'th' ? 'ไม่พบสินค้า' : 'Item not found',
    notFoundSub:  language === 'zh' ? '该商品可能已下架或链接有误' : language === 'th' ? 'สินค้าอาจถูกนำออกหรือลิงก์ผิด' : 'This item may be unavailable or the link is invalid',
    followTitle:  language === 'zh' ? '需先关注 LINE OA' : language === 'th' ? 'ต้องติดตาม LINE OA ก่อน' : 'Follow LINE OA First',
    followDesc:   language === 'zh' ? '请先关注 CityOne LINE OA，再点击继续兑换。' : language === 'th' ? 'กรุณาติดตาม CityOne LINE OA ก่อน แล้วกด "ติดตามแล้ว" เพื่อดำเนินการต่อ' : 'Please follow CityOne LINE OA first, then tap continue.',
    followedBtn:  language === 'zh' ? '已关注，继续' : language === 'th' ? 'ติดตามแล้ว ดำเนินการต่อ' : 'Already Followed, Continue',
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

  const coverBg = item.cover_image
    ? { backgroundImage: `url(${item.cover_image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
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

  if (!followed) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fb', padding: '24px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }} onClick={() => navigate('/welfare')}>
            {labels.backLabel}
          </Button>
          <Card style={{ borderRadius: 16 }}>
            <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{itemName}</div>
              <Tag color="blue" style={{ fontSize: 13, padding: '4px 10px' }}>
                {pointsLabel}{priceLabel}
              </Tag>
            </div>
            <div style={{ marginTop: 20, padding: 18, borderRadius: 14, background: 'linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)', border: '1px solid #ffd591' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{labels.followTitle}</div>
              <div style={{ color: '#555', lineHeight: 1.8 }}>{labels.followDesc}</div>
            </div>
            <Space direction="vertical" style={{ width: '100%', marginTop: 20 }}>
              <Button type="primary" size="large" block onClick={handleFollowDone}>{labels.followedBtn}</Button>
              <Button size="large" block onClick={() => navigate('/welfare')}>{labels.backWelfare}</Button>
            </Space>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <div style={{ maxWidth: 540, margin: '0 auto', paddingBottom: 32 }}>
        {/* 封面 */}
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
          {/* 视频 */}
          {item.coverVideo ? (
            <Card style={{ marginBottom: 16, borderRadius: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>
                <PlayCircleOutlined style={{ marginRight: 8 }} />Video
              </div>
              <video src={item.coverVideo} controls style={{ width: '100%', borderRadius: 12 }} />
            </Card>
          ) : null}

          {/* 积分/价格 */}
          <Card style={{ marginBottom: 16, borderRadius: 16, background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 100%)', border: '1px solid #adc6ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#1677ff' }}>{pointsLabel}</span>
              {priceLabel && <span style={{ fontSize: 16, color: '#fa8c16', fontWeight: 600 }}>{priceLabel}</span>}
              {item.tag && <Tag color="orange">{item.tag}</Tag>}
            </div>
          </Card>

          {/* 权益亮点 */}
          {highlights.length > 0 && (
            <Card style={{ marginBottom: 16, borderRadius: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>{labels.highlightsL}</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#555', lineHeight: 2 }}>
                {highlights.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
            </Card>
          )}

          {/* 商品说明 */}
          {item.detailTitle || itemDesc ? (
            <Card style={{ marginBottom: 16, borderRadius: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>{labels.descLabel}</div>
              <div style={{ color: '#555', lineHeight: 1.9 }}>{item.detailTitle || itemDesc}</div>
            </Card>
          ) : null}

          {/* 兑换须知 */}
          {rules.length > 0 && (
            <Card style={{ marginBottom: 20, borderRadius: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>{labels.rulesLabel}</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#555', lineHeight: 2 }}>
                {rules.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </Card>
          )}

          {/* 操作按钮 */}
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              type="primary" size="large" block
              icon={<ShoppingCartOutlined />}
              disabled={item.item_type === 'physical'}
              onClick={() => {
                if (item.item_type === 'physical') {
                  Modal.info({ title: itemName, content: labels.physicalTip, okText: 'OK' })
                  return
                }
                setConfirmOpen(true)
              }}
            >
              {item.item_type === 'physical' ? (language === 'zh' ? '实物商品，后续开放' : language === 'th' ? 'เปิดให้บริการเร็ว ๆ นี้' : 'Coming Soon') : labels.redeemBtn}
            </Button>
            <Button size="large" block onClick={() => navigate('/welfare')}>{labels.backWelfare}</Button>
          </Space>
        </div>
      </div>

      {/* 确认弹窗 */}
      <Modal
        title={labels.confirmTitle}
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={handleConfirmRedeem}
        okText={labels.confirmOk}
        cancelText={labels.confirmCancel}
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
