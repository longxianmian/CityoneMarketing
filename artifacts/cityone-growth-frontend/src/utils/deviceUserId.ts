const KEY = 'co_device_uid'

export function getDeviceUserId(): string {
  let uid = localStorage.getItem(KEY)
  if (!uid) {
    uid = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    localStorage.setItem(KEY, uid)
  }
  return uid
}
