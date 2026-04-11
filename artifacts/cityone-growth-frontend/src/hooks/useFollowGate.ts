/**
 * useFollowGate — 关注门控统一 Hook
 *
 * 粉丝验证优先级：
 *   1. LIFF getFriendship()（最权威）— 用户无论通过哪个系统关注 OA 都有效
 *      同事已通过 A 系统关注同一 OA → LIFF 返回 friendFlag:true → 直接放行
 *   2. 后端 fans.json（LIFF 未初始化/不在 LINE 内时的降级）
 *
 * LIFF 确认为粉丝时自动调用 set-fan，将用户写入 fans.json，
 * 消除增长系统与 A 系统粉丝数据的裂缝。
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getDeviceUserId } from '../utils/deviceUserId'
import useLineUserStore from '../store/lineUser'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

async function fetchFanStatus(userId: string): Promise<boolean> {
  if (!userId) return false
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

/** 当 LIFF 确认是粉丝时，顺手同步到 fans.json，避免后端数据裂缝 */
function syncFanToBackend(lineUserId: string, displayName: string, pictureUrl: string) {
  const userId = lineUserId || getDeviceUserId()
  fetch(`${API_BASE}/api/user/set-fan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      line_user_id: lineUserId || userId,
      line_display_name: displayName,
      line_picture_url: pictureUrl,
    }),
  }).catch(() => {})
}

interface GuardOptions {
  label?: string
  returnPath: string
  back?: string
}

export function useFollowGate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lineProfile = useLineUserStore((s) => s.profile)
  const [isFan, setIsFan] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const syncedRef = useRef(false)  // 避免重复触发 set-fan

  const getEffectiveUserId = useCallback((): string => {
    return lineProfile?.lineUserId || getDeviceUserId()
  }, [lineProfile?.lineUserId])

  useEffect(() => {
    const liffIsFriend = lineProfile?.isFriend

    // ① LIFF 官方 getFriendship() 返回 true → 直接认定为粉丝（最权威）
    if (liffIsFriend === true) {
      setIsFan(true)
      // 顺手同步到 fans.json（消除两套系统数据裂缝，幂等安全）
      if (!syncedRef.current) {
        syncedRef.current = true
        syncFanToBackend(
          lineProfile?.lineUserId || '',
          lineProfile?.lineDisplayName || '',
          lineProfile?.linePictureUrl || '',
        )
      }
      return
    }

    // ② LIFF 明确返回 false（在 LINE 内但未关注）
    if (liffIsFriend === false) {
      setIsFan(false)
      return
    }

    // ③ LIFF 未初始化 / 不在 LINE 内（isFriend === undefined）→ 查后端 fans.json
    fetchFanStatus(getEffectiveUserId()).then(setIsFan)
  }, [
    getEffectiveUserId,
    lineProfile?.isFriend,
    lineProfile?.lineUserId,
    lineProfile?.lineDisplayName,
    lineProfile?.linePictureUrl,
  ])

  /**
   * 构建带归因参数的完整回跳 URL
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
        const liffIsFriend = lineProfile?.isFriend
        let fan: boolean

        if (liffIsFriend === true) {
          // LIFF 官方确认：已关注（A 系统关注的也算）
          fan = true
        } else if (liffIsFriend === false) {
          // LIFF 官方确认：未关注
          fan = false
        } else {
          // LIFF 未初始化降级
          fan = isFan !== null ? isFan : await fetchFanStatus(getEffectiveUserId())
          if (isFan === null) setIsFan(fan)
        }

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
    [isFan, navigate, buildReturnPath, getEffectiveUserId, lineProfile?.isFriend]
  )

  return { isFan, guard, checking }
}
