/**
 * ml.ts — Multilingual (Multi-Language) Canonical Utility
 *
 * 大厂做法：所有多语言 "选字" 逻辑集中到这一个文件。
 * 业务组件通过 useMLPick() 拿到的 pick() 函数，永远使用正确的当前语言，
 * 不可能漏传 lang、不可能写死 'zh'。
 *
 * 规则：
 *  - 永远不要在业务组件里写 v?.zh / v[lang] / v.zh || v.en
 *  - 永远不要直接调用 pickML(v) ——  要用 pick = useMLPick()
 *  - 翻译后端字段名写在 apiFields.ts，不要在多处硬编码
 */

import { useI18n } from '../i18n'

export type MLValue = { zh?: string; th?: string; en?: string } | string | null | undefined

/**
 * 纯工具函数（可在非 React 环境使用）
 * fallback 顺序：指定语言 → en → zh → th → ''
 */
export function pickML(v: MLValue, lang = 'zh'): string {
  if (!v) return ''
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      if (parsed && typeof parsed === 'object') return pickML(parsed, lang)
    } catch {}
    return v
  }
  if (typeof v === 'object') {
    return (v as any)[lang] || (v as any).en || (v as any).zh || (v as any).th || ''
  }
  return ''
}

/**
 * 将 multilingual 值转为标准对象，保证三语言 key 都存在
 */
export function toMLObj(v: MLValue): { zh: string; th: string; en: string } {
  if (!v) return { zh: '', th: '', en: '' }
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      if (p && typeof p === 'object') return { zh: p.zh || '', th: p.th || '', en: p.en || '' }
    } catch {}
    return { zh: v, th: '', en: '' }
  }
  if (typeof v === 'object') {
    return { zh: (v as any).zh || '', th: (v as any).th || '', en: (v as any).en || '' }
  }
  return { zh: String(v), th: '', en: '' }
}

/**
 * React Hook — 在组件里使用，返回一个始终用当前语言选字的 pick 函数
 *
 * 用法：
 *   const pick = useMLPick()
 *   ...
 *   render: (v) => pick(v)   // 永远正确，语言切换时表格自动刷新
 */
export function useMLPick(): (v: MLValue) => string {
  const { language } = useI18n()
  return (v: MLValue) => pickML(v, language)
}
