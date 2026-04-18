/**
 * useFollowGate — 唯一主链入口
 *
 * 执行型动作统一流程：
 *   1. 创建 pending intent
 *   2. 导航到 /welfare/continue?intent=...
 *
 * 不在这里直接执行 claim / participate / redeem / use。
 */
import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { message } from 'antd'
import useLineUserStore from '../store/lineUser'
import { issuePendingIntent, type PendingIntentAction } from '../lib/pendingIntent'

interface GuardOptions {
  label?: string
  returnPath: string
  back?: string
  intentAction?: PendingIntentAction
  resourceId?: string
  source?: Record<string, any>
}

export function hasFreshResumePending() {
  return false
}

export function writeResumeKeys() {
  return
}

export function useFollowGate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lineProfile = useLineUserStore((s) => s.profile)
  const canonicalUserId = useLineUserStore((s) => s.canonicalUserId)
  const [checking, setChecking] = useState(false)

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

  const guard = useCallback(
    async (_action: () => void | Promise<void>, opts: GuardOptions) => {
      const {
        label = '',
        returnPath,
        back,
        intentAction,
        resourceId,
        source = {},
      } = opts

      if (!intentAction || !resourceId) {
        message.error('缺少待恢复动作定义，无法继续')
        return
      }

      setChecking(true)
      try {
        const fullReturn = buildReturnPath(returnPath)
        const backPath = back ?? returnPath.split('?')[0]
        const issued = await issuePendingIntent({
          userId: canonicalUserId || lineProfile?.lineUserId || '',
          lineUserId: lineProfile?.lineUserId || '',
          action: intentAction,
          resourceId,
          returnPath: fullReturn,
          backPath,
          actionName: label,
          source,
        })
        navigate(`/welfare/continue?intent=${encodeURIComponent(issued.token)}`)
      } catch (err: any) {
        message.error(err?.message || '创建待恢复动作失败')
      } finally {
        setChecking(false)
      }
    },
    [buildReturnPath, canonicalUserId, lineProfile?.lineUserId, navigate]
  )

  return { guard, checking }
}
