import React from 'react'
import { useNavigate } from 'react-router-dom'
import UserPageHeader from '../../components/user/UserPageHeader'
import PageFooter from '../../components/user/PageFooter'
import { useI18n } from '../../i18n'

type AppLanguage = 'zh' | 'th' | 'en'

const agreementData: Record<AppLanguage, { title: string; content: string }> = {
  zh: {
    title: '用户协议',
    content: '欢迎使用 CityOne 共享充电宝福利中心。在您使用本系统提供的活动、福利、卡券、积分、站点查询、借电相关指引及其他服务前，请您仔细阅读本协议内容。您访问、完成 LINE 身份识别、参与活动或继续使用本系统，即视为您已阅读、理解并同意接受本协议的全部内容。\n\n本系统由 CityOne 提供，用于向用户展示活动信息、福利内容、优惠券、积分信息、附近站点以及与共享充电宝服务相关的辅助功能。不同用户因身份状态、活动规则、站点覆盖范围、系统配置及运营安排不同，所看到的内容、可参与的活动及可获得的权益可能存在差异，请以系统实时展示为准。\n\n为保证系统正常运行与活动公平性，用户在使用过程中应遵守法律法规、平台规则及活动说明，不得以任何不正当方式获取福利、刷取奖励、干扰系统运行、冒用他人身份、伪造使用记录或从事其他损害平台、商户、站点或其他用户合法权益的行为。如发现异常、违规或疑似滥用行为，CityOne 有权根据实际情况采取限制参与、暂停服务、撤销奖励、取消资格或其他必要处理措施。\n\n涉及优惠券、奖励、积分或其他福利时，其发放、使用、有效期、适用范围、核销方式及失效条件，均以系统页面展示及活动规则说明为准。部分福利可能存在数量限制、时间限制、用户资格限制或站点范围限制，且不得折现、转售、非法转让或用于任何非正常使用目的，法律法规另有规定或系统特别说明的除外。\n\n涉及共享充电宝的借电、还电、订单、支付、费用结算及相关服务时，将根据 CityOne 及相关服务系统的实际规则执行。用户应确保所提交的信息真实、准确、有效，并妥善保管自身设备及相关识别信息。\n\n因用户个人原因、网络环境、设备异常、定位权限关闭或第三方平台限制等因素造成的部分功能不可用、信息延迟或服务中断，CityOne 将在合理范围内协助处理，但不承担超出法律规定范围之外的责任。\n\n为持续优化服务体验，CityOne 有权根据运营需要、法律法规要求或系统调整，对本协议、活动规则、功能内容及服务方式进行更新、调整或优化。相关内容更新后，将以系统页面展示或其他合理方式通知用户。若您在更新后继续使用本系统，即视为您同意更新后的相关内容。如您对本协议或系统服务有任何疑问，建议您通过平台公布的官方渠道联系 CityOne。感谢您的理解与支持。',
  },
  th: {
    title: 'ข้อตกลงผู้ใช้',
    content: 'ยินดีต้อนรับสู่ศูนย์สิทธิประโยชน์แบตเตอรี่สำรองร่วม CityOne ก่อนที่คุณจะใช้กิจกรรม สิทธิประโยชน์ คูปอง คะแนน การค้นหาสถานี คำแนะนำที่เกี่ยวข้องกับการยืมแบตเตอรี่ หรือบริการอื่น ๆ ที่มีอยู่ในระบบนี้ โปรดอ่านข้อตกลงฉบับนี้อย่างละเอียด การเข้าถึง การยืนยันตัวตนผ่าน LINE การเข้าร่วมกิจกรรม หรือการใช้งานระบบนี้ต่อไป ถือว่าคุณได้อ่าน เข้าใจ และยอมรับเงื่อนไขทั้งหมดของข้อตกลงนี้แล้ว\n\nระบบนี้จัดให้โดย CityOne เพื่อใช้แสดงข้อมูลกิจกรรม สิทธิประโยชน์ คูปอง คะแนน สถานีใกล้เคียง และฟังก์ชันที่เกี่ยวข้องกับบริการแบตเตอรี่สำรองร่วม ทั้งนี้ ผู้ใช้แต่ละรายอาจเห็นเนื้อหา กิจกรรมที่เข้าร่วมได้ หรือสิทธิประโยชน์ที่ได้รับแตกต่างกันไปตามสถานะตัวตน กติกากิจกรรม พื้นที่ให้บริการของสถานี การตั้งค่าระบบ และแผนการดำเนินงานจริง โปรดยึดตามข้อมูลที่แสดงในระบบแบบเรียลไทม์เป็นหลัก\n\nเพื่อให้ระบบทำงานได้ตามปกติและเพื่อความเป็นธรรมของกิจกรรม ผู้ใช้ต้องปฏิบัติตามกฎหมาย กฎของแพลตฟอร์ม และรายละเอียดของกิจกรรม ห้ามใช้วิธีการที่ไม่เหมาะสมเพื่อรับสิทธิประโยชน์ ปั่นรางวัล รบกวนการทำงานของระบบ แอบอ้างตัวตนของผู้อื่น ปลอมแปลงข้อมูลการใช้งาน หรือกระทำการใด ๆ ที่ก่อให้เกิดความเสียหายต่อแพลตฟอร์ม ร้านค้า สถานี หรือสิทธิอันชอบด้วยกฎหมายของผู้ใช้อื่น\n\nหากตรวจพบพฤติกรรมผิดปกติ การละเมิด หรือการใช้งานในทางที่ไม่เหมาะสม CityOne มีสิทธิ์จำกัดการเข้าร่วม ระงับบริการ เพิกถอนรางวัล ยกเลิกสิทธิ์ หรือดำเนินมาตรการที่จำเป็นตามความเหมาะสม สำหรับคูปอง รางวัล คะแนน หรือสิทธิประโยชน์อื่น ๆ เงื่อนไขการแจก การใช้งาน ระยะเวลาที่มีผล ขอบเขตการใช้ วิธีการใช้สิทธิ์ และเงื่อนไขการสิ้นสุด ให้ยึดตามข้อมูลที่แสดงบนหน้าระบบและคำอธิบายของกิจกรรมเป็นหลัก\n\nสำหรับบริการหลักที่เกี่ยวข้องกับการยืมแบตเตอรี่ การคืนแบตเตอรี่ คำสั่งซื้อ การชำระเงิน การคิดค่าบริการ และบริการที่เกี่ยวข้อง จะเป็นไปตามกฎการให้บริการจริงของ CityOne ผู้ใช้ต้องรับรองว่าข้อมูลที่ให้ไว้เป็นความจริง ถูกต้อง และมีผล และต้องดูแลอุปกรณ์และข้อมูลระบุตัวตนที่เกี่ยวข้องอย่างเหมาะสม\n\nCityOne มีสิทธิ์อัปเดต ปรับปรุง หรือเพิ่มประสิทธิภาพข้อตกลงนี้ กติกากิจกรรม เนื้อหาฟังก์ชัน และวิธีการให้บริการตามความจำเป็นในการดำเนินงาน ข้อกำหนดทางกฎหมาย หรือการปรับปรุงระบบ เนื้อหาที่อัปเดตจะแจ้งให้ผู้ใช้ทราบผ่านหน้าระบบหรือช่องทางที่เหมาะสม หากคุณยังคงใช้ระบบนี้หลังจากการอัปเดต ถือว่าคุณยอมรับเนื้อหาที่อัปเดตแล้ว ขอบคุณสำหรับความไว้วางใจและการสนับสนุน',
  },
  en: {
    title: 'User Agreement',
    content: "Welcome to the CityOne Shared Power Bank Benefits Center. Before using the activities, benefits, coupons, points services, station search, rental-related guidance, or any other services provided through this system, please read this agreement carefully. By accessing the system, completing LINE identity recognition, participating in activities, or continuing to use this system, you are deemed to have read, understood, and agreed to all terms of this agreement.\n\nThis system is provided by CityOne as a portal for displaying campaign information, benefits, coupons, points, nearby stations, and supporting features related to shared power bank services. Depending on identity status, campaign rules, station coverage, system settings, and actual operational arrangements, different users may see different content, available activities, and available benefits. Please refer to the real-time information displayed in the system.\n\nTo ensure normal system operation and fair participation in activities, users must comply with applicable laws, platform rules, and campaign instructions. Users must not obtain benefits through improper means, manipulate rewards, interfere with system operations, impersonate others, falsify usage records, or engage in any conduct that may harm the lawful rights and interests of the platform, merchants, stations, or other users.\n\nIf abnormal, unauthorized, or abusive behavior is identified, CityOne reserves the right to restrict participation, suspend services, revoke rewards, cancel eligibility, or take other necessary actions as appropriate. For coupons, rewards, points, or other benefits, the issuance rules, terms of use, validity period, applicable scope, redemption method, and expiration conditions shall be subject to the content displayed on the system pages and the relevant campaign rules.\n\nFor core services related to power bank rental, returns, orders, payments, fee settlement, and related services, the actual rules of CityOne and the relevant service systems shall apply. Users must ensure that the information submitted is truthful, accurate, and valid, and must properly maintain their devices and related identification information.\n\nCityOne reserves the right to update, adjust, or optimize this agreement, campaign rules, feature content, and service methods as needed for operational purposes, legal requirements, or system adjustments. Users will be notified of updates through system pages or other appropriate means. If you continue to use this system after an update, you are deemed to have accepted the updated content. If you have any questions about this agreement or the system services, please contact CityOne through the official channels published on the platform. Thank you for your understanding and support.",
  },
}

export default function UserAgreementPage() {
  const navigate = useNavigate()
  const { language } = useI18n()
  const lang = (language as AppLanguage) in agreementData ? (language as AppLanguage) : 'zh'
  const { title, content } = agreementData[lang]

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
