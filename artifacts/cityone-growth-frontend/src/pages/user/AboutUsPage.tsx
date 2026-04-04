import React from 'react'
import { useNavigate } from 'react-router-dom'
import UserPageHeader from '../../components/user/UserPageHeader'
import PageFooter from '../../components/user/PageFooter'
import { useI18n } from '../../i18n'

type AppLanguage = 'zh' | 'th' | 'en'

const aboutData: Record<AppLanguage, { title: string; content: string }> = {
  zh: {
    title: '关于我们',
    content: 'CityOne 致力于为用户提供便捷、可靠的共享充电宝服务与配套福利体验。本福利中心是 CityOne 为 LINE 用户专属打造的服务入口，集合活动信息、优惠券、积分、站点查询及 AI 助理于一体。\n\n我们持续优化产品与服务，努力为每一位用户带来更好的借电体验与福利权益。如您有任何建议、问题或合作意向，欢迎通过官方渠道与我们联系。\n\n感谢您选择 CityOne，我们期待与您共同成长。',
  },
  th: {
    title: 'เกี่ยวกับเรา',
    content: 'CityOne มุ่งมั่นมอบบริการแบตเตอรี่สำรองร่วมที่สะดวกและเชื่อถือได้ พร้อมประสบการณ์สิทธิประโยชน์ที่ครบครันให้แก่ผู้ใช้ ศูนย์สิทธิประโยชน์นี้เป็นประตูบริการที่ CityOne สร้างขึ้นเฉพาะสำหรับผู้ใช้ LINE รวบรวมข้อมูลกิจกรรม คูปอง คะแนน การค้นหาสถานี และ AI Assistant ไว้ในที่เดียว\n\nเราพัฒนาผลิตภัณฑ์และบริการอย่างต่อเนื่อง เพื่อมอบประสบการณ์การยืมแบตเตอรี่และสิทธิประโยชน์ที่ดียิ่งขึ้นแก่ทุกคน หากคุณมีข้อเสนอแนะ คำถาม หรือความสนใจในการร่วมงาน ยินดีต้อนรับให้ติดต่อเราผ่านช่องทางทางการ\n\nขอบคุณที่เลือก CityOne เราหวังว่าจะเติบโตไปพร้อมกับคุณ',
  },
  en: {
    title: 'About Us',
    content: "CityOne is dedicated to providing users with convenient and reliable shared power bank services and a comprehensive benefits experience. This Benefits Center is an exclusive service portal built by CityOne for LINE users, integrating campaign information, coupons, points, station search, and AI Assistant in one place.\n\nWe continuously improve our products and services to deliver a better power bank rental experience and benefit entitlements to every user. If you have any suggestions, questions, or partnership inquiries, please feel free to contact us through our official channels.\n\nThank you for choosing CityOne. We look forward to growing together with you.",
  },
}

export default function AboutUsPage() {
  const navigate = useNavigate()
  const { language } = useI18n()
  const lang = (language as AppLanguage) in aboutData ? (language as AppLanguage) : 'zh'
  const { title, content } = aboutData[lang]

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
