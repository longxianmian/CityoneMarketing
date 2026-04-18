/**
 * FollowOAPage — 已降级为过渡重定向页
 *
 * 主流程不再主动跳此页。
 * 若已携带 intent，直接过渡到 /welfare/continue。
 * 未携带 intent 时，直接回到 /welfare，不再写旧恢复键。
 */
import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function FollowOAPage() {
  const navigate = useNavigate()
  const [params]  = useSearchParams()

  useEffect(() => {
    const intent = params.get('intent') || ''
    if (intent) {
      navigate(`/welfare/continue?intent=${encodeURIComponent(intent)}`, { replace: true })
      return
    }
    navigate('/welfare', { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 渲染空白过渡（重定向极快，用户几乎看不到）
  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fef4' }}>
      <div style={{ color: '#06c755', fontSize: 14 }}>…</div>
    </div>
  )
}
