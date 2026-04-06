import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Spin } from 'antd'
import { ArrowLeftOutlined, TrophyOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { useI18n, type AppLanguage } from '../../i18n'
import { getDeviceUserId } from '../../utils/deviceUserId'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const UI = {
  zh: {
    defaultTitle: '刮刮卡',
    remainChances: (n: number) => `剩余次数：${n} 次`,
    scratchHint: '✦ 刮开查看结果 ✦',
    noChance: '次数已用完',
    revealed: '已刮开',
    scratchGuide: (pct: number) => `用手指刮开涂层查看结果${pct > 0 ? `（${pct}%）` : ''}`,
    startScratch: '开始刮卡',
    viewResult: '查看结果',
    prizeArrived: '奖励已到账',
    noWin: '很遗憾，未中奖',
    win: '中奖啦！',
    lose: '未中奖',
    myBenefits: '我的奖品',
    nearbyStation: '附近站点',
    close: '关闭',
    scratchAgain: '再刮一张',
  },
  th: {
    defaultTitle: 'สแครตการ์ด',
    remainChances: (n: number) => `เหลือ ${n} ครั้ง`,
    scratchHint: '✦ ขูดเพื่อดูผล ✦',
    noChance: 'หมดสิทธิ์แล้ว',
    revealed: 'ขูดแล้ว',
    scratchGuide: (pct: number) => `ใช้นิ้วขูดเพื่อดูผล${pct > 0 ? ` (${pct}%)` : ''}`,
    startScratch: 'เริ่มขูด',
    viewResult: 'ดูผล',
    prizeArrived: 'ได้รับรางวัลแล้ว',
    noWin: 'เสียใจด้วย ไม่ถูกรางวัล',
    win: 'ยินดีด้วย ได้รางวัล!',
    lose: 'ไม่ถูกรางวัล',
    myBenefits: 'รางวัลของฉัน',
    nearbyStation: 'สถานีใกล้เคียง',
    close: 'ปิด',
    scratchAgain: 'ขูดอีกใบ',
  },
  en: {
    defaultTitle: 'Scratch Card',
    remainChances: (n: number) => `${n} chance${n !== 1 ? 's' : ''} left`,
    scratchHint: '✦ Scratch to reveal ✦',
    noChance: 'No chances left',
    revealed: 'Revealed',
    scratchGuide: (pct: number) => `Scratch the card to reveal your prize${pct > 0 ? ` (${pct}%)` : ''}`,
    startScratch: 'Start Scratching',
    viewResult: 'View Result',
    prizeArrived: 'Prize credited',
    noWin: 'Better luck next time',
    win: 'You won!',
    lose: 'No prize',
    myBenefits: 'My Prizes',
    nearbyStation: 'Nearby Stations',
    close: 'Close',
    scratchAgain: 'Scratch Again',
  },
}

export default function ScratchCardPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { language } = useI18n()
  const lang = language as AppLanguage
  const ui = UI[lang] || UI.en
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activity, setActivity] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [chances, setChances] = useState<number | null>(null)
  const [result, setResult] = useState<any>(null)
  const [revealed, setRevealed] = useState(false)
  const [resultVisible, setResultVisible] = useState(false)
  const [scratchStarted, setScratchStarted] = useState(false)
  const [scratchPercent, setScratchPercent] = useState(0)
  const isDrawing = useRef(false)
  const sessionId = useRef<string>('')

  const pick = (field: any): string => {
    if (!field) return ''
    if (typeof field === 'string') return field
    if (typeof field === 'object') return field[lang] || field.en || field.zh || field.th || ''
    return ''
  }

  useEffect(() => {
    const load = async () => {
      try {
        const actRes = await fetch(`${API_BASE}/api/activities/${id}`)
        const actJson = await actRes.json()
        setActivity(actJson.data || actJson)

        const startRes = await fetch(`${API_BASE}/api/activity/scratch/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity_id: id, line_user_id: getDeviceUserId() }),
        })
        const startJson = await startRes.json()
        if (startJson.data?.remaining_chances !== undefined) {
          setChances(startJson.data.remaining_chances)
        }
      } catch { setActivity(null) }
      finally { setLoading(false) }
    }
    load()
  }, [id])

  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    grad.addColorStop(0, '#c0c0c0')
    grad.addColorStop(1, '#a0a0a0')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.font = 'bold 18px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.textAlign = 'center'
    ctx.fillText(ui.scratchHint, canvas.width / 2, canvas.height / 2)
    setScratchPercent(0)
  }

  useEffect(() => {
    if (!loading) setTimeout(initCanvas, 100)
  }, [loading, ui.scratchHint])

  const startScratch = () => {
    if (scratchStarted || revealed || (chances !== null && chances <= 0)) return
    setScratchStarted(true)
  }

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const scratch = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || revealed) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e, canvas)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 24, 0, 2 * Math.PI)
    ctx.fill()

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let transparent = 0
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] === 0) transparent++
    }
    const pct = Math.round((transparent / (canvas.width * canvas.height)) * 100)
    setScratchPercent(pct)
    if (pct >= 60 && !revealed) revealResult()
  }

  const revealResult = async () => {
    setRevealed(true)
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) { ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
    }
    try {
      const res = await fetch(`${API_BASE}/api/activity/scratch/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: id, line_user_id: getDeviceUserId() }),
      })
      const json = await res.json()
      if (json.code === 200) {
        setResult(json.data || {})
        if (chances !== null) setChances(c => Math.max(0, (c ?? 1) - 1))
      } else {
        setResult({ _error: json.msg })
      }
      setTimeout(() => setResultVisible(true), 400)
    } catch {
      setResult({})
      setTimeout(() => setResultVisible(true), 400)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#fff5f5' }}>
      <Spin size="large" />
    </div>
  )

  const isNoChance = chances !== null && chances <= 0
  const isWin = result && !result._error && !result.is_thanks
  const prizeText = result?.prize?.prize_name || (isWin ? ui.prizeArrived : ui.noWin)

  const pageTitle = activity?.activity_name || activity?.activity_title || pick(activity?.name) || pick(activity?.title) || ui.defaultTitle

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #fff1e6 0%, #ffe0cc 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0 40px' }}>
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
        <button onClick={() => nav(`/activity/${id}`)} style={{ background: 'rgba(0,0,0,0.08)', border: 'none', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>
          <ArrowLeftOutlined />
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>
          {pageTitle}
        </span>
        <div style={{ width: 36 }} />
      </div>

      {chances !== null && (
        <div style={{ background: 'rgba(0,0,0,0.07)', borderRadius: 20, padding: '6px 20px', color: '#fa8c16', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          {ui.remainChances(chances)}
        </div>
      )}

      <div style={{ position: 'relative', marginTop: 24, width: 300, height: 160, borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #fff9c4, #fff176)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 40 }}>{revealed ? (isWin ? '🎁' : '😅') : '🎫'}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: isWin ? '#ff6b00' : '#666' }}>
            {revealed ? prizeText : '???'}
          </span>
        </div>
        <canvas
          ref={canvasRef}
          width={300}
          height={160}
          style={{ position: 'absolute', inset: 0, cursor: revealed ? 'default' : (isNoChance ? 'not-allowed' : 'crosshair'), touchAction: 'none' }}
          onMouseDown={e => { if (!isNoChance) { isDrawing.current = true; startScratch() } }}
          onMouseMove={e => { if (isDrawing.current) scratch(e) }}
          onMouseUp={() => { isDrawing.current = false }}
          onMouseLeave={() => { isDrawing.current = false }}
          onTouchStart={e => { if (!isNoChance) { isDrawing.current = true; startScratch(); scratch(e) } }}
          onTouchMove={e => { scratch(e) }}
          onTouchEnd={() => { isDrawing.current = false }}
        />
      </div>

      <p style={{ color: '#999', fontSize: 13, marginTop: 16, textAlign: 'center' }}>
        {isNoChance ? ui.noChance : revealed ? ui.revealed : ui.scratchGuide(scratchPercent)}
      </p>

      {!isNoChance && !scratchStarted && !revealed && (
        <button
          onClick={startScratch}
          style={{ marginTop: 12, padding: '12px 40px', background: 'linear-gradient(135deg, #fa8c16, #ffc53d)', border: 'none', borderRadius: 50, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(250,140,22,0.4)' }}
        >
          {ui.startScratch}
        </button>
      )}

      {revealed && !resultVisible && (
        <button
          onClick={() => setResultVisible(true)}
          style={{ marginTop: 12, padding: '12px 40px', background: '#1677ff', border: 'none', borderRadius: 50, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
        >
          {ui.viewResult}
        </button>
      )}

      {resultVisible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 24, padding: 32, maxWidth: 320, width: '100%', textAlign: 'center', animation: 'scaleIn 0.3s ease' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{isWin ? '🎉' : '😅'}</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{isWin ? ui.win : ui.lose}</h2>
            <p style={{ fontSize: 16, color: isWin ? '#1677ff' : '#666', marginBottom: 8, fontWeight: isWin ? 700 : 400 }}>{prizeText}</p>
            {isWin && result?.issued_product && (
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '6px 14px', marginBottom: 12, fontSize: 13, color: '#389e0d' }}>
                奖品已发放到您的账户
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setResultVisible(false); nav('/mine?tab=prizes') }} style={{ flex: 1, padding: '12px 0', background: 'linear-gradient(135deg, #1677ff, #4096ff)', border: 'none', borderRadius: 50, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                <TrophyOutlined style={{ marginRight: 4 }} />{ui.myBenefits}
              </button>
              <button onClick={() => { setResultVisible(false); nav('/nearby') }} style={{ flex: 1, padding: '12px 0', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 50, color: '#333', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                <EnvironmentOutlined style={{ marginRight: 4 }} />{ui.nearbyStation}
              </button>
            </div>
            <button
              onClick={() => {
                setResultVisible(false)
                if (!isNoChance) { setRevealed(false); setScratchStarted(false); initCanvas() }
              }}
              style={{ width: '100%', marginTop: 10, padding: '10px 0', background: 'none', border: 'none', color: '#999', fontSize: 14, cursor: 'pointer' }}
            >
              {isNoChance ? ui.close : ui.scratchAgain}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes scaleIn { from { transform: scale(0.7); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
    </div>
  )
}
