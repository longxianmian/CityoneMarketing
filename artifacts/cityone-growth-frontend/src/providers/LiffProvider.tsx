/**
 * LiffProvider — LINE LIFF SDK 初始化 Provider
 *
 * 先读规范再改代码：
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-identity-and-business-levels.md
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-external-browser-line-continue-flow.md
 *
 * 强约束：
 * - 这里负责 LINE 身份建立，不负责前端自行推断业务身份等级
 * - 不允许根据头像、昵称、points 账户等本地/历史数据推断 fan/customer/member
 * - 用户端业务身份只能以后端 /api/user/profile/me 与 /api/user/check-follow 为真源
 *
 * 使用非 hook 方式初始化（避免 @line/liff 内置 React 与应用 React 版本冲突）：
 *   - initLiff() 作为普通 async 函数在组件外执行
 *   - 通过 useLineUserStore.getState().setProfile() 更新 store（无需 hook）
 *   - 暴露 getLiff() 让页面可以直接调用 liff.getFriendship() 等 API
 */
import React, { createContext, useContext, useEffect, useState } from 'react'
import useLineUserStore from '../store/lineUser'
import { resolveRuntimeLiffId, setRuntimeLineConfig } from '../lib/line'
import { clientLog } from '../lib/clientLogger'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export interface LiffContextValue {
  liffReady: boolean
  /**
   * 用户是否在 LINE App 内（含 LIFF Browser 与 LINE In-App Browser 两种）。
   *
   * 历史坑（LINE 官方文档 / LIFF 社区共识）：
   * - liff.isInClient() 只在 "LIFF Browser"（点 liff.line.me 链接进入）返回 true，
   *   对于 "LINE In-App Browser"（聊天里点 endpoint URL / 扫 endpoint 二维码）返回 false。
   * - 官方推荐："要判断是否在 LINE 内，必须 isInClient() || /Line\\/\\d/.test(UA)"。
   *
   * 我们的所有下游分支（OpenInLinePage / ContinuePage / useFollowGate / FollowConfirmPage）
   * 想知道的都是 "用户能不能在 LINE 内继续"，因此一律使用本字段（已是 OR 后的结果），
   * 不要在下游再单独取 liff.isInClient()。
   */
  inLineClient: boolean
  /** initLiff() 已完成（无论成功/失败），可安全读取 isFriend */
  liffChecked: boolean
}

/** UA 兜底：LINE In-App Browser 里 isInClient() 返回 false，但 UA 一定带 "Line/" */
function detectLineAppUA(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Line\/\d/i.test(navigator.userAgent)
}

export const LiffContext = createContext<LiffContextValue>({
  liffReady: false,
  inLineClient: false,
  liffChecked: false,
})

export function useLiff() {
  return useContext(LiffContext)
}

// 模块级缓存，页面组件可通过 getLiff() 直接调用 LIFF API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _liffInstance: any = null
let _liffInitiated = false
let _liffId = ''  // 缓存已拉取的 LIFF ID，catch 块中也可访问

/** 获取已初始化的 liff 实例（可能为 null，需判断）*/
export function getLiff() {
  return _liffInstance
}

async function initLiff(
  onReady: (ctx: LiffContextValue) => void,
  signal: { cancelled: boolean }
) {
  if (_liffInitiated) return
  _liffInitiated = true
  const url = (() => { try { return new URL(window.location.href) } catch { return null } })()
  clientLog('liff_init_start', {
    has_liff_state: !!url?.searchParams.get('liff.state'),
    has_code: !!url?.searchParams.get('code'),
    in_line_ua: /Line\/\d/i.test(navigator.userAgent),
    pathname: url?.pathname || '',
  })

  try {
    // 1. 从后端拉取 LIFF ID
    const res = await fetch(`${API_BASE}/api/growth/line/config`)
    const json = await res.json()
    setRuntimeLineConfig(json?.data || null)
    const liffId: string = resolveRuntimeLiffId(json?.data?.liffId)
    _liffId = liffId  // 供 catch 块使用

    if (!liffId) {
      clientLog('liff_init_no_liff_id', {})
      onReady({ liffReady: false, inLineClient: false, liffChecked: true })
      return
    }

    // 2. 动态导入 LIFF SDK（避免 SSR/测试环境问题）
    const liff = (await import('@line/liff')).default
    await liff.init({ liffId })
    if (signal.cancelled) return

    _liffInstance = liff
    const isInClientSdk = liff.isInClient()
    const isLineUA = detectLineAppUA()
    // 在 LINE 内（含 LIFF Browser + LINE In-App Browser）一律视为 in_line_client。
    // 见 LiffContextValue.inLineClient 的注释（LINE 官方文档）。
    const isInLineClient = isInClientSdk || isLineUA
    clientLog('liff_init_done', {
      in_client: isInLineClient,
      in_client_sdk: isInClientSdk,
      in_line_ua: isLineUA,
      logged_in: liff.isLoggedIn(),
    })

    // 3. 获取真实 LINE 用户资料
    if (!liff.isLoggedIn()) {
      // LINE 内未登录：主动触发 LIFF login（LINE 官方推荐流程）。
      // LINE In-App Browser 里第一次进 LIFF endpoint 通常 isLoggedIn=false，
      // 必须由 SDK 调 liff.login() 触发 OAuth → LINE 自动同意 basic scope (profile+openid)
      // → redirect 回当前 URL → 二次 init 时 isLoggedIn=true。
      // 不调 login 则下游永远拿不到 identity，会陷入 ContinuePage <-> OpenInLinePage 循环。
      //
      // 防护：用 sessionStorage 防止 login 失败/拒绝后无限循环跳 OAuth。
      // 一次跳转都失败 → 把 ctx 解锁，让 OpenInLinePage 展示重试 UI。
      const LOGIN_ATTEMPTED_KEY = '_liff_login_attempted'
      const alreadyAttempted = (() => {
        try { return sessionStorage.getItem(LOGIN_ATTEMPTED_KEY) === '1' } catch { return false }
      })()
      if (isInLineClient && !alreadyAttempted) {
        try { sessionStorage.setItem(LOGIN_ATTEMPTED_KEY, '1') } catch {}
        clientLog('liff_login_trigger', { in_line_client: isInLineClient })
        try {
          liff.login()  // 触发整页跳 LINE OAuth，函数不返回（页面会被替换）
        } catch (e) {
          console.warn('[LIFF] login() call failed', e)
        }
        return
      }
      // 外部浏览器或已尝试过 login 仍未登录 → 解锁让下游做"请在 LINE 内打开"提示
      if (!signal.cancelled) {
        onReady({ liffReady: false, inLineClient: isInLineClient, liffChecked: true })
      }
      return
    }
    // 登录成功后清除 attempt flag，避免下次首屏被误判为"已尝试过失败"
    try { sessionStorage.removeItem('_liff_login_attempted') } catch {}

    // 已完成 LIFF 登录后，无论是在 LINE 内还是外部浏览器，都要建立真实 LINE 身份。
    // 生产链路要求外部浏览器中的 LIFF 回流也能完成 identify / follow 校验，
    // 否则会出现“关注并继续 -> 回到 /welfare -> 又弹关注”的循环。
    const lineProfile = await liff.getProfile()
    if (signal.cancelled) return

    // 清理 URL 上 LIFF / OAuth 残留参数（仅 isLoggedIn=true 后做，避免清掉时 SDK 还没 exchange code）。
    // LIFF login 完成后 redirect 回来的 URL 长这样：
    //   /welfare?code=xxx&state=xxx&liffClientId=xxx&liffRedirectUri=xxx&liff.state=xxx
    // 这些参数对业务路由无意义，留着会污染 react-router 的 search、被 welfare-entry 之类
    // 误判 has_code，且让用户地址栏看起来很乱。用 history.replaceState 静默清掉，
    // 不触发 navigate（不会引发组件二次 render / route_change）。
    try {
      const u = new URL(window.location.href)
      const STRIP_KEYS = [
        'code',
        'state',
        'liffClientId',
        'liffRedirectUri',
        'liffReferer',
        'liff.state',
        'error',
        'error_description',
      ]
      let touched = false
      for (const k of STRIP_KEYS) {
        if (u.searchParams.has(k)) {
          u.searchParams.delete(k)
          touched = true
        }
      }
      if (touched) {
        const cleanQs = u.searchParams.toString()
        const cleanUrl = u.pathname + (cleanQs ? `?${cleanQs}` : '') + u.hash
        window.history.replaceState(window.history.state, '', cleanUrl)
        clientLog('liff_url_cleaned', { stripped_keys: STRIP_KEYS.filter(k => !u.searchParams.has(k)) })
      }
    } catch {
      // URL 解析失败不影响主流程
    }

    // 4. 检查是否已关注 OA（用于 useFollowGate 快速判断）
    let isFriend: boolean | undefined
    if (isInClientSdk) {
      try {
        const friendship = await liff.getFriendship()
        isFriend = friendship.friendFlag
      } catch {
        // getFriendship 在 LINE 外部浏览器里会打 friendship/v1/status 并返回 400，
        // 这里仅在 LINE 内置浏览器中调用；外部浏览器统一交给后端 check-follow 收口。
      }
    }

    // 写入 store（不使用 hook，避免 React 版本冲突）
    useLineUserStore.getState().setProfile({
      lineUserId: lineProfile.userId,
      lineDisplayName: lineProfile.displayName,
      linePictureUrl: lineProfile.pictureUrl || '',
      identityTag: undefined,
      memberLevel: 'standard',
      points: 0,
      couponCount: 0,
      deposit: 0,
      depositPaid: false,
      isFriend,
    })

    // 调用 identify 接口：写入 users 表，获取 canonical user_id 和身份标签
    try {
      const idRes = await fetch(`${API_BASE}/api/user/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_user_id: lineProfile.userId,
          display_name: lineProfile.displayName,
          picture_url: lineProfile.pictureUrl || '',
          is_fan: isFriend === true,
        }),
      })
      const idJson = await idRes.json()
      const idData = idJson?.data || {}
      if (idData.user_id) {
        useLineUserStore.getState().setCanonicalUserId(idData.user_id)
      }
      const identityLevel = idData.identity_level || idData.identity_tag
      if (identityLevel) {
        useLineUserStore.getState().setIdentityTag(identityLevel)
      }
      if (typeof idData.is_fan === 'boolean') {
        useLineUserStore.getState().setIsFriend(idData.is_fan)
      }
    } catch {
      // identify 失败不阻塞用户，降级使用 LINE User ID 作为 canonical ID
      useLineUserStore.getState().setCanonicalUserId(lineProfile.userId)
    }

    if (!signal.cancelled) {
      onReady({ liffReady: true, inLineClient: isInLineClient, liffChecked: true })
    }
  } catch (err) {
    // 若在 LINE 内置浏览器但当前 URL 不在 LIFF 端点 (/welfare) 下，重定向到正确端点
    // 这解决了同事从根链接 / 或其他路径进入时 LIFF 初始化失败的问题
    const isLineUA = detectLineAppUA()
    const notAtEndpoint = !window.location.pathname.startsWith('/welfare')
    if (isLineUA && notAtEndpoint && _liffId) {
      // 即使要 redirect，也必须先解锁 ctx，否则在 redirect 完成前若有任何
      // 等待 liffChecked 的下游（ContinuePage useEffect）会被永久卡住。
      if (!signal.cancelled) {
        onReady({ liffReady: false, inLineClient: true, liffChecked: true })
      }
      window.location.replace('/welfare')
      return
    }
    console.warn('[LIFF] init failed, production LINE identity is unavailable:', err)
    // init 失败时：UA 仍是关键判据。LINE In-App Browser 里 init 经常失败但 UA 一定是 Line/，
    // 此时把 inLineClient 设为 true 让下游走 in_line 分支（client-side navigate），
    // 避免再次跳 liffUrl 触发 endpoint reload 死循环。
    onReady({ liffReady: false, inLineClient: isLineUA, liffChecked: true })
  }
}

// LIFF init 整链路（fetch line/config + dynamic import @line/liff + liff.init + getProfile + identify）
// 网络半挂时可能长期 pending，导致 liffChecked 永远 false，下游 ContinuePage 卡死在 loading。
// 5s 兜底：超时强制解锁 ctx，让 ContinuePage runFlow 跑起来（!liffReady 会跳 OpenInLinePage 让用户重试）。
const LIFF_INIT_TIMEOUT_MS = 5000

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [ctx, setCtx] = useState<LiffContextValue>({ liffReady: false, inLineClient: false, liffChecked: false })

  useEffect(() => {
    const signal = { cancelled: false }
    let resolved = false
    let timer = 0
    const safeSetCtx = (next: LiffContextValue) => {
      // 严格"先到胜出"：cancelled 或已解锁过都不再回调，避免超时 fallback 后
      // initLiff 真实结果二次覆盖 ctx（造成状态来回切换）。
      if (signal.cancelled || resolved) return
      resolved = true
      window.clearTimeout(timer)
      setCtx(next)
    }
    timer = window.setTimeout(() => {
      if (resolved || signal.cancelled) return
      console.warn('[LIFF] init timeout after', LIFF_INIT_TIMEOUT_MS, 'ms — falling back to liffChecked:true / liffReady:false')
      // 兜底也用 UA 推断 inLineClient，避免 LINE In-App Browser 内 timeout 后下游误判为外部浏览器
      safeSetCtx({ liffReady: false, inLineClient: detectLineAppUA(), liffChecked: true })
    }, LIFF_INIT_TIMEOUT_MS)
    initLiff(safeSetCtx, signal)
    return () => {
      signal.cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  return <LiffContext.Provider value={ctx}>{children}</LiffContext.Provider>
}
