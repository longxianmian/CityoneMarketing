import axios from 'axios'
import { getToken, removeToken } from '../store/auth'
import { message } from 'antd'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

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
    message.error(msg)
    return Promise.reject(new Error(msg))
  },
  (err) => {
    if (err.response?.status === 401) {
      removeToken()
      window.location.href = '/admin/login'
    }
    message.error(err.message || '网络错误')
    return Promise.reject(err)
  }
)

export default request
