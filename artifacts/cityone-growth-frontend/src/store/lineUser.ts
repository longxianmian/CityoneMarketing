import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type IdentityTag = 'fan' | 'user' | 'member'

export interface LineUserProfile {
  lineUserId: string
  lineDisplayName: string
  linePictureUrl: string
  identityTag?: IdentityTag
  memberLevel: string
  points: number
  couponCount: number
  deposit: number
  depositPaid?: boolean
  /** liff.getFriendship() 结果：是否关注了 OA */
  isFriend?: boolean
}

interface LineUserState {
  profile: LineUserProfile | null
  /**
   * 规范化 user_id（全站统一使用此 ID 做写操作和查询）
   * - LINE 用户：等于 profile.lineUserId（LINE User ID，Uxxxxxxxx...）
   * - 纯设备用户：等于 deviceUserId（UUID）
   * - 由 POST /api/user/identify 返回并写入
   */
  canonicalUserId: string | null
  setProfile: (profile: LineUserProfile) => void
  clearProfile: () => void
  /** 写入 canonical user_id（由 identify 接口返回后调用）*/
  setCanonicalUserId: (userId: string) => void
  /** 单独更新粉丝状态（关注后刷新用）*/
  setIsFriend: (isFriend: boolean) => void
  /** 更新 identity_tag（identify 接口返回后同步）*/
  setIdentityTag: (tag: IdentityTag) => void
}

const useLineUserStore = create<LineUserState>()(
  persist(
    (set) => ({
      profile: null,
      canonicalUserId: null,
      setProfile: (profile: LineUserProfile) => set({ profile }),
      clearProfile: () => set({ profile: null, canonicalUserId: null }),
      setCanonicalUserId: (userId: string) => set({ canonicalUserId: userId }),
      setIsFriend: (isFriend: boolean) =>
        set((s) => s.profile ? { profile: { ...s.profile, isFriend } } : s),
      setIdentityTag: (tag: IdentityTag) =>
        set((s) => s.profile ? { profile: { ...s.profile, identityTag: tag } } : s),
    }),
    {
      name: 'cityone-line-user',
    }
  )
)

export { useLineUserStore }
export default useLineUserStore
