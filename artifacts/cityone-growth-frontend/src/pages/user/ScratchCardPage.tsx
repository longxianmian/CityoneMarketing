import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Spin } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useI18n, type AppLanguage } from '../../i18n'
import { getDeviceUserId } from '../../utils/deviceUserId'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const T = {
  zh: {
    defaultTitle: '刮刮卡',
    remainChances: (n: number) => `剩余次数：${n} 次`,
    scratchHint: '✦ 用手指刮开涂层 ✦',
    noChanceBadge: '次数已用完',
    consolation: '还差一点点，再来一次！',
    winLabel: '中奖啦！',
    prizeArrived: '奖励已到账',
    claimNow: '立即领取',
    scratchAgain: (n: number) => `再来一次（还剩 ${n} 次）`,
    nextTime: '下次再来',
    loading: '正在揭晓...',
  },
  th: {
    defaultTitle: 'สแครตการ์ด',
    remainChances: (n: number) => `เหลือ ${n} ครั้ง`,
    scratchHint: '✦ ขูดด้วยนิ้วของคุณ ✦',
    noChanceBadge: 'หมดสิทธิ์',
    consolation: 'เกือบได้แล้ว ลองอีกครั้ง!',
    winLabel: 'ยินดีด้วย ได้รางวัล!',
    prizeArrived: 'ได้รับรางวัลแล้ว',
    claimNow: 'รับรางวัล',
    scratchAgain: (n: number) => `ขูดอีกครั้ง (เหลือ ${n} ครั้ง)`,
    nextTime: 'ไว้คราวหน้า',
    loading: 'กำลังเปิดเผย...',
  },
  en: {
    defaultTitle: 'Scratch Card',
    remainChances: (n: number) => `${n} chance${n !== 1 ? 's' : ''} left`,
    scratchHint: '✦ Scratch with your finger ✦',
    noChanceBadge: 'No chances left',
    consolation: 'So close! Try again!',
    winLabel: 'You Won!',
    prizeArrived: 'Prize credited to your account',
    claimNow: 'Claim Now',
    scratchAgain: (n: number) => `Try Again (${n} left)`,
    nextTime: 'Maybe Next Time',
    loading: 'Revealing...',
  },
}

export default function ScratchCardPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { language } = useI18n()
  const lang = language as AppLanguage
  const ui = T[lang] || T.en
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const hasRevealed = useRef(false)

  const [activity, setActivity] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [chances, setChances] = useState<number | null>(null)
  const [result, setResult] = useState<any>(null)
  const [revealed, setRevealed] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [scratchPct, setScratchPct] = useState(0)

  const pick = (field: any): string => {
    if (!field) return ''
    if (typeof field === 'string') return field
    if (typeof field === 'object') return field[lang] || field.en || field.zh || field.th || ''
    return ''
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [actRes, startRes] = await Promise.all([
          fetch(`${API_BASE}/api/activities/${id}`),
          fetch(`${API_BASE}/api/activity/scratch/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity_id: id, line_user_id: getDeviceUserId() }),
          }),
        ])
        const actJson = await actRes.json()
        setActivity(actJson.data || actJson)
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
    grad.addColorStop(0, '#c8c8c8')
    grad.addColorStop(1, '#a8a8a8')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.font = 'bold 16px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.textAlign = 'center'
    ctx.fillText(ui.scratchHint, canvas.width / 2, canvas.height / 2)
    setScratchPct(0)
    hasRevealed.current = false
  }

  useEffect(() => {
    if (!loading) setTimeout(initCanvas, 80)
  }, [loading])

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy }
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }

  const eraseAt = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || revealed || revealing) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e, canvas)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 26, 0, 2 * Math.PI)
    ctx.fill()

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let transparent = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++
    const pct = Math.round((transparent / (canvas.width * canvas.height)) * 100)
    setScratchPct(pct)

    if (pct >= 60 && !hasRevealed.current) {
      hasRevealed.current = true
      doReveal(canvas)
    }
  }

  const doReveal = async (canvas: HTMLCanvasElement) => {
    setRevealing(true)
    // 立即清除剩余遮罩
    const ctx = canvas.getContext('2d')
    if (ctx) { ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
    setRevealed(true)
    try {
      const res = await fetch(`${API_BASE}/api/activity/scratch/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: id, line_user_id: getDeviceUserId() }),
      })
      const json = await res.json()
      if (json.code === 200) {
        setResult(json.data || {})
        setChances(c => Math.max(0, (c ?? 1) - 1))
      } else {
        setResult({ _error: json.msg })
      }
    } catch {
      setResult({})
    } finally {
      setRevealing(false)
    }
  }

  const resetForNext = () => {
    setRevealed(false)
    setRevealing(false)
    setResult(null)
    setTimeout(initCanvas, 50)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(160deg, #fff1e6 0%, #ffe0cc 100%)' }}>
      <Spin size="large" />
    </div>
  )

  const noChance = chances !== null && chances <= 0
  const isWin = result && !result._error && !result.is_thanks
  const prizeName = pick(result?.prize?.prize_name) || (isWin ? ui.prizeArrived : '')
  const pageTitle = pick(activity?.activity_name) || pick(activity?.activity_title) || ui.defaultTitle

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #fff1e6 0%, #ffe0cc 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 60 }}>

      {/* 顶栏 */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
        <button onClick={() => nav(`/activity/${id}`)} style={{ background: 'rgba(0,0,0,0.08)', border: 'none', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>
          <ArrowLeftOutlined />
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>{pageTitle}</span>
        <div style={{ width: 36 }} />
      </div>

      {/* 次数徽章 */}
      {chances !== null && (
        <div style={{ background: noChance ? 'rgba(0,0,0,0.08)' : 'rgba(250,140,22,0.12)', borderRadius: 20, padding: '5px 18px', color: noChance ? '#aaa' : '#fa8c16', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          {noChance ? ui.noChanceBadge : ui.remainChances(chances)}
        </div>
      )}

      {/* 刮刮卡 */}
      <div style={{ position: 'relative', marginTop: 28, width: 300, height: 170, borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>

        {/* 卡片底层内容 */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #fffde7, #fff9c4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {revealing ? (
            <>
              <span style={{ fontSize: 36 }}>✨</span>
              <span style={{ fontSize: 15, color: '#fa8c16', fontWeight: 600 }}>{ui.loading}</span>
            </>
          ) : revealed && result ? (
            isWin ? (
              <>
                <span style={{ fontSize: 40 }}>🎁</span>
                <span style={{ fontSize: 17, fontWeight: 800, color: '#e65c00', textAlign: 'center', padding: '0 12px', lineHeight: 1.4 }}>{prizeName}</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 36 }}>😅</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fa8c16', textAlign: 'center', padding: '0 12px' }}>
                  {ui.consolation}
                </span>
              </>
            )
          ) : (
            <>
              <span style={{ fontSize: 40 }}>🎫</span>
              <span style={{ fontSize: 14, color: '#bbb' }}>???</span>
            </>
          )}
        </div>

        {/* 刮涂层 Canvas */}
        {!revealed && (
          <canvas
            ref={canvasRef}
            width={300}
            height={170}
            style={{ position: 'absolute', inset: 0, cursor: noChance ? 'not-allowed' : 'crosshair', touchAction: 'none' }}
            onMouseDown={() => { if (!noChance) isDrawing.current = true }}
            onMouseMove={e => { if (isDrawing.current) eraseAt(e) }}
            onMouseUp={() => { isDrawing.current = false }}
            onMouseLeave={() => { isDrawing.current = false }}
            onTouchStart={e => { if (!noChance) { isDrawing.current = true; eraseAt(e) } }}
            onTouchMove={e => eraseAt(e)}
            onTouchEnd={() => { isDrawing.current = false }}
          />
        )}
      </div>

      {/* 刮中提示 */}
      {!revealed && !revealing && (
        <p style={{ color: '#bbb', fontSize: 13, marginTop: 14, textAlign: 'center' }}>
          {noChance ? ui.noChanceBadge : scratchPct > 0 ? `${scratchPct}%` : ui.scratchHint}
        </p>
      )}

      {/* ── 结果操作区 ── */}
      {revealed && result && !revealing && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 28, width: '100%', maxWidth: 320, padding: '0 20px' }}>

          {/* 中奖 → 立即领取 */}
          {isWin && (
            <button
              onClick={() => nav('/mine?tab=prizes')}
              style={{ width: '100%', padding: '15px 0', background: 'linear-gradient(135deg, #fa8c16, #ffc53d)', border: 'none', borderRadius: 50, color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(250,140,22,0.45)', letterSpacing: 1 }}
            >
              🎁 {ui.claimNow}
            </button>
          )}

          {/* 未中奖且有次数 → 再来一次 */}
          {!isWin && chances !== null && chances > 0 && (
            <button
              onClick={resetForNext}
              style={{ width: '100%', padding: '15px 0', background: 'linear-gradient(135deg, #fa8c16, #ffc53d)', border: 'none', borderRadius: 50, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 20px rgba(250,140,22,0.4)' }}
            >
              🎴 {ui.scratchAgain(chances)}
            </button>
          )}

          {/* 次数用完 或 中奖后 → 下次再来 */}
          {(noChance || isWin) && (
            <button
              onClick={() => nav(`/activity/${id}`)}
              style={{ width: '100%', padding: '13px 0', background: 'rgba(0,0,0,0.04)', border: '1px solid #e0e0e0', borderRadius: 50, color: '#888', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              {ui.nextTime}
            </button>
          )}
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </div>
  )
}
