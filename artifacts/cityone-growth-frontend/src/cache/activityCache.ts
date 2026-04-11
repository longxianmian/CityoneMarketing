import queryClient from '../lib/queryClient'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export const activityQueryKey = (id: string) => ['activity', id] as const

async function fetchActivityById(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/activities/${id}`)
  const json = await res.json()
  return json.data || json
}

export function prefetchActivity(id: string) {
  queryClient.prefetchQuery({
    queryKey: activityQueryKey(id),
    queryFn: () => fetchActivityById(id),
  })
}

export { fetchActivityById }
