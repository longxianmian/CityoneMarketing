/**
 * TranslateBatchButton — 一键补全多语言翻译
 *
 * 大厂做法：封装"批量补译"操作为独立组件，各管理页面复用，
 * 防止功能散落各处、难以维护。
 */
import React, { useState } from 'react'
import { Button, Tooltip, message, Progress } from 'antd'
import { TranslationOutlined, LoadingOutlined } from '@ant-design/icons'
import request from '../api/request'
import { useI18n } from '../i18n'

type ItemType = 'coupon' | 'activity' | 'mall_item' | 'digital_product' | 'all'

interface Props {
  type: ItemType
  label?: string
  onDone?: () => void
}

interface BatchResult {
  total: number
  done: number
  skipped: number
  failed: number
}

export default function TranslateBatchButton({ type, label, onDone }: Props) {
  const { language } = useI18n()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)
  const copy = ({
    zh: {
      success: (done: number, skipped: number) => `翻译完成：补译 ${done} 条，已跳过 ${skipped} 条`,
      noop: '所有数据已有完整翻译，无需补译',
      failed: '批量翻译失败，请检查 AI 服务是否可用',
      tooltipResult: (done: number, total: number) => `上次结果：补译 ${done} / 共 ${total} 条`,
      tooltipDefault: '将数据库中泰文/英文为空的内容自动翻译补全',
      button: '一键补译',
    },
    th: {
      success: (done: number, skipped: number) => `แปลเสร็จแล้ว: เติมคำแปล ${done} รายการ, ข้าม ${skipped} รายการ`,
      noop: 'ข้อมูลทั้งหมดมีคำแปลครบแล้ว ไม่ต้องเติมเพิ่ม',
      failed: 'แปลแบบกลุ่มไม่สำเร็จ โปรดตรวจสอบว่า AI service พร้อมใช้งาน',
      tooltipResult: (done: number, total: number) => `ผลล่าสุด: เติมคำแปล ${done} / ทั้งหมด ${total} รายการ`,
      tooltipDefault: 'เติมคำแปลอัตโนมัติสำหรับข้อมูลที่ยังไม่มีภาษาไทย/อังกฤษ',
      button: 'เติมคำแปลอัตโนมัติ',
    },
    en: {
      success: (done: number, skipped: number) => `Translation complete: filled ${done}, skipped ${skipped}`,
      noop: 'All records already have complete translations',
      failed: 'Batch translation failed. Please check whether the AI service is available',
      tooltipResult: (done: number, total: number) => `Last result: filled ${done} / ${total}`,
      tooltipDefault: 'Automatically fill missing Thai/English translations in the database',
      button: 'Auto-fill Translations',
    },
  } as const)[language] || ({
    success: (done: number, skipped: number) => `Translation complete: filled ${done}, skipped ${skipped}`,
    noop: 'All records already have complete translations',
    failed: 'Batch translation failed. Please check whether the AI service is available',
    tooltipResult: (done: number, total: number) => `Last result: filled ${done} / ${total}`,
    tooltipDefault: 'Automatically fill missing Thai/English translations in the database',
    button: 'Auto-fill Translations',
  })

  const handleClick = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res: any = await request.post(
        '/admin/translate-batch',
        { type },
        { timeout: 120000 } as any
      )
      const data = res.data?.data || {}
      const r: BatchResult = type === 'all'
        ? Object.values(data).reduce(
            (acc: any, v: any) => ({
              total: (acc.total || 0) + (v.total || 0),
              done: (acc.done || 0) + (v.done || 0),
              skipped: (acc.skipped || 0) + (v.skipped || 0),
              failed: (acc.failed || 0) + (v.failed || 0),
            }),
            { total: 0, done: 0, skipped: 0, failed: 0 }
          ) as BatchResult
        : (data[type] || data) as BatchResult

      setResult(r)
      if (r.done > 0) {
        message.success(copy.success(r.done, r.skipped))
        onDone?.()
      } else {
        message.info(copy.noop)
      }
    } catch (err: any) {
      message.error(copy.failed)
    } finally {
      setLoading(false)
    }
  }

  const tooltipTitle = result
    ? copy.tooltipResult(result.done, result.total)
    : copy.tooltipDefault

  return (
    <Tooltip title={tooltipTitle}>
      <Button
        size="small"
        icon={loading ? <LoadingOutlined /> : <TranslationOutlined />}
        onClick={handleClick}
        loading={loading}
        style={{ borderColor: '#2CDBCE', color: '#2CDBCE' }}
      >
        {label || copy.button}
      </Button>
    </Tooltip>
  )
}

/**
 * 存储成功后，后台静默补译单条记录（非阻塞）
 * 用法：在 handleFormOk 里 saveSuccess 后调用即可
 */
export function asyncTranslateItem(type: Exclude<ItemType, 'all' | 'digital_product'>, id: string) {
  if (!id) return
  request
    .post('/admin/translate-item', { type, id }, { timeout: 30000, silentError: true } as any)
    .catch(() => {})
}
