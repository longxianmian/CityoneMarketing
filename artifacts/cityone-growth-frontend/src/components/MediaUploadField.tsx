import React, { useState, useId, useEffect, useRef } from 'react'
import { Button, message } from 'antd'
import { UploadOutlined, LoadingOutlined, VideoCameraOutlined } from '@ant-design/icons'
import { isObjectKey, fetchSignedUrl } from './OssImage'
import request from '../api/request'
import { useI18n } from '../i18n'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

interface Props {
  value?: string
  onChange?: (value: string) => void
  type: 'image' | 'video'
  placeholder?: string
  moduleType?: string
  poster?: string
}

export default function MediaUploadField({ value, onChange, type, placeholder, moduleType = 'uploads', poster }: Props) {
  const { language } = useI18n()
  const [uploading, setUploading] = useState(false)
  const [displayUrl, setDisplayUrl] = useState<string>('')
  const inputId = useId()
  const prevValue = useRef<string>('')
  const copy = ({
    zh: {
      uploadImageOnly: '请上传图片文件（JPG / PNG / WebP）',
      uploadVideoOnly: '请上传视频文件（MP4 / WebM / MOV）',
      maxSize: (maxMB: number) => `文件不能超过 ${maxMB}MB`,
      uploadOk: '上传成功',
      uploadFail: '上传失败',
      uploading: '上传中...',
      imagePlaceholder: '点击上传封面图',
      videoPlaceholder: '点击上传宣传视频',
      imageHint: '支持 JPG / PNG / WebP，最大 5MB',
      videoHint: '支持 MP4 / WebM / MOV，最大 100MB',
      reupload: '点击重新上传',
      replaceVideo: '替换视频',
      removeImage: '移除图片',
      removeVideo: '移除视频',
    },
    th: {
      uploadImageOnly: 'โปรดอัปโหลดไฟล์รูปภาพ (JPG / PNG / WebP)',
      uploadVideoOnly: 'โปรดอัปโหลดไฟล์วิดีโอ (MP4 / WebM / MOV)',
      maxSize: (maxMB: number) => `ไฟล์ต้องมีขนาดไม่เกิน ${maxMB}MB`,
      uploadOk: 'อัปโหลดสำเร็จ',
      uploadFail: 'อัปโหลดไม่สำเร็จ',
      uploading: 'กำลังอัปโหลด...',
      imagePlaceholder: 'คลิกเพื่ออัปโหลดภาพปก',
      videoPlaceholder: 'คลิกเพื่ออัปโหลดวิดีโอโปรโมต',
      imageHint: 'รองรับ JPG / PNG / WebP สูงสุด 5MB',
      videoHint: 'รองรับ MP4 / WebM / MOV สูงสุด 100MB',
      reupload: 'คลิกเพื่ออัปโหลดใหม่',
      replaceVideo: 'เปลี่ยนวิดีโอ',
      removeImage: 'ลบรูปภาพ',
      removeVideo: 'ลบวิดีโอ',
    },
    en: {
      uploadImageOnly: 'Please upload an image file (JPG / PNG / WebP)',
      uploadVideoOnly: 'Please upload a video file (MP4 / WebM / MOV)',
      maxSize: (maxMB: number) => `File size must be under ${maxMB}MB`,
      uploadOk: 'Upload successful',
      uploadFail: 'Upload failed',
      uploading: 'Uploading...',
      imagePlaceholder: 'Click to upload cover image',
      videoPlaceholder: 'Click to upload promo video',
      imageHint: 'Supports JPG / PNG / WebP, up to 5MB',
      videoHint: 'Supports MP4 / WebM / MOV, up to 100MB',
      reupload: 'Click to upload again',
      replaceVideo: 'Replace video',
      removeImage: 'Remove image',
      removeVideo: 'Remove video',
    },
  } as const)[language] || ({
    uploadImageOnly: 'Please upload an image file (JPG / PNG / WebP)',
    uploadVideoOnly: 'Please upload a video file (MP4 / WebM / MOV)',
    maxSize: (maxMB: number) => `File size must be under ${maxMB}MB`,
    uploadOk: 'Upload successful',
    uploadFail: 'Upload failed',
    uploading: 'Uploading...',
    imagePlaceholder: 'Click to upload cover image',
    videoPlaceholder: 'Click to upload promo video',
    imageHint: 'Supports JPG / PNG / WebP, up to 5MB',
    videoHint: 'Supports MP4 / WebM / MOV, up to 100MB',
    reupload: 'Click to upload again',
    replaceVideo: 'Replace video',
    removeImage: 'Remove image',
    removeVideo: 'Remove video',
  })

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
      message.error(copy.uploadImageOnly)
      return
    }
    if (type === 'video' && !/^video\//.test(file.type)) {
      message.error(copy.uploadVideoOnly)
      return
    }
    const maxMB = type === 'image' ? 5 : 100
    if (file.size > maxMB * 1024 * 1024) {
      message.error(copy.maxSize(maxMB))
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('moduleType', moduleType)

      const json: any = await request.post('/media/upload', formData, {
        timeout: type === 'video' ? 180000 : 30000,
      } as any)

      if (json?.code === 200 && json?.data) {
        const { objectKey, url } = json.data
        const storeValue = objectKey || url
        setDisplayUrl(url)
        prevValue.current = storeValue
        onChange?.(storeValue)
        message.success(copy.uploadOk)
      } else {
        message.error(json?.msg || copy.uploadFail)
      }
    } catch (err: any) {
      console.error('Upload error:', err)
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
          {uploading ? copy.uploading : placeholder || (type === 'image' ? copy.imagePlaceholder : copy.videoPlaceholder)}
        </span>
        <span style={{ color: '#bbb', fontSize: 11, marginTop: 4 }}>
          {type === 'image' ? copy.imageHint : copy.videoHint}
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
          onError={() => {
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
            {copy.reupload}
          </div>
        )}
      </div>
    </label>
  ) : (
    <div>
      {fileInput}
      <video
        src={displayUrl || value} controls
        poster={poster}
        style={{ width: '100%', maxHeight: 180, borderRadius: 8, border: '1px solid #f0f0f0', display: 'block', background: '#000' }}
      />
      {uploading
        ? <div style={{ textAlign: 'center', color: '#1677ff', fontSize: 12, marginTop: 4 }}><LoadingOutlined /> {copy.uploading}</div>
        : <label htmlFor={inputId} style={{ display: 'block', textAlign: 'center', marginTop: 4, cursor: 'pointer' }}>
            <Button size="small" onClick={e => e.preventDefault()}>{copy.replaceVideo}</Button>
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
          {type === 'image' ? copy.removeImage : copy.removeVideo}
        </Button>
      )}
    </div>
  )
}
