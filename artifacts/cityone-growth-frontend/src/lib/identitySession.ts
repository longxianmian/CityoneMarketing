import queryClient from './queryClient'
import useLineUserStore from '../store/lineUser'
import useAgentStore from '../store/agent'

export function resetCurrentIdentitySession() {
  // 只清当前前端会话和缓存，不触碰后端真实用户数据，也不改变 OA 关注状态。
  try {
    useLineUserStore.getState().clearProfile()
  } catch {}

  try {
    useAgentStore.getState().reset()
  } catch {}

  try {
    queryClient.clear()
  } catch {}

  try {
    window.localStorage.clear()
  } catch {}

  try {
    window.sessionStorage.clear()
  } catch {}
}
