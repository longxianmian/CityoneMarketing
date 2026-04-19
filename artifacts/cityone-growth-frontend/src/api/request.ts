import axios from 'axios'
import { getToken, removeToken } from '../store/auth'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

let antdMessageLoader: Promise<typeof import('antd')> | null = null

function showErrorMessage(content: string) {
  if (typeof window === 'undefined') return
  antdMessageLoader ||= import('antd')
  antdMessageLoader
    .then(({ message }) => {
      message.error(content)
    })
    .catch(() => {
      console.error('[request] message.error fallback', content)
    })
}

const request = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

request.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  // For FormData (file uploads), remove Content-Type so the browser sets
  // the correct multipart/form-data boundary automatically
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

request.interceptors.response.use(
  (res) => {
    const data = res.data

    // 兼容旧接口：{ code: 200, msg, data }
    if (data?.code === 200) {
      return data
    }

    // 兼容当前新增接口：{ ok: true, message, data }
    if (data?.ok === true) {
      return {
        code: 200,
        msg: data.message || 'success',
        data: data.data,
      }
    }

    if (data?.code === 401) {
      removeToken()
      window.location.href = '/admin/login'
      return Promise.reject(new Error('登录已过期'))
    }

    const msg = data?.msg || data?.message || '请求失败'
    showErrorMessage(msg)
    return Promise.reject(new Error(msg))
  },
  (err) => {
    if (err.response?.status === 401) {
      removeToken()
      window.location.href = '/admin/login'
      return Promise.reject(new Error('登录已过期'))
    }
    // 优先使用后端返回的业务错误信息（如 409 A_SYSTEM_FIELD_DUPLICATE 等）
    const apiMsg = err.response?.data?.msg || err.response?.data?.message
    const displayMsg = apiMsg || err.message || '网络错误'
    if (!(err.config as any)?.silentError) {
      showErrorMessage(displayMsg)
    }
    // 将业务消息挂到 error 上，方便 catch 块取用
    const enhancedErr = Object.assign(err, { displayMsg })
    return Promise.reject(enhancedErr)
  }
)

export default request
