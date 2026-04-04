import React from 'react'
import { useI18n } from '../../i18n'

const footerText = {
  zh: '本页面内容仅供用户了解系统说明与相关规则，具体以系统实时展示为准。',
  th: 'เนื้อหาในหน้านี้มีไว้เพื่อให้ผู้ใช้เข้าใจคำอธิบายระบบและกฎที่เกี่ยวข้อง โดยให้ยึดตามข้อมูลที่แสดงในระบบแบบเรียลไทม์เป็นหลัก',
  en: 'The content on this page is provided for users to understand system information and related rules. Please refer to the real-time information displayed in the system.',
}

export default function PageFooter() {
  const { language } = useI18n()
  const lang = language as keyof typeof footerText
  const desc = footerText[lang] ?? footerText.zh

  return (
    <div
      style={{
        borderTop: '1px solid #E5E9F0',
        marginTop: 32,
        padding: '24px 20px 36px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 15, color: '#1A2233', letterSpacing: 1, marginBottom: 8 }}>
        CityOne
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.75, maxWidth: 300, margin: '0 auto 12px' }}>
        {desc}
      </div>
      <div style={{ fontSize: 11, color: '#C4CAD4' }}>
        © CityOne. All rights reserved.
      </div>
    </div>
  )
}
