import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LineUserProfile {
  lineUserId: string
  lineDisplayName: string
  linePictureUrl: string
  memberLevel: string
  points: number
  couponCount: number
  deposit: number
}

interface LineUserState {
  profile: LineUserProfile | null
  setProfile: (profile: LineUserProfile) => void
  clearProfile: () => void
}

const useLineUserStore = create<LineUserState>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (profile: LineUserProfile) => set({ profile }),
      clearProfile: () => set({ profile: null }),
    }),
    {
      name: 'cityone-line-user',
    }
  )
)

export default useLineUserStore
