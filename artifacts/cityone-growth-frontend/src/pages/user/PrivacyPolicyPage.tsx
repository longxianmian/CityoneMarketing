import React from 'react'
import { useNavigate } from 'react-router-dom'
import UserPageHeader from '../../components/user/UserPageHeader'
import PageFooter from '../../components/user/PageFooter'
import { useI18n } from '../../i18n'

type AppLanguage = 'zh' | 'th' | 'en'

const policyData: Record<AppLanguage, { title: string; content: string }> = {
  zh: {
    title: '隐私政策',
    content: '本系统由 CityOne 提供，致力于保护用户的个人隐私与信息安全。我们仅在必要范围内收集与使用用户信息，包括您的 LINE 账户基本信息（如显示名称、头像），用于系统识别、活动参与及福利发放。\n\n我们不会将您的个人信息出售或以任何形式提供给与本系统服务无关的第三方。对于为实现系统功能而必须合作的服务方，我们将要求其依照同等安全标准处理您的信息。\n\n部分功能可能需要获取您的位置权限，以便为您展示附近站点信息。位置数据仅用于此目的，不会被长期存储或用于其他用途。\n\n我们将采取合理技术措施保障您的信息安全，防止未授权访问、泄露或滥用。如您对隐私相关事项有任何疑问，请通过平台公布的官方渠道联系 CityOne。\n\nCityOne 保留根据运营需要或法律法规要求对本政策进行更新的权利。政策更新后将以系统页面方式通知用户，继续使用本系统即视为同意更新内容。感谢您的信任。',
  },
  th: {
    title: 'นโยบายความเป็นส่วนตัว',
    content: 'ระบบนี้จัดให้โดย CityOne ซึ่งมุ่งมั่นปกป้องความเป็นส่วนตัวและความปลอดภัยของข้อมูลผู้ใช้ เราจะรวบรวมและใช้ข้อมูลของคุณเฉพาะในขอบเขตที่จำเป็น ซึ่งรวมถึงข้อมูลพื้นฐานจากบัญชี LINE ของคุณ (เช่น ชื่อที่แสดง รูปโปรไฟล์) เพื่อใช้ในการระบุตัวตน การเข้าร่วมกิจกรรม และการมอบสิทธิประโยชน์\n\nเราจะไม่ขายหรือเปิดเผยข้อมูลส่วนตัวของคุณให้แก่บุคคลที่สามที่ไม่เกี่ยวข้องกับบริการของระบบนี้ สำหรับผู้ให้บริการที่ต้องร่วมงานด้วยเพื่อให้ระบบทำงานได้ เราจะกำหนดให้จัดการข้อมูลของคุณตามมาตรฐานความปลอดภัยที่เท่าเทียมกัน\n\nฟังก์ชันบางอย่างอาจต้องใช้สิทธิ์เข้าถึงตำแหน่งที่ตั้ง เพื่อแสดงข้อมูลสถานีใกล้เคียง ข้อมูลตำแหน่งจะถูกใช้เพื่อวัตถุประสงค์นี้เท่านั้น และจะไม่ถูกจัดเก็บในระยะยาวหรือนำไปใช้เพื่อวัตถุประสงค์อื่น\n\nCityOne สงวนสิทธิ์ในการอัปเดตนโยบายนี้ตามความต้องการในการดำเนินงานหรือข้อกำหนดทางกฎหมาย การอัปเดตนโยบายจะแจ้งให้ผู้ใช้ทราบผ่านหน้าระบบ การใช้งานระบบต่อไปถือว่ายอมรับเนื้อหาที่อัปเดต ขอบคุณสำหรับความไว้วางใจ',
  },
  en: {
    title: 'Privacy Policy',
    content: "This system is provided by CityOne and is committed to protecting users' personal privacy and information security. We collect and use your information only to the extent necessary, including basic information from your LINE account (such as display name and profile picture), for system identification, activity participation, and benefit distribution.\n\nWe will not sell or provide your personal information to third parties unrelated to the services of this system. For service providers that must collaborate to enable system functions, we require them to handle your information according to equivalent security standards.\n\nSome features may require access to your location to display nearby station information. Location data is used solely for this purpose and will not be stored long-term or used for other purposes.\n\nWe will take reasonable technical measures to ensure the security of your information against unauthorized access, disclosure, or misuse. If you have any questions about privacy, please contact CityOne through the official channels published on the platform.\n\nCityOne reserves the right to update this policy as needed for operational purposes or legal requirements. Users will be notified of updates via the system page. Continued use of the system constitutes acceptance of the updated content. Thank you for your trust.",
  },
}

export default function PrivacyPolicyPage() {
  const navigate = useNavigate()
  const { language } = useI18n()
  const lang = (language as AppLanguage) in policyData ? (language as AppLanguage) : 'zh'
  const { title, content } = policyData[lang]

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9FC', display: 'flex', flexDirection: 'column' }}>
      <UserPageHeader title={title} onBack={() => navigate(-1)} />

      <div style={{ flex: 1, padding: '20px 20px 0' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 18,
            padding: '20px 18px',
            boxShadow: '0 4px 16px rgba(15,23,42,0.06)',
          }}
        >
          {content.split('\n\n').map((para, i, arr) => (
            <p
              key={i}
              style={{
                fontSize: 14,
                color: '#374151',
                lineHeight: 1.85,
                marginBottom: i < arr.length - 1 ? 16 : 0,
              }}
            >
              {para}
            </p>
          ))}
        </div>
        <PageFooter />
      </div>
    </div>
  )
}
