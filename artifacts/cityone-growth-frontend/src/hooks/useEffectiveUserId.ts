import useLineUserStore from '../store/lineUser'
import { getDeviceUserId } from '../utils/deviceUserId'

/**
 * 返回全站统一的规范化 user_id：
 *
 * 优先级（由高到低）：
 * 1. store.canonicalUserId — POST /api/user/identify 返回的系统规范 ID
 * 2. profile.lineUserId    — LIFF 登录后的 LINE User ID
 * 3. getDeviceUserId()     — 设备 UUID（降级 / 开发环境）
 *
 * 所有写操作（领券、兑换、抽奖等）和读操作（权益、积分查询等）
 * 必须使用同一个 user_id，否则写入和查询对不上。
 */
export function useEffectiveUserId(): string {
  const { canonicalUserId, profile } = useLineUserStore()
  return canonicalUserId || profile?.lineUserId || getDeviceUserId()
}
