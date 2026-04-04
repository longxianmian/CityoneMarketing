import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UserInfo {
  userId: number
  userName: string
  nickName: string
  avatar: string
  roles: string[]
  permissions: string[]
}

interface AuthState {
  token: string | null
  userInfo: UserInfo | null
  setToken: (token: string) => void
  setUserInfo: (info: UserInfo) => void
  logout: () => void
  hasPermission: (perm: string) => boolean
  hasRole: (role: string) => boolean
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      userInfo: null,
      setToken: (token: string) => set({ token }),
      setUserInfo: (info: UserInfo) => set({ userInfo: info }),
      logout: () => set({ token: null, userInfo: null }),
      hasPermission: (perm: string) => {
        const perms = get().userInfo?.permissions || []
        return perms.includes('*:*:*') || perms.includes(perm)
      },
      hasRole: (role: string) => {
        const roles = get().userInfo?.roles || []
        if (role === 'super_admin') return roles.includes('super_admin')
        return roles.includes('super_admin') || roles.includes('admin') || roles.includes(role)
      },
    }),
    {
      name: 'cityone-admin-auth',
      partialize: (state) => ({ token: state.token, userInfo: state.userInfo }),
    }
  )
)

export function getToken(): string | null {
  return useAuthStore.getState().token
}

export function removeToken() {
  useAuthStore.getState().logout()
}

export function isLoggedIn(): boolean {
  return !!useAuthStore.getState().token
}

export default useAuthStore
