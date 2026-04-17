/**
 * useFollowGate — 关注门控统一 Hook
 *
 * 身份建立优先级（LINE 主链路）：
 *   1. 若 LINE 身份尚未建立（lineUserId/liffReady/isFriend 任一缺失）
 *      → 写 cityone_resume_* 恢复键 → 跳 LIFF URL 正门
 *        LIFF 初始化完成后落到 /welfare，/welfare 恢复器接管身份建立 + 关注验证
 *   2. 若 LINE 身份已建立 且 isFriend === true → 直接执行业务动作
 *   3. 若 LINE 身份已建立 且 isFriend === false
 *      → 写 cityone_resume_* → navigate('/welfare')，/welfare 内显示关注弹层
 *   4. 若尚未建立 LINE 身份（无论在 LINE 内还是普通浏览器）
 *      → 优先跳正式 LIFF 建立真实身份，再由 /welfare 恢复器接管后续动作
 *   5. 仅当 LIFF/LINE 配置缺失时，非 LINE 浏览器才允许退回 dev 设备身份降级
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { message } from 'antd'
import { getDeviceUserId } from '../utils/deviceUserId'
import useLineUserStore from '../store/lineUser'
import { useLiff } from '../providers/LiffProvider'
import { getRuntimeLineConfig, resolveRuntimeLiffUrl } from '../lib/line'

const API_BASE  = import.meta.env.VITE_API_BASE_URL || ''

// localStorage 恢复键（跨 LIFF 页面销毁/重载均可恢复，与 WelfareHomePage 共享）
// 注意：必须用 localStorage，sessionStorage 在 LIFF 跨域跳转后会丢失
const SK_PENDING     = 'cityone_resume_pending'
const SK_RETURN_PATH = 'cityone_resume_return_path'
const SK_BACK_PATH   = 'cityone_resume_back_path'
const SK_ACTION      = 'cityone_resume_action'
const SK_NAME        = 'cityone_resume_name'
const SK_AT         = 'cityone_resume_at'
const RESUME_TTL_MS = 5 * 60 * 1000

export function hasFreshResumePending(storage: Pick<Storage, 'getItem'> = localStorage) {
  const pending = storage.getItem(SK_PENDING) === '1'
  if (!pending) return false
  const rawAt = storage.getItem(SK_AT)
  const at = Number(rawAt || 0)
  if (!Number.isFinite(at) || at <= 0) return false
  return Date.now() - at <= RESUME_TTL_MS
}

export function writeResumeKeys(returnPath: string, back: string, label: string) {
  localStorage.setItem(SK_PENDING, '1')
  localStorage.setItem(SK_AT, String(Date.now()))
  localStorage.setItem(SK_RETURN_PATH, returnPath)
  localStorage.setItem(SK_BACK_PATH, back)
  if (label) localStorage.setItem(SK_ACTION, label)
  if (label) localStorage.setItem(SK_NAME, label)
}

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
  const { liffReady, inLineClient } = useLiff()
  const [isFan, setIsFan] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const syncedRef = useRef(false)

  // 判断是否在 LINE 客户端（LIFF 初始化前也需判断）
  const isInLine = inLineClient || /Line\/\d/i.test(navigator.userAgent)

  useEffect(() => {
    const liffIsFriend = lineProfile?.isFriend

    if (liffIsFriend === true) {
      setIsFan(true)
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

    if (liffIsFriend === false) {
      setIsFan(false)
      return
    }

    // LIFF 未初始化 / 不在 LINE 内 → 查后端（仅非 LINE 环境降级）
    if (!isInLine) {
      fetchFanStatus(getDeviceUserId()).then(setIsFan)
    }
  }, [
    isInLine,
    lineProfile?.isFriend,
    lineProfile?.lineUserId,
    lineProfile?.lineDisplayName,
    lineProfile?.linePictureUrl,
  ])

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
   * 调用方无需关心身份建立逻辑，只需传入：
   * @param action      已关注时执行的业务动作
   * @param opts.label       操作名（如"立即领取"），用于关注引导弹层展示
   * @param opts.returnPath  关注完成后回跳目标（含 auto 参数触发自动动作）
   * @param opts.back        "返回"按钮路径
   */
  const guard = useCallback(
    async (action: () => void | Promise<void>, opts: GuardOptions) => {
      const { label = '', returnPath, back } = opts
      setChecking(true)
      try {
        const fullReturn = buildReturnPath(returnPath)
        const backPath   = back ?? returnPath.split('?')[0]

        // ── Case 1: LIFF 已确认是粉丝 → 直接执行 ────────────────────────
        if (lineProfile?.isFriend === true) {
          await action()
          return
        }

        // ── Case 2: LINE 身份已建立 + LIFF 确认未关注 → /welfare 显示关注弹层
        if (lineProfile?.lineUserId && liffReady && lineProfile?.isFriend === false) {
          writeResumeKeys(fullReturn, backPath, label)
          navigate('/welfare')
          return
        }

        // ── Case 3: LINE 身份尚未建立（任一条件缺失）
        //    → 不论 LINE 内还是普通浏览器，都优先跳正式 LIFF 建立真实身份
        //    → 避免 Chrome 里先用 dev_* 设备身份误判“未关注”
        //
        //    正确格式：https://liff.line.me/{liffId}/?rp=...&back=...&action=...
        //    错误格式：https://liff.line.me/{liffId}?rp=...  ← 不加斜杠 LINE 会丢参数
        if (!lineProfile?.lineUserId || !liffReady || lineProfile?.isFriend === undefined) {
          const lineConfig = getRuntimeLineConfig()
          const liffUrl = resolveRuntimeLiffUrl()
          if (!liffUrl) {
            message.error('LINE OA 尚未完成正式配置，请联系管理员补齐 LIFF ID 后再试')
            navigate('/welfare', { replace: true })
            return
          }
          if (!lineConfig.officialAccountId) {
            message.error('LINE OA 尚未完成正式配置，请联系管理员补齐官方账号 ID 后再试')
            navigate('/welfare', { replace: true })
            return
          }
          writeResumeKeys(fullReturn, backPath, label)
          const next =
            `${liffUrl}/?rp=${encodeURIComponent(fullReturn)}` +
            `&back=${encodeURIComponent(backPath)}` +
            `&action=${encodeURIComponent(label || '')}`
          window.location.href = next
          return
        }

        // ── Case 4: 仅当正式 LIFF 链路不可用时，非 LINE 浏览器退回设备身份降级 ─────
        const fan = isFan !== null ? isFan : await fetchFanStatus(getDeviceUserId())
        if (isFan === null) setIsFan(fan)

        if (fan) {
          await action()
        } else {
          writeResumeKeys(fullReturn, backPath, label)
          navigate('/welfare')
        }
      } finally {
        setChecking(false)
      }
    },
    [isFan, navigate, buildReturnPath, lineProfile, liffReady, isInLine]
  )

  return { isFan, guard, checking }
}
