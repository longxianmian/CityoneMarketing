import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Spin } from 'antd'
import { ArrowLeftOutlined, TrophyOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { useI18n, type AppLanguage } from '../../i18n'
import { getDeviceUserId } from '../../utils/deviceUserId'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const FORTUNE_COLORS: Record<string, { bg: string; text: string; label: Record<string, string> }> = {
  great: { bg: '#ff4d4f', text: '#fff', label: { zh: '大吉', th: 'มหาดี', en: 'Great Fortune' } },
  good:  { bg: '#fa8c16', text: '#fff', label: { zh: '吉',   th: 'ดี',    en: 'Good Fortune' } },
  medium:{ bg: '#1677ff', text: '#fff', label: { zh: '中吉', th: 'ปานกลาง', en: 'Medium Fortune' } },
  small: { bg: '#52c41a', text: '#fff', label: { zh: '小吉', th: 'เล็กน้อย', en: 'Small Fortune' } },
  bad:   { bg: '#8c8c8c', text: '#fff', label: { zh: '凶',   th: 'ไม่ดี',  en: 'Bad Fortune' } },
}

const UI = {
  zh: {
    defaultTitle: '泰式祈福抽签',
    remainChances: (n: number) => `剩余次数：${n} 次`,
    noChance: '次数已用完',
    drawing: '求签中...',
    drawHint: '点击签筒\n虔诚祈福后抽取',
    drawBtn: '求签祈福',
    resultNo: (no: string | number) => `第${no}签`,
    resultDefault: '结果',
    myBenefits: '我的奖品',
    nearbyStation: '附近站点',
    close: '关闭',
    drawAgain: '再求一签',
    errorPoem: '暂时无法获取签文，请稍后再试。',
    errorName: '中吉',
  },
  th: {
    defaultTitle: 'จับฉลากมงคลไทย',
    remainChances: (n: number) => `เหลือ ${n} ครั้ง`,
    noChance: 'หมดสิทธิ์แล้ว',
    drawing: 'กำลังจับฉลาก...',
    drawHint: 'แตะกระบอกฉลาก\nอธิษฐานแล้วจับ',
    drawBtn: 'จับฉลาก',
    resultNo: (no: string | number) => `ฉลากที่ ${no}`,
    resultDefault: 'ผล',
    myBenefits: 'รางวัลของฉัน',
    nearbyStation: 'สถานีใกล้เคียง',
    close: 'ปิด',
    drawAgain: 'จับอีกครั้ง',
    errorPoem: 'ขอโทษ ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่',
    errorName: 'ปานกลาง',
  },
  en: {
    defaultTitle: 'Thai Fortune Draw',
    remainChances: (n: number) => `${n} chance${n !== 1 ? 's' : ''} left`,
    noChance: 'No chances left',
    drawing: 'Drawing...',
    drawHint: 'Tap the tube\nPray and draw your fortune',
    drawBtn: 'Draw Fortune',
    resultNo: (no: string | number) => `Fortune #${no}`,
    resultDefault: 'Result',
    myBenefits: 'My Prizes',
    nearbyStation: 'Nearby Stations',
    close: 'Close',
    drawAgain: 'Draw Again',
    errorPoem: 'Unable to retrieve fortune text. Please try again later.',
    errorName: 'Medium Fortune',
  },
}

export default function ThaiFortuneDrawPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { language } = useI18n()
  const lang = language as AppLanguage
  const ui = UI[lang] || UI.en
  const [activity, setActivity] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [chances, setChances] = useState<number | null>(null)
  const [themes, setThemes] = useState<any[]>([])
  const [selectedTheme, setSelectedTheme] = useState<any>(null)
  const [drawing, setDrawing] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [resultVisible, setResultVisible] = useState(false)

  const pick = (field: any): string => {
    if (!field) return ''
    if (typeof field === 'string') return field
    if (typeof field === 'object') return field[lang] || field.en || field.zh || field.th || ''
    return ''
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, tRes] = await Promise.all([
          fetch(`${API_BASE}/api/activities/${id}`).then(r => r.json()),
          fetch(`${API_BASE}/api/activities/${id}/fortune-themes`).then(r => r.json()),
        ])
        const data = aRes.data || aRes
        setActivity(data)
        setChances(data.userChances ?? null)
        const themeList = tRes.data || tRes || []
        setThemes(themeList)
        if (themeList.length > 0) setSelectedTheme(themeList[0])
      } catch { setActivity(null) }
      finally { setLoading(false) }
    }
    load()
  }, [id])

  const handleDraw = async () => {
    if (drawing || (chances !== null && chances <= 0)) return
    setDrawing(true)
    setShaking(true)
    setTimeout(() => setShaking(false), 1200)

    await new Promise(r => setTimeout(r, 1400))

    try {
      const res = await fetch(`${API_BASE}/api/activity/fortune/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: id, line_user_id: getDeviceUserId(), themeId: selectedTheme?.id }),
      })
      const json = await res.json()
      const data = json.data || {}
      setResult(data)
      if (chances !== null) setChances(c => Math.max(0, (c ?? 1) - 1))
      setResultVisible(true)
    } catch {
      setResult({ fortuneType: 'medium', signNo: '?', poem_zh: ui.errorPoem, name: ui.errorName })
      setResultVisible(true)
    } finally {
      setDrawing(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#1a0000' }}>
      <Spin size="large" />
    </div>
  )

  const bgColor = selectedTheme?.bgColor || '#8b1a1a'
  const isNoChance = chances !== null && chances <= 0
  const resultFortune = FORTUNE_COLORS[result?.fortuneType] || FORTUNE_COLORS.medium
  const resultLabel = resultFortune.label[lang] || resultFortune.label.en
  const pageTitle = activity?.activity_name || activity?.activity_title || pick(activity?.name) || ui.defaultTitle

  const poemText = (() => {
    if (!result) return ''
    if (lang === 'th' && result.poem_th) return result.poem_th
    if (lang === 'en' && result.poem_en) return result.poem_en
    return result.poem_zh || ''
  })()

  const interpretationText = (() => {
    if (!result) return ''
    if (lang === 'th' && result.interpretation_th) return result.interpretation_th
    if (lang === 'en' && result.interpretation_en) return result.interpretation_en
    return result.interpretation_zh || ''
  })()

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(160deg, ${bgColor} 0%, #1a0000 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 40 }}>
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
        <button onClick={() => nav(-1)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <ArrowLeftOutlined />
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 700, color: '#fff' }}>
          {pageTitle}
        </span>
        <div style={{ width: 36 }} />
      </div>

      {themes.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {themes.map((t: any) => (
            <button
              key={t.id}
              onClick={() => setSelectedTheme(t)}
              style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: selectedTheme?.id === t.id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                color: selectedTheme?.id === t.id ? bgColor : '#fff',
                border: 'none', transition: 'all 0.2s',
              }}
            >
              {pick(t.name) || t.name}
            </button>
          ))}
        </div>
      )}

      {chances !== null && (
        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '6px 20px', color: '#ffd93d', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          {ui.remainChances(chances)}
        </div>
      )}

      <div
        className={shaking ? 'fortune-shake' : ''}
        style={{ position: 'relative', width: 100, height: 220, cursor: isNoChance ? 'not-allowed' : 'pointer', filter: drawing ? 'blur(1px)' : 'none', transition: 'filter 0.2s' }}
        onClick={handleDraw}
      >
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #d4a843, #8b6914)', borderRadius: '50px 50px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 2px 8px rgba(255,255,255,0.2)' }}>
          <div style={{ width: 60, height: 200, position: 'absolute', top: 10, background: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 12px)', borderRadius: '46px 46px 6px 6px' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#4a2600', letterSpacing: 1 }}>签</span>
        </div>
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ width: 3, height: 28, background: `hsl(${40 + i * 5}, 70%, ${30 + i * 4}%)`, borderRadius: 2, transform: `translateX(${(i - 3.5) * 5}px) rotate(${(i - 3.5) * 3}deg)`, transition: 'transform 0.1s', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
          ))}
        </div>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 20, textAlign: 'center', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
        {isNoChance ? ui.noChance : drawing ? ui.drawing : ui.drawHint}
      </p>

      <button
        onClick={handleDraw}
        disabled={drawing || isNoChance}
        style={{
          marginTop: 16, padding: '14px 48px', fontSize: 17, fontWeight: 700,
          background: isNoChance ? 'rgba(255,255,255,0.2)' : drawing ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)',
          border: 'none', borderRadius: 50, color: isNoChance ? 'rgba(255,255,255,0.5)' : bgColor,
          cursor: isNoChance || drawing ? 'not-allowed' : 'pointer',
          boxShadow: isNoChance || drawing ? 'none' : '0 4px 20px rgba(255,255,255,0.3)',
          transition: 'all 0.2s',
        }}
      >
        {drawing ? ui.drawing : isNoChance ? ui.noChance : ui.drawBtn}
      </button>

      {resultVisible && result && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 24, maxWidth: 340, width: '100%', overflow: 'hidden', animation: 'scaleIn 0.3s ease' }}>
            <div style={{ background: resultFortune.bg, padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: resultFortune.text, letterSpacing: 4, textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                {result.signNo ? ui.resultNo(result.signNo) : ui.resultDefault}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: resultFortune.text, marginTop: 8, opacity: 0.9 }}>
                {pick(result.name) || resultLabel}
              </div>
              <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 16px', marginTop: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: resultFortune.text }}>{resultLabel}</span>
              </div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {poemText && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <p style={{ fontSize: lang === 'th' ? 16 : 15, color: '#333', lineHeight: 2, fontStyle: lang === 'th' ? 'italic' : 'normal', margin: 0 }}>
                    {poemText}
                  </p>
                </div>
              )}
              {interpretationText && (
                <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: '#666', lineHeight: 1.8, margin: 0 }}>
                    {interpretationText}
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setResultVisible(false); nav('/mine?tab=prizes') }} style={{ flex: 1, padding: '12px 0', background: resultFortune.bg, border: 'none', borderRadius: 50, color: resultFortune.text, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  <TrophyOutlined style={{ marginRight: 4 }} />{ui.myBenefits}
                </button>
                <button onClick={() => { setResultVisible(false); nav('/nearby') }} style={{ flex: 1, padding: '12px 0', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 50, color: '#333', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  <EnvironmentOutlined style={{ marginRight: 4 }} />{ui.nearbyStation}
                </button>
              </div>
              <button onClick={() => { setResultVisible(false) }} style={{ width: '100%', marginTop: 10, padding: '10px 0', background: 'none', border: 'none', color: '#999', fontSize: 14, cursor: 'pointer' }}>
                {isNoChance ? ui.close : ui.drawAgain}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scaleIn { from { transform: scale(0.7); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes shake {
          0%,100% { transform: rotate(0deg) translateY(0) }
          10% { transform: rotate(-8deg) translateY(-4px) }
          20% { transform: rotate(8deg) translateY(-8px) }
          30% { transform: rotate(-6deg) translateY(-6px) }
          40% { transform: rotate(6deg) translateY(-10px) }
          50% { transform: rotate(-4deg) translateY(-8px) }
          60% { transform: rotate(4deg) translateY(-6px) }
          70% { transform: rotate(-2deg) translateY(-4px) }
          80% { transform: rotate(2deg) translateY(-2px) }
          90% { transform: rotate(-1deg) translateY(-1px) }
        }
        .fortune-shake { animation: shake 1.2s ease; }
      `}</style>
    </div>
  )
}
