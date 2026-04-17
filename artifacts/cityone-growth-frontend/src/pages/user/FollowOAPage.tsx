/**
 * FollowOAPage — 已降级为过渡重定向页
 *
 * 主流程不再主动跳此页。
 * 新链路若已携带 intent，直接过渡到 /welfare/continue。
 * 旧链接（分享码、短信、外链）若仍只带 to/back/name，则暂时保留旧恢复键兼容。
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

    const to   = params.get('to')   || '/welfare'
    const name = params.get('name') || ''
    const back = params.get('back') || '/welfare'

    // 写入恢复键（localStorage 保证跨 LIFF 跳转后不丢失），供 /welfare 恢复器读取
    localStorage.setItem('cityone_resume_pending', '1')
    localStorage.setItem('cityone_resume_return_path', to)
    localStorage.setItem('cityone_resume_back_path', back)
    if (name) {
      localStorage.setItem('cityone_resume_action', name)
      localStorage.setItem('cityone_resume_name', name)
    }

    // 立即跳到 /welfare，恢复器在那里接管
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
