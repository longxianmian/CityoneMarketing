import React, { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { App, Button, Card, Space } from 'antd'
import UserPageHeader from '../../components/user/UserPageHeader'
import PageFooter from '../../components/user/PageFooter'
import { useI18n } from '../../i18n'

type BenefitUseKind = 'charge' | 'exchange'

const PAGE_COPY: Record<
  BenefitUseKind,
  Record<
    'zh' | 'th' | 'en',
    {
      title: string
      headline: string
      body: string
      primary: string
      secondary: string
      modalTitle: string
      modalContent: string
    }
  >
> = {
  charge: {
    zh: {
      title: '扫码充电',
      headline: '充电券使用入口',
      body: '你的权益已保留在账户中。共享充电宝扫码充电能力正在对接中，当前可先查看附近站点，后续会在这里直接接入扫码充电流程。',
      primary: '查看附近站点',
      secondary: '返回我的权益',
      modalTitle: '能力对接中',
      modalContent: '共享充电宝扫码充电能力正在对接中，请稍后使用。',
    },
    th: {
      title: 'สแกนเพื่อชาร์จ',
      headline: 'ทางเข้าใช้งานคูปองชาร์จ',
      body: 'สิทธิ์ของคุณถูกเก็บไว้ในบัญชีแล้ว ความสามารถสแกนเพื่อใช้กับพาวเวอร์แบงก์กำลังอยู่ระหว่างการเชื่อมต่อ ตอนนี้สามารถดูสถานีใกล้เคียงได้ก่อน',
      primary: 'ดูสถานีใกล้เคียง',
      secondary: 'กลับไปสิทธิ์ของฉัน',
      modalTitle: 'กำลังเชื่อมต่อความสามารถ',
      modalContent: 'ความสามารถสแกนเพื่อใช้กับพาวเวอร์แบงก์กำลังเชื่อมต่ออยู่ โปรดลองอีกครั้งภายหลัง',
    },
    en: {
      title: 'Scan to Charge',
      headline: 'Charging Benefit Entry',
      body: 'Your benefit is already saved to your account. Shared power bank scan-to-charge is still being connected, so you can check nearby stations here first.',
      primary: 'View Nearby Stations',
      secondary: 'Back to My Benefits',
      modalTitle: 'Integration In Progress',
      modalContent: 'Shared power bank scan-to-charge is still being integrated. Please try again later.',
    },
  },
  exchange: {
    zh: {
      title: '商品兑换',
      headline: '商品兑换入口',
      body: '该权益已切换到商品兑换路径，不会再走重复领取。你可以先浏览福利中心里的商品兑换内容，后续会继续补齐券与具体商品的直连关系。',
      primary: '前往兑换内容',
      secondary: '返回我的权益',
      modalTitle: '已切换为兑换模式',
      modalContent: '该权益会按商品兑换处理，不会再触发领取接口。',
    },
    th: {
      title: 'แลกสินค้า',
      headline: 'ทางเข้าแลกสินค้า',
      body: 'สิทธิ์นี้ถูกเปลี่ยนไปยังเส้นทางแลกสินค้าแล้ว และจะไม่เรียกขั้นตอนรับสิทธิ์ซ้ำอีก คุณสามารถเข้าไปดูเนื้อหาการแลกสินค้าในศูนย์สิทธิ์ก่อนได้',
      primary: 'ไปยังหน้าแลกสินค้า',
      secondary: 'กลับไปสิทธิ์ของฉัน',
      modalTitle: 'เปลี่ยนเป็นโหมดแลกสินค้าแล้ว',
      modalContent: 'สิทธิ์นี้จะทำงานแบบแลกสินค้า และจะไม่เรียก API รับสิทธิ์ซ้ำอีก',
    },
    en: {
      title: 'Product Exchange',
      headline: 'Exchange Entry',
      body: 'This benefit now follows the product exchange path and will no longer trigger the claim API again. You can browse exchange content in the Benefits Center for now.',
      primary: 'Browse Exchange Content',
      secondary: 'Back to My Benefits',
      modalTitle: 'Exchange Mode Enabled',
      modalContent: 'This benefit now uses the exchange flow and will no longer hit the claim API.',
    },
  },
}

export default function BenefitUsePage() {
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const { kind } = useParams<{ kind: BenefitUseKind }>()
  const { language } = useI18n()
  const lang = (language === 'zh' || language === 'th' || language === 'en')
    ? language
    : 'zh'
  const safeKind: BenefitUseKind = kind === 'exchange' ? 'exchange' : 'charge'
  const copy = PAGE_COPY[safeKind][lang]

  useEffect(() => {
    modal.info({
      title: copy.modalTitle,
      content: copy.modalContent,
      okText: lang === 'zh' ? '知道了' : lang === 'th' ? 'ตกลง' : 'OK',
      centered: true,
    })
  }, [copy.modalContent, copy.modalTitle, lang, modal])

  const primaryRoute = safeKind === 'charge' ? '/nearby' : '/welfare?tab=mall'

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9FC', display: 'flex', flexDirection: 'column' }}>
      <UserPageHeader title={copy.title} onBack={() => navigate('/mine?tab=benefit')} />

      <div style={{ flex: 1, padding: '20px 16px 40px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <Card
            style={{
              borderRadius: 22,
              boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
            }}
          >
            <div
              style={{
                background: safeKind === 'charge'
                  ? 'linear-gradient(135deg, #2CDBCE 0%, #2F80FF 100%)'
                  : 'linear-gradient(135deg, #FF7A59 0%, #FFB36B 100%)',
                borderRadius: 18,
                padding: '18px 18px 20px',
                color: '#fff',
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 15, opacity: 0.9, marginBottom: 8 }}>
                {safeKind === 'charge' ? 'CityOne Benefit' : 'CityOne Exchange'}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
                {copy.headline}
              </div>
            </div>

            <div style={{ fontSize: 14, color: '#475467', lineHeight: 1.9, marginBottom: 22 }}>
              {copy.body}
            </div>

            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" size="large" block onClick={() => navigate(primaryRoute)}>
                {copy.primary}
              </Button>
              <Button size="large" block onClick={() => navigate('/mine?tab=benefit')}>
                {copy.secondary}
              </Button>
            </Space>
          </Card>
          <PageFooter />
        </div>
      </div>
    </div>
  )
}
