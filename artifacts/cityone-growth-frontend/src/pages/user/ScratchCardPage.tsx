import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Spin } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useI18n, type AppLanguage } from '../../i18n'
import { useEffectiveUserId } from '../../hooks/useEffectiveUserId'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const T = {
  zh: {
    defaultTitle: '刮刮卡',
    remainChances: (n: number) => `剩余次数：${n} 次`,
    noChanceBadge: '次数已用完',
    scratchHint: '用手指涂抹刮开',
    consolation: '很遗憾，未中奖',
    claimNow: '立即领取',
    scratchAgain: (n: number) => `再来一次（还剩 ${n} 次）`,
    nextTime: '下次再来',
    loading: '加载中...',
  },
  th: {
    defaultTitle: 'สแครตการ์ด',
    remainChances: (n: number) => `เหลือ ${n} ครั้ง`,
    noChanceBadge: 'หมดสิทธิ์',
    scratchHint: 'ใช้นิ้วขูดเพื่อเปิด',
    consolation: 'เสียใจด้วย ไม่ถูกรางวัล',
    claimNow: 'รับรางวัล',
    scratchAgain: (n: number) => `ขูดอีกครั้ง (เหลือ ${n} ครั้ง)`,
    nextTime: 'ไว้คราวหน้า',
    loading: 'กำลังโหลด...',
  },
  en: {
    defaultTitle: 'Scratch Card',
    remainChances: (n: number) => `${n} chance${n !== 1 ? 's' : ''} left`,
    noChanceBadge: 'No chances left',
    scratchHint: 'Scratch here to reveal',
    consolation: 'Better luck next time',
    claimNow: 'Claim Now',
    scratchAgain: (n: number) => `Try Again (${n} left)`,
    nextTime: 'Maybe Next Time',
    loading: 'Loading...',
  },
}

export default function ScratchCardPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { language } = useI18n()
  const lang = language as AppLanguage
  const ui = T[lang] || T.en
  const effectiveUserId = useEffectiveUserId()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const revealCalled = useRef(false)   // 第一次触碰卡片时调用 reveal API
  const scratchPctRef = useRef(0)

  const [activity, setActivity] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [chances, setChances] = useState<number | null>(null)
  const [result, setResult] = useState<any>(null)   // 第一次触碰后即填充
  const [scratchPct, setScratchPct] = useState(0)   // 0-100，涂抹进度
  const [showActions, setShowActions] = useState(false)  // 涂抹够了才显示操作按钮

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
            body: JSON.stringify({ activity_id: id, line_user_id: effectiveUserId }),
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

  // 初始化 canvas：铺银色涂层（覆盖在卡片内容上）
  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    grad.addColorStop(0, '#c8c8c8')
    grad.addColorStop(0.5, '#b0b0b0')
    grad.addColorStop(1, '#a0a0a0')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // 涂层上的提示文字
    ctx.font = 'bold 15px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.textAlign = 'center'
    ctx.fillText(ui.scratchHint, canvas.width / 2, canvas.height / 2)
    setScratchPct(0)
    scratchPctRef.current = 0
    revealCalled.current = false
    setResult(null)
    setShowActions(false)
  }

  useEffect(() => {
    if (!loading) setTimeout(initCanvas, 80)
  }, [loading])

  // 第一次触碰卡片：立刻调用 reveal API 获取奖品（写入底层卡片）
  const callRevealOnce = async () => {
    if (revealCalled.current) return
    revealCalled.current = true
    try {
      const res = await fetch(`${API_BASE}/api/activity/scratch/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: id, line_user_id: effectiveUserId }),
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
    }
  }

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy }
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }

  // 涂抹：每次 move 都擦除一个圆圈，实时显示下面的内容
  const eraseAt = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e, canvas)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 28, 0, 2 * Math.PI)
    ctx.fill()

    // 计算涂抹百分比
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let transparent = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++
    const pct = Math.round((transparent / (canvas.width * canvas.height)) * 100)
    setScratchPct(pct)
    scratchPctRef.current = pct

    // 涂抹超过 35% → 显示操作按钮
    if (pct >= 35 && !showActions) setShowActions(true)
  }

  const onStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (chances !== null && chances <= 0) return
    isDrawing.current = true
    callRevealOnce()   // 第一次触碰立即获取奖品（写入底层）
    eraseAt(e)
  }

  const onEnd = () => {
    isDrawing.current = false
    // 松手时 ≥20% 也显示操作按钮
    if (scratchPctRef.current >= 20) setShowActions(true)
  }

  const resetForNext = () => {
    setShowActions(false)
    setTimeout(initCanvas, 50)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(160deg, #fff1e6 0%, #ffe0cc 100%)' }}>
      <Spin size="large" />
    </div>
  )

  const noChance = chances !== null && chances <= 0
  const isWin = result && !result._error && !result.is_thanks
  const prizeName = pick(result?.prize?.prize_name) || (isWin ? '奖品已到账' : '')
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

      {/* 次数 */}
      {chances !== null && (
        <div style={{ background: noChance ? 'rgba(0,0,0,0.08)' : 'rgba(250,140,22,0.12)', borderRadius: 20, padding: '5px 18px', color: noChance ? '#aaa' : '#fa8c16', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          {noChance ? ui.noChanceBadge : ui.remainChances(chances)}
        </div>
      )}

      {/* 刮刮卡主体 */}
      <div style={{ position: 'relative', marginTop: 28, width: 300, height: 180, borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>

        {/* ── 底层：奖品内容（一直存在，只是被银色涂层遮住）── */}
        <div style={{
          position: 'absolute', inset: 0,
          background: isWin
            ? 'linear-gradient(135deg, #fff9c4, #ffe082)'
            : 'linear-gradient(135deg, #f5f5f5, #e8e8e8)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10
        }}>
          {!result ? (
            // API 还未返回（一般很快，用户几乎看不到这状态）
            <span style={{ fontSize: 32, opacity: 0.3 }}>🎫</span>
          ) : isWin ? (
            <>
              <span style={{ fontSize: 44 }}>🎁</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#e65c00', textAlign: 'center', padding: '0 16px', lineHeight: 1.4 }}>
                {prizeName}
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 44 }}>😅</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#888', textAlign: 'center', padding: '0 16px' }}>
                {ui.consolation}
              </span>
            </>
          )}
        </div>

        {/* ── 银色涂层 Canvas（覆盖在奖品上，刮哪显哪）── */}
        {!noChance && (
          <canvas
            ref={canvasRef}
            width={300}
            height={180}
            style={{ position: 'absolute', inset: 0, cursor: 'crosshair', touchAction: 'none', borderRadius: 20 }}
            onMouseDown={e => onStart(e)}
            onMouseMove={e => { if (isDrawing.current) eraseAt(e) }}
            onMouseUp={onEnd}
            onMouseLeave={onEnd}
            onTouchStart={e => onStart(e)}
            onTouchMove={e => { if (isDrawing.current) eraseAt(e) }}
            onTouchEnd={onEnd}
          />
        )}
      </div>

      {/* 涂抹进度提示（涂抹中显示百分比，提示用户进度） */}
      {scratchPct > 0 && !showActions && (
        <p style={{ color: '#fa8c16', fontSize: 13, fontWeight: 600, marginTop: 12, textAlign: 'center' }}>
          {scratchPct}%
        </p>
      )}

      {/* ── 操作按钮（涂抹 ≥20% 后出现）── */}
      {showActions && result && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 24, width: '100%', maxWidth: 320, padding: '0 20px', animation: 'fadeUp 0.3s ease' }}>

          {/* 中奖 → 立即领取 */}
          {isWin && (
            <button
              onClick={() => nav('/mine?tab=prizes')}
              style={{ width: '100%', padding: '15px 0', background: 'linear-gradient(135deg, #fa8c16, #ffc53d)', border: 'none', borderRadius: 50, color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(250,140,22,0.45)', letterSpacing: 1 }}
            >
              🎁 {ui.claimNow}
            </button>
          )}

          {/* 未中奖 + 有次数 → 再来一次 */}
          {!isWin && chances !== null && chances > 0 && (
            <button
              onClick={resetForNext}
              style={{ width: '100%', padding: '15px 0', background: 'linear-gradient(135deg, #fa8c16, #ffc53d)', border: 'none', borderRadius: 50, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 20px rgba(250,140,22,0.4)' }}
            >
              🎴 {ui.scratchAgain(chances)}
            </button>
          )}

          {/* 中奖后 或 次数用完 → 下次再来 */}
          {(isWin || noChance) && (
            <button
              onClick={() => nav(`/activity/${id}`)}
              style={{ width: '100%', padding: '13px 0', background: 'rgba(0,0,0,0.04)', border: '1px solid #e0e0e0', borderRadius: 50, color: '#888', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              {ui.nextTime}
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  )
}
