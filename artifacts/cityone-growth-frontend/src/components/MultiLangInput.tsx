import React, { useState } from 'react'
import { Input, Button, Segmented, message, Tooltip } from 'antd'
import { TranslationOutlined, LoadingOutlined } from '@ant-design/icons'
import request from '../api/request'

export interface MultiLangValue {
  zh?: string
  th?: string
  en?: string
}

interface MultiLangInputProps {
  value?: MultiLangValue
  onChange?: (val: MultiLangValue) => void
  placeholder?: string
  textarea?: boolean
  rows?: number
  disabled?: boolean
}

const LANG_OPTIONS = [
  { label: '中', value: 'zh' },
  { label: 'ไทย', value: 'th' },
  { label: 'EN', value: 'en' },
]

export default function MultiLangInput({
  value = {},
  onChange,
  placeholder,
  textarea = false,
  rows = 2,
  disabled = false,
}: MultiLangInputProps) {
  const [activeLang, setActiveLang] = useState<'zh' | 'th' | 'en'>('zh')
  const InputComp = textarea ? Input.TextArea : Input

  const current = value[activeLang] ?? ''
  const filled = {
    zh: !!(value.zh?.trim()),
    th: !!(value.th?.trim()),
    en: !!(value.en?.trim()),
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 6 }}>
        {LANG_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setActiveLang(opt.value as 'zh' | 'th' | 'en')}
            style={{
              padding: '2px 10px',
              borderRadius: 4,
              border: `1px solid ${activeLang === opt.value ? '#1677ff' : '#d9d9d9'}`,
              background: activeLang === opt.value ? '#e6f4ff' : '#fff',
              color: activeLang === opt.value ? '#1677ff' : filled[opt.value as 'zh'|'th'|'en'] ? '#52c41a' : '#999',
              fontWeight: activeLang === opt.value ? 600 : 400,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {opt.label}
            {filled[opt.value as 'zh'|'th'|'en'] && activeLang !== opt.value && (
              <span style={{ marginLeft: 3, color: '#52c41a' }}>✓</span>
            )}
          </button>
        ))}
      </div>
      <InputComp
        value={current}
        onChange={(e) =>
          onChange?.({ ...value, [activeLang]: (e as any).target.value })
        }
        placeholder={placeholder || `请输入${activeLang === 'zh' ? '中文' : activeLang === 'th' ? '泰文' : '英文'}内容`}
        rows={textarea ? rows : undefined}
        disabled={disabled}
      />
    </div>
  )
}

const LANG_NAMES_STANDALONE: Record<string, string> = { zh: '中文', th: 'ไทย', en: 'English' }

interface AutoTranslateButtonProps {
  sourceLang?: 'zh' | 'th' | 'en'
  getTexts: () => Record<string, string>
  onResult: (result: Record<string, MultiLangValue>) => void
  label?: string
}

export function AutoTranslateButton({
  sourceLang = 'zh',
  getTexts,
  onResult,
  label,
}: AutoTranslateButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleTranslate = async () => {
    const texts = getTexts()
    const hasContent = Object.values(texts).some((v) => v?.trim())
    if (!hasContent) {
      message.warning(`请先填写 ${LANG_NAMES_STANDALONE[sourceLang]} 内容再翻译`)
      return
    }
    setLoading(true)
    try {
      const res: any = await request.post('/translate', { texts, sourceLang }, { timeout: 8000, silentError: true } as any)
      const result = res.data?.result ?? {}
      if (Object.keys(result).length === 0) {
        message.warning('翻译返回为空，请稍后重试')
        return
      }
      onResult(result)
      message.success('✅ 全字段翻译完成')
    } catch (e: any) {
      message.error('翻译失败：' + (e?.response?.data?.error ?? e?.message ?? '请稍后重试'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tooltip title={`以 ${LANG_NAMES_STANDALONE[sourceLang]} 为源，一键翻译所有多语言字段`}>
      <Button
        size="small"
        icon={loading ? <LoadingOutlined /> : <TranslationOutlined />}
        onClick={handleTranslate}
        disabled={loading}
        style={{ marginBottom: 12 }}
        type="dashed"
      >
        {loading ? '翻译中…' : (label || '一键 AI 翻译所有字段')}
      </Button>
    </Tooltip>
  )
}
