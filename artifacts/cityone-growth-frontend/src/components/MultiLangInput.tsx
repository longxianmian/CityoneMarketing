import React, { useState } from 'react'
import { Input, Select, Button, message, Tooltip } from 'antd'
import { TranslationOutlined, LoadingOutlined, DownOutlined, UpOutlined } from '@ant-design/icons'
import request from '../api/request'

export interface MultiLangValue {
  zh?: string
  th?: string
  en?: string
}

type Lang = 'zh' | 'th' | 'en'

const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'th', label: 'ไทย' },
  { value: 'en', label: 'EN' },
]

const LANG_NAMES: Record<Lang, string> = { zh: '中文', th: 'ไทย', en: 'English' }
const OTHER_LANGS: Record<Lang, Lang[]> = {
  zh: ['th', 'en'],
  th: ['zh', 'en'],
  en: ['zh', 'th'],
}

interface MultiLangInputProps {
  value?: MultiLangValue
  onChange?: (val: MultiLangValue) => void
  placeholder?: string
  textarea?: boolean
  rows?: number
  fieldKey?: string
  disabled?: boolean
}

export default function MultiLangInput({
  value = {},
  onChange,
  placeholder,
  textarea = false,
  rows = 2,
  fieldKey = 'text',
  disabled = false,
}: MultiLangInputProps) {
  const [sourceLang, setSourceLang] = useState<Lang>('zh')
  const [translating, setTranslating] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const InputComp = textarea ? Input.TextArea : Input
  const otherLangs = OTHER_LANGS[sourceLang]

  const handleChange = (lang: Lang, text: string) => {
    onChange?.({ ...value, [lang]: text })
  }

  const handleTranslate = async () => {
    const srcText = ((value as any)[sourceLang] ?? '').trim()
    if (!srcText) {
      message.warning(`请先填写 ${LANG_NAMES[sourceLang]} 内容再翻译`)
      return
    }
    setTranslating(true)
    try {
      const res: any = await request.post('/api/translate', {
        texts: { [fieldKey]: srcText },
        sourceLang,
      })
      const translated = res.data?.result?.[fieldKey] || {}
      onChange?.({ ...value, ...translated })
      setExpanded(true)
      message.success('翻译完成')
    } catch (e: any) {
      message.error('翻译失败：' + (e?.response?.data?.error ?? e?.message ?? '请稍后重试'))
    } finally {
      setTranslating(false)
    }
  }

  const hasOtherContent = otherLangs.some((l) => ((value as any)[l] ?? '').trim())

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <Select
          value={sourceLang}
          onChange={(v: Lang) => setSourceLang(v)}
          size="small"
          style={{ width: 72, flexShrink: 0, marginTop: textarea ? 0 : 1 }}
          options={LANG_OPTIONS}
          disabled={disabled}
        />
        <div style={{ flex: 1 }}>
          <InputComp
            value={((value as any)[sourceLang]) ?? ''}
            onChange={(e) => handleChange(sourceLang, (e as any).target.value)}
            placeholder={placeholder}
            rows={textarea ? rows : undefined}
            disabled={disabled}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center' }}>
        <Tooltip title={`以 ${LANG_NAMES[sourceLang]} 为源，AI 自动翻译到另外两种语言`}>
          <Button
            size="small"
            icon={translating ? <LoadingOutlined /> : <TranslationOutlined />}
            onClick={handleTranslate}
            disabled={translating || disabled}
            style={{ fontSize: 12 }}
          >
            {translating ? '翻译中…' : 'AI 自动翻译'}
          </Button>
        </Tooltip>
        <Button
          type="text"
          size="small"
          onClick={() => setExpanded((v) => !v)}
          style={{ color: hasOtherContent ? '#1677ff' : '#aaa', fontSize: 12, padding: '0 4px' }}
          icon={expanded ? <UpOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
        >
          {expanded ? '收起' : hasOtherContent ? '查看/编辑其他语言版本' : '查看/编辑其他语言'}
        </Button>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: 8,
            padding: '10px 12px',
            background: '#FAFBFF',
            borderRadius: 8,
            border: '1px solid #ECF1F6',
          }}
        >
          {otherLangs.map((lang) => (
            <div key={lang} style={{ marginBottom: lang === otherLangs[otherLangs.length - 1] ? 0 : 10 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3, fontWeight: 600 }}>
                {LANG_NAMES[lang]}
                <span style={{ fontWeight: 400, marginLeft: 6, color: '#bbb' }}>（翻译后自动填入，可手动修改）</span>
              </div>
              <InputComp
                value={((value as any)[lang]) ?? ''}
                onChange={(e) => handleChange(lang, (e as any).target.value)}
                placeholder={`${LANG_NAMES[lang]} 内容将在翻译后显示`}
                rows={textarea ? rows : undefined}
                disabled={disabled}
                style={{ background: '#fff' }}
              />
            </div>
          ))}
        </div>
      )}
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
      const res: any = await request.post('/api/translate', { texts, sourceLang })
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
