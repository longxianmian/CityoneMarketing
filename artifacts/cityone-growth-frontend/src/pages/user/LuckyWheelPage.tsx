import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Spin, message } from 'antd'
import { ArrowLeftOutlined, TrophyOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { useI18n, type AppLanguage } from '../../i18n'
import { useEffectiveUserId } from '../../hooks/useEffectiveUserId'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const UI = {
  zh: {
    defaultTitle: '大转盘抽奖',
    remainChances: (n: number) => `剩余次数：${n} 次`,
    spinning: '转动中...',
    noChance: '次数已用完',
    startSpin: '开始抽奖',
    hint: '点击转盘或按钮参与抽奖',
    win: '恭喜中奖！',
    lose: '未中奖',
    myBenefits: '我的奖品',
    nearbyStation: '附近站点',
    spinAgain: '再抽一次',
    networkError: '网络错误，请重试',
    defaultPrizes: [
      { label: '5分钟', color: '#ff6b6b' },
      { label: '10分钟', color: '#ffd93d' },
      { label: '未中奖', color: '#e0e0e0' },
      { label: '30分钟', color: '#6bcb77' },
      { label: '未中奖', color: '#e0e0e0' },
      { label: '15分钟', color: '#4d96ff' },
      { label: '未中奖', color: '#e0e0e0' },
      { label: '1小时', color: '#ff922b' },
    ],
  },
  th: {
    defaultTitle: 'หมุนวงล้อลุ้นรางวัล',
    remainChances: (n: number) => `เหลือ ${n} ครั้ง`,
    spinning: 'กำลังหมุน...',
    noChance: 'หมดสิทธิ์แล้ว',
    startSpin: 'หมุนเลย',
    hint: 'แตะวงล้อหรือปุ่มเพื่อเล่น',
    win: 'ยินดีด้วย คุณได้รางวัล!',
    lose: 'ไม่ถูกรางวัล',
    myBenefits: 'รางวัลของฉัน',
    nearbyStation: 'สถานีใกล้เคียง',
    spinAgain: 'หมุนอีกครั้ง',
    networkError: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
    defaultPrizes: [
      { label: '5 นาที', color: '#ff6b6b' },
      { label: '10 นาที', color: '#ffd93d' },
      { label: 'ไม่ถูก', color: '#e0e0e0' },
      { label: '30 นาที', color: '#6bcb77' },
      { label: 'ไม่ถูก', color: '#e0e0e0' },
      { label: '15 นาที', color: '#4d96ff' },
      { label: 'ไม่ถูก', color: '#e0e0e0' },
      { label: '1 ชั่วโมง', color: '#ff922b' },
    ],
  },
  en: {
    defaultTitle: 'Lucky Wheel',
    remainChances: (n: number) => `${n} chance${n !== 1 ? 's' : ''} left`,
    spinning: 'Spinning...',
    noChance: 'No chances left',
    startSpin: 'Spin Now',
    hint: 'Tap the wheel or button to spin',
    win: 'Congratulations!',
    lose: 'No prize this time',
    myBenefits: 'My Prizes',
    nearbyStation: 'Nearby Stations',
    spinAgain: 'Spin Again',
    networkError: 'Network error, please retry',
    defaultPrizes: [
      { label: '5 min', color: '#ff6b6b' },
      { label: '10 min', color: '#ffd93d' },
      { label: 'No prize', color: '#e0e0e0' },
      { label: '30 min', color: '#6bcb77' },
      { label: 'No prize', color: '#e0e0e0' },
      { label: '15 min', color: '#4d96ff' },
      { label: 'No prize', color: '#e0e0e0' },
      { label: '1 hour', color: '#ff922b' },
    ],
  },
}

function drawWheel(canvas: HTMLCanvasElement, segments: { label: string; color: string }[], rotation: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width, height } = canvas
  const cx = width / 2, cy = height / 2
  const radius = Math.min(cx, cy) - 8
  const arc = (2 * Math.PI) / segments.length

  ctx.clearRect(0, 0, width, height)

  segments.forEach((seg, i) => {
    const start = rotation + i * arc - Math.PI / 2
    const end = start + arc

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, radius, start, end)
    ctx.closePath()
    ctx.fillStyle = seg.color
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(start + arc / 2)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.max(11, radius / 8)}px sans-serif`
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 2
    ctx.fillText(seg.label, radius - 12, 5)
    ctx.restore()
  })

  ctx.beginPath()
  ctx.arc(cx, cy, radius * 0.15, 0, 2 * Math.PI)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 2
  ctx.stroke()
}

export default function LuckyWheelPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { language } = useI18n()
  const lang = language as AppLanguage
  const ui = UI[lang] || UI.en
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const [activity, setActivity] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [chances, setChances] = useState<number | null>(null)
  const [result, setResult] = useState<any>(null)
  const [resultVisible, setResultVisible] = useState(false)
  const rotRef = useRef(0)
  const effectiveUserId = useEffectiveUserId()

  const pick = (field: any): string => {
    if (!field) return ''
    if (typeof field === 'string') return field
    if (typeof field === 'object') return field[lang] || field.en || field.zh || field.th || ''
    return ''
  }

  const [prizeData, setPrizeData] = useState<any[]>([])
  const COLORS = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#cc5de8','#20c997','#f06595']
  const segments = prizeData.length
    ? prizeData.map((p: any, i: number) => ({
        label: p.display_text || p.prize_name || `奖品${i + 1}`,
        color: p.display_color && p.display_color !== '#FF6B35' ? p.display_color : COLORS[i % COLORS.length],
      }))
    : ui.defaultPrizes

  useEffect(() => {
    const load = async () => {
      try {
        const [actRes, prizeRes] = await Promise.all([
          fetch(`${API_BASE}/api/activities/${id}`),
          fetch(`${API_BASE}/api/activity-prizes?activityId=${id}`),
        ])
        const actJson = await actRes.json()
        const prizeJson = await prizeRes.json()
        const data = actJson.data || actJson
        setActivity(data)

        const startRes = await fetch(`${API_BASE}/api/activity/wheel/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity_id: id, line_user_id: effectiveUserId }),
        })
        const startJson = await startRes.json()
        if (startJson.data?.remaining_chances !== undefined) {
          setChances(startJson.data.remaining_chances)
        }

        const list: any[] = prizeJson.data || []
        setPrizeData(list)
      } catch { setActivity(null) }
      finally { setLoading(false) }
    }
    load()
  }, [id])

  useEffect(() => {
    if (loading) return
    const canvas = canvasRef.current
    if (!canvas) return
    drawWheel(canvas, segments, rotRef.current)
  }, [loading, segments])

  const handleSpin = async () => {
    if (spinning || (chances !== null && chances <= 0)) return
    setSpinning(true)

    let prizeAngle = 0
    try {
      const res = await fetch(`${API_BASE}/api/activity/wheel/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: id, line_user_id: effectiveUserId }),
      })
      const json = await res.json()
      if (json.code !== 200) {
        message.error(json.msg || ui.networkError)
        setSpinning(false)
        return
      }
      const data = json.data || {}
      setResult(data)
      // 根据 prize_id 找到扇区索引，让指针（顶部）精确对准中奖扇区中心
      const wonPrizeId = data.prize?.prize_id
      const wonIdx = prizeData.findIndex((p: any) => p.prize_id === wonPrizeId)
      if (wonIdx >= 0) {
        const arc = (2 * Math.PI) / segments.length
        // 目标：finalRot + wonIdx*arc - π/2 + arc/2 ≡ -π/2 (mod 2π)
        // => finalRot ≡ -(wonIdx*arc + arc/2) (mod 2π)
        // finalRot = startRot + 2π*N + prizeAngle
        // => prizeAngle = -(wonIdx*arc + arc/2) - (startRot mod 2π)
        const TWO_PI = 2 * Math.PI
        const normalizedStart = ((rotRef.current % TWO_PI) + TWO_PI) % TWO_PI
        prizeAngle = -(wonIdx * arc + arc / 2) - normalizedStart
      }
      if (chances !== null) setChances(c => Math.max(0, (c ?? 1) - 1))
    } catch {
      message.error(ui.networkError)
      setSpinning(false)
      return
    }

    const totalSpin = Math.PI * 2 * (5 + Math.random() * 3) + prizeAngle
    const startRot = rotRef.current
    const duration = 4000
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      rotRef.current = startRot + totalSpin * eased
      if (canvasRef.current) drawWheel(canvasRef.current, segments, rotRef.current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setSpinning(false)
        setResultVisible(true)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
  }

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#1a0a2e' }}>
      <Spin size="large" />
    </div>
  )

  const isNoChance = chances !== null && chances <= 0
  const pageTitle = pick(activity?.activity_name) || pick(activity?.activity_title) || pick(activity?.name) || pick(activity?.title) || ui.defaultTitle

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at top, #1a0a2e 0%, #0d0628 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0 40px', position: 'relative' }}>
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
        <button onClick={() => nav(`/activity/${id}`)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <ArrowLeftOutlined />
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 700, color: '#fff' }}>
          {pageTitle}
        </span>
        <div style={{ width: 36 }} />
      </div>

      {chances !== null && (
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '6px 20px', color: '#ffd93d', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          {ui.remainChances(chances)}
        </div>
      )}

      <div style={{ position: 'relative', margin: '16px 0', filter: 'drop-shadow(0 8px 32px rgba(255,150,0,0.3))' }}>
        <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', zIndex: 10, width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderBottom: '28px solid #ff4d4f', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          style={{ borderRadius: '50%', boxShadow: '0 0 40px rgba(255,200,0,0.3)', cursor: spinning || isNoChance ? 'not-allowed' : 'pointer' }}
          onClick={handleSpin}
        />
      </div>

      <button
        onClick={handleSpin}
        disabled={spinning || isNoChance}
        style={{
          padding: '14px 60px',
          fontSize: 18,
          fontWeight: 700,
          background: isNoChance ? '#555' : spinning ? '#888' : 'linear-gradient(135deg, #ff6b00, #ffd93d)',
          border: 'none',
          borderRadius: 50,
          color: '#fff',
          cursor: isNoChance || spinning ? 'not-allowed' : 'pointer',
          boxShadow: isNoChance || spinning ? 'none' : '0 4px 20px rgba(255,150,0,0.5)',
          transition: 'all 0.2s',
          marginTop: 8,
        }}
      >
        {spinning ? ui.spinning : isNoChance ? ui.noChance : ui.startSpin}
      </button>

      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 12, textAlign: 'center' }}>{ui.hint}</p>

      {resultVisible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 24, padding: 32, maxWidth: 320, width: '100%', textAlign: 'center', animation: 'scaleIn 0.3s ease' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>
              {!result?.is_thanks ? '🎉' : '😅'}
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
              {!result?.is_thanks ? ui.win : ui.lose}
            </h2>
            {result?.prize?.prize_name && (
              <p style={{ fontSize: 18, color: '#1677ff', fontWeight: 700, marginBottom: 4 }}>
                {result.prize.prize_name}
              </p>
            )}
            {result?.issued_product?.product_name && (
              <p style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                {result.issued_product.product_name}
              </p>
            )}
            {!result?.is_thanks && result?.issued_product && (
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '8px 16px', marginBottom: 8, fontSize: 13, color: '#389e0d' }}>
                奖品已发放到您的账户
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setResultVisible(false); nav('/mine?tab=prizes') }}
                style={{ flex: 1, padding: '12px 0', background: 'linear-gradient(135deg, #1677ff, #4096ff)', border: 'none', borderRadius: 50, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
              >
                <TrophyOutlined style={{ marginRight: 4 }} />{ui.myBenefits}
              </button>
              <button
                onClick={() => { setResultVisible(false); nav('/nearby') }}
                style={{ flex: 1, padding: '12px 0', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 50, color: '#333', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
              >
                <EnvironmentOutlined style={{ marginRight: 4 }} />{ui.nearbyStation}
              </button>
            </div>
            {!isNoChance && (
              <button onClick={() => setResultVisible(false)} style={{ width: '100%', marginTop: 10, padding: '10px 0', background: 'none', border: 'none', color: '#999', fontSize: 14, cursor: 'pointer' }}>
                {ui.spinAgain}
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes scaleIn { from { transform: scale(0.7); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
    </div>
  )
}
