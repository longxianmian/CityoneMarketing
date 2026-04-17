export function isFollowFlowV2Enabled(search = window.location.search) {
  const params = new URLSearchParams(search)
  const queryValue = params.get('followFlow')
  if (queryValue === 'v2') return true
  if (queryValue === 'v1') return false
  return import.meta.env.VITE_FOLLOW_FLOW_V2 === 'true'
}
