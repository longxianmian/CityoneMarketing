/**
 * useFollowGate — 关注门控统一 Hook
 *
 * 粉丝验证逻辑集中管理：
 * - 页面挂载时异步预查粉丝状态，消除点击延迟
 * - guard(action, opts) 包裹任何互动操作
 *   - 已关注 → 直接执行 action
 *   - 未关注 → 跳转关注引导页，关注后自动回跳并触发操作
 *
 * 归因参数（entry_code + UTM）在未关注跳转时自动透传
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getDeviceUserId } from '../utils/deviceUserId'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

async function fetchFanStatus(userId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE}/api/user/check-follow?user_id=${encodeURIComponent(userId)}`
    )
    const json = await res.json()
    return json?.data?.is_fan === true
  } catch {
    return false
  }
}

interface GuardOptions {
  label?: string
  returnPath: string
  back?: string
}

export function useFollowGate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isFan, setIsFan] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    fetchFanStatus(getDeviceUserId()).then(setIsFan)
  }, [])

  /**
   * 构建带归因参数的完整回跳 URL
   * returnPath 例如 '/coupon/xxx?auto=claim'
   */
  const buildReturnPath = useCallback(
    (base: string) => {
      const entryCode = searchParams.get('entry_code') || ''
      const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']
      const utmParts = utmKeys
        .filter((k) => searchParams.get(k))
        .map((k) => `${k}=${encodeURIComponent(searchParams.get(k)!)}`)
      const attrParts = [
        entryCode ? `entry_code=${encodeURIComponent(entryCode)}` : '',
        ...utmParts,
      ].filter(Boolean)
      if (!attrParts.length) return base
      return `${base}${base.includes('?') ? '&' : '?'}${attrParts.join('&')}`
    },
    [searchParams]
  )

  /**
   * guard(action, opts)
   *
   * @param action   已关注时执行的操作函数
   * @param opts.label       展示在关注引导页的操作名（如"立即领取"）
   * @param opts.returnPath  关注完成后的回跳目标（含 auto 参数触发自动操作）
   * @param opts.back        关注页"返回"按钮的路径（缺省 = returnPath 无 auto 参数）
   */
  const guard = useCallback(
    async (action: () => void | Promise<void>, opts: GuardOptions) => {
      const { label = '', returnPath, back } = opts
      setChecking(true)
      try {
        const userId = getDeviceUserId()
        const fan = isFan !== null ? isFan : await fetchFanStatus(userId)
        if (isFan === null) setIsFan(fan)

        if (fan) {
          await action()
        } else {
          const fullReturn = buildReturnPath(returnPath)
          const params = new URLSearchParams({
            to: fullReturn,
            name: label,
            back: back ?? returnPath.split('?')[0],
          })
          navigate(`/follow-oa?${params.toString()}`)
        }
      } finally {
        setChecking(false)
      }
    },
    [isFan, navigate, buildReturnPath]
  )

  return { isFan, guard, checking }
}
