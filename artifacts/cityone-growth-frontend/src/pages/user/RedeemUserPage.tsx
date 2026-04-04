import React, { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, Space, Tag, Modal } from 'antd'
import { CheckCircleOutlined, PlayCircleOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { pickLocalizedText, useI18n, type AppLanguage } from '../../i18n'

type LocalizedField = Partial<Record<AppLanguage, string>>

type RedeemContent = {
  id: number
  type: 'digital' | 'physical'
  title: LocalizedField
  subTitle: LocalizedField
  coverImage: string
  coverVideo: string
  pointText: LocalizedField
  pickupText: LocalizedField
  highlights: LocalizedField
  description: LocalizedField
  usageGuide: LocalizedField
  noticeText: LocalizedField
  primaryText: LocalizedField
  secondaryText: LocalizedField
}

const mockRedeems: Record<string, RedeemContent> = {
  '1': {
    id: 1,
    type: 'digital',
    title: {
      zh: '电子书会员包',
      th: 'แพ็กสมาชิกอีบุ๊ก',
      en: 'E-book Membership Pack',
    },
    subTitle: {
      zh: '数字商品，当前阶段仅支持积分兑换',
      th: 'สินค้าดิจิทัล ระยะนี้รองรับเฉพาะการแลกด้วยคะแนน',
      en: 'Digital item, currently supports points redemption only.',
    },
    coverImage: '',
    coverVideo: '',
    pointText: { zh: '990 积分', th: '990 คะแนน', en: '990 points' },
    pickupText: {
      zh: '兑换成功后自动发放到账号',
      th: 'แลกสำเร็จแล้วจะมอบเข้าบัญชีอัตโนมัติ',
      en: 'Automatically granted to the account after successful redemption.',
    },
    highlights: {
      zh: '适合线上权益发放，履约简单，转化效率高。',
      th: 'เหมาะกับการมอบสิทธิ์ออนไลน์ ส่งมอบง่าย และแปลงผลได้ดี',
      en: 'Suitable for online benefit delivery, simple fulfillment, and high conversion efficiency.',
    },
    description: {
      zh: '该商品为数字权益商品，可用于会员阅读类权益发放，当前阶段先支持积分兑换。',
      th: 'สินค้านี้เป็นสิทธิ์ดิจิทัล ใช้สำหรับมอบสิทธิ์สมาชิกประเภทการอ่าน โดยระยะแรกจะรองรับการแลกด้วยคะแนนก่อน',
      en: 'This is a digital benefit item for membership-style reading benefits. In the current phase, it supports points redemption first.',
    },
    usageGuide: {
      zh: '积分兑换成功后自动发放到用户账户，无需到店。',
      th: 'เมื่อแลกคะแนนสำเร็จ ระบบจะมอบสิทธิ์ให้บัญชีผู้ใช้โดยอัตโนมัติ ไม่ต้องไปรับที่ร้าน',
      en: 'After successful points redemption, the item is automatically granted to the user account. No store pickup is needed.',
    },
    noticeText: {
      zh: '数字商品一经兑换成功，不支持退换。',
      th: 'สินค้าแบบดิจิทัลเมื่อแลกสำเร็จแล้วไม่รองรับการคืนหรือเปลี่ยน',
      en: 'Digital items are non-refundable after successful redemption.',
    },
    primaryText: { zh: '立即积分兑换', th: 'แลกด้วยคะแนนทันที', en: 'Redeem with Points Now' },
    secondaryText: { zh: '返回福利中心', th: 'กลับสู่ศูนย์สิทธิประโยชน์', en: 'Back to Welfare' },
  },
  '2': {
    id: 2,
    type: 'digital',
    title: {
      zh: '音乐畅听权益',
      th: 'สิทธิ์ฟังเพลงไม่จำกัด',
      en: 'Music Unlimited Access',
    },
    subTitle: {
      zh: '数字商品，当前阶段仅支持积分兑换',
      th: 'สินค้าดิจิทัล ระยะนี้รองรับเฉพาะการแลกด้วยคะแนน',
      en: 'Digital item, currently supports points redemption only.',
    },
    coverImage: '',
    coverVideo: '',
    pointText: { zh: '620 积分', th: '620 คะแนน', en: '620 points' },
    pickupText: {
      zh: '兑换成功后自动发放到账号',
      th: 'แลกสำเร็จแล้วจะมอบเข้าบัญชีอัตโนมัติ',
      en: 'Automatically granted to the account after successful redemption.',
    },
    highlights: {
      zh: '适合做活动奖励、积分商城商品与数字权益承接。',
      th: 'เหมาะเป็นรางวัลกิจกรรม สินค้าแลกคะแนน และสิทธิ์ดิจิทัล',
      en: 'Suitable as an activity reward, a points mall item, and a digital benefit.',
    },
    description: {
      zh: '该商品用于数字音乐类权益发放，当前阶段先支持积分兑换。',
      th: 'สินค้านี้ใช้สำหรับมอบสิทธิ์ด้านดนตรีดิจิทัล โดยระยะแรกจะรองรับการแลกด้วยคะแนนก่อน',
      en: 'This item is for digital music-related benefits. In the current phase, it supports points redemption first.',
    },
    usageGuide: {
      zh: '积分兑换成功后自动发放到用户账户，无需到店。',
      th: 'เมื่อแลกคะแนนสำเร็จ ระบบจะมอบสิทธิ์ให้บัญชีผู้ใช้โดยอัตโนมัติ ไม่ต้องไปรับที่ร้าน',
      en: 'After successful points redemption, the item is automatically granted to the user account. No store pickup is needed.',
    },
    noticeText: {
      zh: '具体权益有效期与发放规则以平台说明为准。',
      th: 'อายุสิทธิ์และกติกาการมอบสิทธิ์ให้ยึดตามคำอธิบายของแพลตฟอร์ม',
      en: 'Please refer to the platform description for the validity period and issuance rules.',
    },
    primaryText: { zh: '立即积分兑换', th: 'แลกด้วยคะแนนทันที', en: 'Redeem with Points Now' },
    secondaryText: { zh: '返回福利中心', th: 'กลับสู่ศูนย์สิทธิประโยชน์', en: 'Back to Welfare' },
  },
  '3': {
    id: 3,
    type: 'physical',
    title: {
      zh: '联名马克杯',
      th: 'แก้วมัคคอลแลบ',
      en: 'Co-branded Mug',
    },
    subTitle: {
      zh: '实物商品，后续二开',
      th: 'สินค้าจริง พัฒนาต่อในระยะถัดไป',
      en: 'Physical item, to be implemented later.',
    },
    coverImage: '',
    coverVideo: '',
    pointText: { zh: '1200 积分', th: '1200 คะแนน', en: '1200 points' },
    pickupText: {
      zh: '实物商品逻辑后续二开',
      th: 'ตรรกะสินค้าจริงจะพัฒนาภายหลัง',
      en: 'Physical item logic will be implemented later.',
    },
    highlights: {
      zh: '实物商品暂不在本轮处理范围。',
      th: 'สินค้าจริงยังไม่อยู่ในขอบเขตรอบนี้',
      en: 'Physical items are not in scope for this round.',
    },
    description: {
      zh: '当前先不处理实物商品兑换逻辑。',
      th: 'ขณะนี้ยังไม่จัดการตรรกะการแลกสินค้าจริง',
      en: 'Physical item redemption is not handled in the current phase.',
    },
    usageGuide: {
      zh: '后续二开处理。',
      th: 'จะพัฒนาต่อในระยะถัดไป',
      en: 'To be implemented later.',
    },
    noticeText: {
      zh: '当前仅优先实现数字商品积分兑换。',
      th: 'ขณะนี้ให้ความสำคัญกับการแลกสินค้าดิจิทัลด้วยคะแนนก่อน',
      en: 'Currently prioritizing digital-item points redemption only.',
    },
    primaryText: { zh: '后续开放', th: 'เปิดใช้งานภายหลัง', en: 'Available Later' },
    secondaryText: { zh: '返回福利中心', th: 'กลับสู่ศูนย์สิทธิประโยชน์', en: 'Back to Welfare' },
  },
}

function parsePointValue(text: string) {
  const matched = text.match(/-?\d+/)
  return matched ? Number(matched[0]) : 0
}

function formatNow() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function RedeemUserPage() {
  const { id = '1' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { language } = useI18n()

  const followed = searchParams.get('followed') === '1'
  const [confirmOpen, setConfirmOpen] = useState(false)
  const redeem = useMemo(() => mockRedeems[id] || mockRedeems['1'], [id])

  const title = pickLocalizedText({ title: redeem.title }, 'title', language)
  const subTitle = pickLocalizedText({ subTitle: redeem.subTitle }, 'subTitle', language)
  const pointText = pickLocalizedText({ pointText: redeem.pointText }, 'pointText', language)
  const pickupText = pickLocalizedText({ pickupText: redeem.pickupText }, 'pickupText', language)
  const highlights = pickLocalizedText({ highlights: redeem.highlights }, 'highlights', language)
  const description = pickLocalizedText({ description: redeem.description }, 'description', language)
  const usageGuide = pickLocalizedText({ usageGuide: redeem.usageGuide }, 'usageGuide', language)
  const noticeText = pickLocalizedText({ noticeText: redeem.noticeText }, 'noticeText', language)
  const primaryText = pickLocalizedText({ primaryText: redeem.primaryText }, 'primaryText', language)
  const secondaryText = pickLocalizedText({ secondaryText: redeem.secondaryText }, 'secondaryText', language)

  const handleFollowDone = () => {
    const next = new URLSearchParams(searchParams)
    next.set('followed', '1')
    setSearchParams(next)
  }

  const handlePrimaryAction = () => {
    if (redeem.type !== 'digital') {
      Modal.info({
        title: title,
        content: '当前阶段先不处理实物商品，请先只测试数字商品积分兑换。',
        okText: '知道了',
      })
      return
    }
    setConfirmOpen(true)
  }

  const handleConfirmRedeem = () => {
    const localKey = 'cityone_local_point_records'
    const current = (() => {
      try {
        return JSON.parse(localStorage.getItem(localKey) || '[]')
      } catch {
        return []
      }
    })()

    const spendPoints = parsePointValue(pointText)

    const newRecord = {
      id: `redeem_${Date.now()}`,
      type: 'spend',
      title: title,
      points: -spendPoints,
      createdAt: formatNow(),
      source: 'digital_redeem',
    }

    localStorage.setItem(localKey, JSON.stringify([newRecord, ...current]))
    setConfirmOpen(false)
    setTimeout(() => {
      navigate('/my-points')
    }, 120)
  }

  if (!followed) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fb', padding: '24px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <Card style={{ borderRadius: 16 }}>
            <div style={{ textAlign: 'center', padding: '12px 0 4px 0' }}>
              <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{title}</div>
              <div style={{ color: '#666', marginBottom: 18 }}>{subTitle}</div>
              <Tag color="orange" style={{ fontSize: 13, padding: '4px 10px' }}>Follow LINE OA First</Tag>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 18,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)',
                border: '1px solid #ffd591',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Follow Required</div>
              <div style={{ color: '#555', lineHeight: 1.8 }}>
                Complete LINE OA follow first, then continue to redeem this item.
              </div>
            </div>

            <Space direction="vertical" style={{ width: '100%', marginTop: 20 }}>
              <Button type="primary" size="large" block onClick={handleFollowDone}>
                Continue After Follow
              </Button>
              <Button size="large" block onClick={() => navigate('/welfare')}>
                Back to Welfare
              </Button>
            </Space>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 0 32px 0' }}>
        <div
          style={{
            height: 280,
            background: redeem.coverImage
              ? `url(${redeem.coverImage}) center/cover no-repeat`
              : redeem.type === 'physical'
                ? 'linear-gradient(135deg, #fa8c16 0%, #ffd666 100%)'
                : 'linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)',
            display: 'flex',
            alignItems: 'flex-end',
            padding: 20,
            color: '#fff',
          }}
        >
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 15, opacity: 0.95 }}>{subTitle}</div>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {redeem.coverVideo ? (
            <Card style={{ marginBottom: 16, borderRadius: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>
                <PlayCircleOutlined style={{ marginRight: 8 }} />
                Video
              </div>
              <video src={redeem.coverVideo} controls style={{ width: '100%', borderRadius: 12 }} />
            </Card>
          ) : null}

          <Card style={{ marginBottom: 16, borderRadius: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <Tag color="blue">{pointText}</Tag>
            </div>
            <div style={{ color: '#555', lineHeight: 1.9 }}>{pickupText}</div>
          </Card>

          <Card style={{ marginBottom: 16, borderRadius: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Highlights</div>
            <div style={{ color: '#555', lineHeight: 1.9 }}>{highlights}</div>
          </Card>

          <Card style={{ marginBottom: 16, borderRadius: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Description</div>
            <div style={{ color: '#555', lineHeight: 1.9 }}>{description}</div>
          </Card>

          <Card style={{ marginBottom: 16, borderRadius: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Points Redeem Guide</div>
            <div style={{ color: '#555', lineHeight: 1.9 }}>{usageGuide}</div>
          </Card>

          <Card style={{ marginBottom: 20, borderRadius: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Notice</div>
            <div style={{ color: '#555', lineHeight: 1.9 }}>{noticeText}</div>
          </Card>

          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" size="large" block icon={<ShoppingCartOutlined />} onClick={handlePrimaryAction}>
              {primaryText}
            </Button>
            <Button size="large" block icon={<CheckCircleOutlined />} onClick={() => navigate('/my-points')}>
              Go to My Points
            </Button>
            <Button size="large" block onClick={() => navigate('/welfare')}>
              {secondaryText}
            </Button>
          </Space>
        </div>
      </div>

      <Modal
        title="确认积分兑换"
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={handleConfirmRedeem}
        okText="确认兑换"
        cancelText="取消"
      >
        <div style={{ display: 'grid', gap: 12, lineHeight: 1.8 }}>
          <div><strong>商品名称：</strong>{title}</div>
          <div><strong>兑换方式：</strong>积分兑换</div>
          <div><strong>所需积分：</strong>{pointText}</div>
          <div><strong>兑换说明：</strong>{pickupText}</div>
          <div><strong>兑换结果：</strong>数字商品兑换成功后将直接发放到账号。</div>
        </div>
      </Modal>
    </div>
  )
}
