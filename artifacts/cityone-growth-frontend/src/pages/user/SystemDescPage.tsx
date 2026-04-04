import React from 'react'
import { useNavigate } from 'react-router-dom'
import UserPageHeader from '../../components/user/UserPageHeader'
import PageFooter from '../../components/user/PageFooter'
import { useI18n } from '../../i18n'

type AppLanguage = 'zh' | 'th' | 'en'

const sysDesc: Record<AppLanguage, { title: string; content: string }> = {
  zh: {
    title: '系统说明',
    content:
      '欢迎使用 CityOne 共享充电宝福利中心。本系统是 CityOne 为用户提供的综合服务与福利入口，您可以在这里查看福利活动、优惠券、积分信息、附近站点以及与借电相关的服务指引。系统会根据活动规则、站点情况及您的使用状态，为您提供相应的功能入口和福利内容。\n\n福利中心中的部分活动、奖励、优惠券或服务，可能会因活动时间、站点范围、账户状态、系统配置或实际运营安排而有所不同，请以页面实时展示内容为准。\n\n为保障您的正常使用体验，部分功能可能需要您先完成账号识别、关注官方账号、授权定位或满足相应活动条件后方可使用。涉及借电、还电、订单、支付等核心服务时，相关流程将根据 CityOne 系统规则执行。\n\nCityOne 将持续优化服务、活动内容与系统体验。感谢您的理解与支持，祝您使用愉快。',
  },
  th: {
    title: 'คำอธิบายระบบ',
    content:
      'ยินดีต้อนรับสู่ศูนย์สิทธิประโยชน์แบตเตอรี่สำรองร่วม CityOne ระบบนี้เป็นศูนย์รวมบริการและสิทธิประโยชน์ที่ CityOne จัดเตรียมไว้สำหรับผู้ใช้ คุณสามารถดูโปรโมชัน คูปอง คะแนน สถานีใกล้เคียง และคำแนะนำที่เกี่ยวข้องกับการยืมแบตเตอรี่ได้ที่นี่ ระบบจะแสดงเมนู ฟังก์ชัน และสิทธิประโยชน์ที่เหมาะสมตามเงื่อนไขของกิจกรรม สถานะของสถานี และสถานะการใช้งานของคุณ\n\nกิจกรรม รางวัล คูปอง หรือบริการบางส่วนภายในศูนย์สิทธิประโยชน์ อาจแตกต่างกันไปตามช่วงเวลากิจกรรม พื้นที่ให้บริการ สถานะบัญชี การตั้งค่าระบบ หรือแผนการดำเนินงานจริง กรุณายึดตามข้อมูลที่แสดงบนหน้าจอแบบเรียลไทม์เป็นหลัก\n\nเพื่อให้คุณใช้งานได้อย่างราบรื่น บางฟังก์ชันอาจกำหนดให้คุณต้องยืนยันตัวตน ติดตามบัญชีทางการ อนุญาตการเข้าถึงตำแหน่ง หรือผ่านเงื่อนไขของกิจกรรมก่อนจึงจะใช้งานได้ สำหรับบริการหลัก เช่น การยืมแบตเตอรี่ การคืนแบตเตอรี่ คำสั่งซื้อ และการชำระเงิน ระบบจะดำเนินการตามกฎของ CityOne\n\nCityOne จะพัฒนาบริการ กิจกรรม และประสบการณ์การใช้งานอย่างต่อเนื่อง ขอบคุณสำหรับความไว้วางใจและการสนับสนุน ขอให้คุณใช้งานอย่างราบรื่น',
  },
  en: {
    title: 'System Description',
    content:
      "Welcome to the CityOne Shared Power Bank Benefits Center. This system is CityOne's integrated service and benefits portal for users. Here, you can view promotional offers, coupons, points information, nearby stations, and service guidance related to power bank rental. Based on campaign rules, station availability, and your usage status, the system may present different feature entries and benefit content.\n\nSome activities, rewards, coupons, or services in the Benefits Center may vary depending on campaign period, station coverage, account status, system configuration, or actual operational arrangements. Please refer to the real-time content displayed on the page.\n\nTo ensure a smooth user experience, some functions may require account identification, following the official account, location authorization, or meeting specific campaign conditions before use. For core services such as renting, returning, orders, and payments, the relevant process will be handled according to CityOne system rules.\n\nCityOne will continue to optimize its services, campaign content, and system experience. Thank you for your understanding and support. We hope you enjoy using our services.",
  },
}

export default function SystemDescPage() {
  const navigate = useNavigate()
  const { language } = useI18n()
  const lang = (language as AppLanguage) in sysDesc ? (language as AppLanguage) : 'zh'
  const { title, content } = sysDesc[lang]

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9FC', display: 'flex', flexDirection: 'column' }}>
      <UserPageHeader title={title} onBack={() => navigate(-1)} />

      <div style={{ flex: 1, padding: '20px 20px 40px' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 18,
            padding: '20px 18px',
            boxShadow: '0 4px 16px rgba(15,23,42,0.06)',
          }}
        >
          {content.split('\n\n').map((para, i) => (
            <p
              key={i}
              style={{
                fontSize: 14,
                color: '#374151',
                lineHeight: 1.85,
                marginBottom: i < content.split('\n\n').length - 1 ? 16 : 0,
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
