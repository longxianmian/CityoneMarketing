/**
 * FollowOAPage — 已降级为过渡重定向页
 *
 * 主流程不再主动跳此页。
 * 旧链接（分享码、短信、外链）进入时：
 *   1. 把 URL 参数写入 cityone_resume_* 恢复键
 *   2. 立即 replace 到 /welfare
 *   3. /welfare 的身份恢复器全权接管：getProfile → getFriendship → 关注弹层 or navigate(returnPath)
 */
import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function FollowOAPage() {
  const navigate = useNavigate()
  const [params]  = useSearchParams()

  useEffect(() => {
    const to   = params.get('to')   || '/welfare'
    const name = params.get('name') || ''
    const back = params.get('back') || '/welfare'

    // 写入恢复键，供 /welfare 恢复器读取
    sessionStorage.setItem('cityone_resume_pending', '1')
    sessionStorage.setItem('cityone_resume_return_path', to)
    sessionStorage.setItem('cityone_resume_back_path', back)
    if (name) {
      sessionStorage.setItem('cityone_resume_action', name)
      sessionStorage.setItem('cityone_resume_name', name)
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
