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
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)

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
        message.success(`翻译完成：补译 ${r.done} 条，已跳过 ${r.skipped} 条`)
        onDone?.()
      } else {
        message.info(`所有数据已有完整翻译，无需补译`)
      }
    } catch (err: any) {
      message.error('批量翻译失败，请检查 AI 服务是否可用')
    } finally {
      setLoading(false)
    }
  }

  const tooltipTitle = result
    ? `上次结果：补译 ${result.done} / 共 ${result.total} 条`
    : '将数据库中泰文/英文为空的内容自动翻译补全'

  return (
    <Tooltip title={tooltipTitle}>
      <Button
        size="small"
        icon={loading ? <LoadingOutlined /> : <TranslationOutlined />}
        onClick={handleClick}
        loading={loading}
        style={{ borderColor: '#2CDBCE', color: '#2CDBCE' }}
      >
        {label || '一键补译'}
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
    .post('/admin/translate-item', { type, id }, { timeout: 30000 } as any)
    .catch(() => {})
}
