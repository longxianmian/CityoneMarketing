import React, { useState } from 'react'
import { Input, Tabs, Button, Tooltip, message } from 'antd'
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
  sourceLang?: 'zh' | 'th' | 'en'
  fieldKey?: string
  onTranslateRequest?: (sourceLang: string, sourceText: string) => Promise<MultiLangValue>
}

const LANG_TABS = [
  { key: 'zh', label: '中文' },
  { key: 'th', label: 'ไทย' },
  { key: 'en', label: 'EN' },
]

export default function MultiLangInput({
  value = {},
  onChange,
  placeholder,
  textarea = false,
  rows = 2,
  sourceLang = 'zh',
}: MultiLangInputProps) {
  const [activeTab, setActiveTab] = useState('zh')

  const handleChange = (lang: string, text: string) => {
    onChange?.({ ...value, [lang]: text })
  }

  const InputComp = textarea ? Input.TextArea : Input

  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      size="small"
      style={{ marginBottom: 0 }}
      items={LANG_TABS.map(({ key, label }) => ({
        key,
        label,
        children: (
          <InputComp
            value={(value as any)[key] ?? ''}
            onChange={(e) => handleChange(key, (e as any).target.value)}
            placeholder={key === sourceLang ? placeholder : `${label}（可自动翻译）`}
            rows={textarea ? rows : undefined}
          />
        ),
      }))}
    />
  )
}

const LANG_NAMES: Record<string, string> = { zh: '中文', th: 'ไทย', en: 'English' }

interface AutoTranslateButtonProps {
  sourceLang?: 'zh' | 'th' | 'en'
  getTexts: () => Record<string, string>
  onResult: (result: Record<string, MultiLangValue>) => void
}

export function AutoTranslateButton({
  sourceLang = 'zh',
  getTexts,
  onResult,
}: AutoTranslateButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleTranslate = async () => {
    const texts = getTexts()
    const hasContent = Object.values(texts).some((v) => v?.trim())
    if (!hasContent) {
      message.warning(`请先填写${LANG_NAMES[sourceLang]}内容再翻译`)
      return
    }
    setLoading(true)
    try {
      const res: any = await request.post('/api/translate', { texts, sourceLang })
      const result = res.data?.result ?? {}
      if (Object.keys(result).length === 0) {
        message.warning('翻译返回为空，请稍后重试')
        return
      }
      onResult(result)
      message.success('✅ 翻译完成')
    } catch (e: any) {
      message.error('翻译失败：' + (e?.response?.data?.error ?? e?.message ?? '请稍后重试'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tooltip title={`以${LANG_NAMES[sourceLang]}为源，自动翻译到另外两种语言`}>
      <Button
        size="small"
        icon={loading ? <LoadingOutlined /> : <TranslationOutlined />}
        onClick={handleTranslate}
        disabled={loading}
        style={{ marginBottom: 8 }}
      >
        {loading ? '翻译中…' : 'AI 自动翻译'}
      </Button>
    </Tooltip>
  )
}
