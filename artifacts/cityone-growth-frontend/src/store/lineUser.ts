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
  setProfile: (profile: LineUserProfile) => void
  clearProfile: () => void
  /** 单独更新粉丝状态（关注后刷新用）*/
  setIsFriend: (isFriend: boolean) => void
}

const useLineUserStore = create<LineUserState>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (profile: LineUserProfile) => set({ profile }),
      clearProfile: () => set({ profile: null }),
      setIsFriend: (isFriend: boolean) =>
        set((s) => s.profile ? { profile: { ...s.profile, isFriend } } : s),
    }),
    {
      name: 'cityone-line-user',
    }
  )
)

export default useLineUserStore
