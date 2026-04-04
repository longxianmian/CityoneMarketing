import request from './request'

export function login(data: { username: string; password: string }) {
  return request.post('/login', data)
}

export function getInfo() {
  return request.get('/getInfo')
}

export function getRouters() {
  return request.get('/getRouters')
}

export function logout() {
  return request.post('/logout')
}
