import React, { useState, useId, useEffect, useRef } from 'react'
import { Button, message } from 'antd'
import { UploadOutlined, LoadingOutlined, VideoCameraOutlined } from '@ant-design/icons'
import { isObjectKey, fetchSignedUrl } from './OssImage'
import { getToken } from '../store/auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

interface Props {
  value?: string
  onChange?: (value: string) => void
  type: 'image' | 'video'
  placeholder?: string
  moduleType?: string
}

export default function MediaUploadField({ value, onChange, type, placeholder, moduleType = 'uploads' }: Props) {
  const [uploading, setUploading] = useState(false)
  const [displayUrl, setDisplayUrl] = useState<string>('')
  const inputId = useId()
  const prevValue = useRef<string>('')

  useEffect(() => {
    if (!value || value === prevValue.current) return
    prevValue.current = value

    if (isObjectKey(value)) {
      fetchSignedUrl(value).then(url => {
        if (url) setDisplayUrl(url)
      })
    } else {
      const resolved = value.startsWith('http') ? value : value.startsWith('/') ? `${API_BASE}${value}` : value
      setDisplayUrl(resolved)
    }
  }, [value])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (type === 'image' && !/^image\//.test(file.type)) {
      message.error('请上传图片文件（JPG / PNG / WebP）')
      return
    }
    if (type === 'video' && !/^video\//.test(file.type)) {
      message.error('请上传视频文件（MP4 / WebM / MOV）')
      return
    }
    const maxMB = type === 'image' ? 5 : 100
    if (file.size > maxMB * 1024 * 1024) {
      message.error(`文件不能超过 ${maxMB}MB`)
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('moduleType', moduleType)

      const token = getToken() || ''
      const res = await fetch(`${API_BASE}/api/media/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      const json = await res.json()

      if (json.code === 200 && json.data) {
        const { objectKey, url } = json.data
        const storeValue = objectKey || url
        setDisplayUrl(url)
        prevValue.current = storeValue
        onChange?.(storeValue)
        message.success('上传成功')
      } else {
        message.error(json.msg || '上传失败')
      }
    } catch (err: any) {
      console.error('Upload error:', err)
      message.error('上传失败，请检查网络连接')
    } finally {
      setUploading(false)
    }
  }

  const fileInput = (
    <input
      id={inputId}
      type="file"
      accept={type === 'image' ? 'image/*' : 'video/*'}
      style={{ display: 'none' }}
      disabled={uploading}
      onChange={handleFileChange}
    />
  )

  const emptyBox = (
    <label htmlFor={inputId} style={{ display: 'block', cursor: uploading ? 'not-allowed' : 'pointer' }}>
      {fileInput}
      <div style={{
        width: '100%', height: 130, border: '1px dashed #d9d9d9', borderRadius: 8,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#fafafa', transition: 'border-color 0.2s',
      }}>
        {uploading
          ? <LoadingOutlined style={{ fontSize: 28, color: '#1677ff' }} />
          : type === 'image'
            ? <UploadOutlined style={{ fontSize: 28, color: '#bbb' }} />
            : <VideoCameraOutlined style={{ fontSize: 28, color: '#bbb' }} />
        }
        <span style={{ marginTop: 8, color: '#999', fontSize: 13 }}>
          {uploading ? '上传中...' : placeholder || (type === 'image' ? '点击上传封面图' : '点击上传宣传视频')}
        </span>
        <span style={{ color: '#bbb', fontSize: 11, marginTop: 4 }}>
          {type === 'image' ? '支持 JPG / PNG / WebP，最大 5MB' : '支持 MP4 / WebM / MOV，最大 100MB'}
        </span>
      </div>
    </label>
  )

  const previewBox = type === 'image' ? (
    <label htmlFor={inputId} style={{ display: 'block', cursor: 'pointer' }}>
      {fileInput}
      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
        <img
          src={displayUrl || value} alt="cover"
          style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}
          onError={e => {
            if (isObjectKey(value)) {
              fetchSignedUrl(value!).then(url => { if (url) setDisplayUrl(url) })
            }
          }}
        />
        {uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LoadingOutlined style={{ color: '#fff', fontSize: 28 }} />
          </div>
        )}
        {!uploading && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,0.5))', padding: '20px 10px 6px', color: '#fff', fontSize: 12, textAlign: 'center' }}>
            点击重新上传
          </div>
        )}
      </div>
    </label>
  ) : (
    <div>
      {fileInput}
      <video
        src={displayUrl || value} controls
        style={{ width: '100%', maxHeight: 180, borderRadius: 8, border: '1px solid #f0f0f0', display: 'block', background: '#000' }}
      />
      {uploading
        ? <div style={{ textAlign: 'center', color: '#1677ff', fontSize: 12, marginTop: 4 }}><LoadingOutlined /> 上传中...</div>
        : <label htmlFor={inputId} style={{ display: 'block', textAlign: 'center', marginTop: 4, cursor: 'pointer' }}>
            <Button size="small" onClick={e => e.preventDefault()}>替换视频</Button>
          </label>
      }
    </div>
  )

  return (
    <div>
      {value ? previewBox : emptyBox}
      {value && !uploading && (
        <Button
          size="small" type="link" danger
          style={{ padding: 0, marginTop: 4, height: 'auto' }}
          onClick={() => { onChange?.(''); setDisplayUrl(''); prevValue.current = '' }}
        >
          移除{type === 'image' ? '图片' : '视频'}
        </Button>
      )}
    </div>
  )
}
