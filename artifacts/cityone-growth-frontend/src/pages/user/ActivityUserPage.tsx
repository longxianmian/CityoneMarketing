// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止页面自行推断身份或自行恢复参与动作。
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, Tag, Space, Spin } from 'antd'
import { CheckCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { pickLocalizedText, useI18n, type AppLanguage } from '../../i18n'
import request from '../../api/request'
import { useFollowGate } from '../../hooks/useFollowGate'

type LocalizedField = Partial<Record<AppLanguage, string>>

type ActivityContent = {
  id: number
  title: LocalizedField
  subTitle: LocalizedField
  coverImage: string
  coverVideo: string
  description: LocalizedField
  highlights: LocalizedField
  participationGuide: LocalizedField
  rewardGuide: LocalizedField
  noticeText: LocalizedField
  buttonText: LocalizedField
}

const mockActivities: Record<string, ActivityContent> = {
  '1': {
    id: 1,
    title: {
      zh: '扫码抽奖赢免费时长',
      th: 'สแกนเพื่อลุ้นรับเวลาฟรี',
      en: 'Scan to win free charging time',
    },
    subTitle: {
      zh: '新用户扫码参与，完成关注即可抽奖',
      th: 'ผู้ใช้ใหม่สแกนเข้าร่วม ติดตาม OA แล้วลุ้นรับรางวัล',
      en: 'New users can scan to join and enter the lucky draw after following OA',
    },
    coverImage: '',
    coverVideo: '',
    description: {
      zh: '这是活动整体说明，用户进入后能快速理解活动价值与参与方式。',
      th: 'นี่คือคำอธิบายกิจกรรมโดยรวม เพื่อให้ผู้ใช้เข้าใจคุณค่าและวิธีเข้าร่วมได้อย่างรวดเร็ว',
      en: 'This is the overall activity description so users can quickly understand the value and how to participate.',
    },
    highlights: {
      zh: '低门槛参与、适合线上传播、可快速拉新关注。',
      th: 'เข้าร่วมง่าย เหมาะกับการกระจายบนออนไลน์ และช่วยเพิ่มผู้ติดตามใหม่ได้รวดเร็ว',
      en: 'Low barrier to join, suitable for online promotion, and effective for acquiring new followers.',
    },
    participationGuide: {
      zh: '扫码进入活动页 → 先关注 OA → 点击参与活动 → 获得奖励。',
      th: 'สแกนเข้าสู่หน้ากิจกรรม → ติดตาม OA ก่อน → กดเข้าร่วมกิจกรรม → รับรางวัล',
      en: 'Scan to enter the activity page → Follow OA first → Tap to join → Receive rewards.',
    },
    rewardGuide: {
      zh: '奖励包含免费时长券、优惠券等奖励，具体以活动规则为准。',
      th: 'รางวัลอาจรวมถึงคูปองเวลาฟรีและคูปองส่วนลด โดยยึดตามกติกากิจกรรม',
      en: 'Rewards may include free-time coupons and discount coupons, subject to the activity rules.',
    },
    noticeText: {
      zh: '每位用户每日限参与一次，活动最终解释权归平台所有。',
      th: 'ผู้ใช้แต่ละคนเข้าร่วมได้วันละ 1 ครั้ง สิทธิ์การตีความสุดท้ายเป็นของแพลตฟอร์ม',
      en: 'Each user can participate once per day. Final interpretation belongs to the platform.',
    },
    buttonText: {
      zh: '去参与活动',
      th: 'เข้าร่วมกิจกรรม',
      en: 'Join Now',
    },
  },
  '2': {
    id: 2,
    title: {
      zh: '站点首借免单',
      th: 'ยืมครั้งแรกฟรีที่สถานี',
      en: 'First borrow free at station',
    },
    subTitle: {
      zh: '现场引导完成首次借电，推动关注转用户',
      th: 'ช่วยนำผู้ใช้ทำการยืมครั้งแรกที่สถานีและเปลี่ยนผู้ติดตามเป็นผู้ใช้จริง',
      en: 'Guide users to complete their first borrow on-site and convert followers into real users.',
    },
    coverImage: '',
    coverVideo: '',
    description: {
      zh: '适用于站点现场物料承接，引导关注后完成首次借电。',
      th: 'เหมาะสำหรับสื่อหน้าสถานี เพื่อพาผู้ใช้ติดตามและยืมครั้งแรก',
      en: 'Suitable for on-site station materials to guide following and completing the first borrow.',
    },
    highlights: {
      zh: '现场转化强、适合门店/设备二维码承接。',
      th: 'แปลงผลได้ดีในสถานที่จริง เหมาะกับร้านค้าและคิวอาร์ที่อุปกรณ์',
      en: 'Strong on-site conversion, suitable for stores and device QR entry.',
    },
    participationGuide: {
      zh: '扫码进入活动页 → 先关注 OA → 借电成功 → 免单生效。',
      th: 'สแกนเข้าหน้ากิจกรรม → ติดตาม OA ก่อน → ยืมสำเร็จ → รับสิทธิ์ฟรี',
      en: 'Scan to enter → Follow OA first → Borrow successfully → Free benefit takes effect.',
    },
    rewardGuide: {
      zh: '完成首次借电后自动享受免单权益。',
      th: 'เมื่อยืมครั้งแรกสำเร็จ จะได้รับสิทธิ์ฟรีโดยอัตโนมัติ',
      en: 'Users automatically enjoy the free-order benefit after completing the first borrow.',
    },
    noticeText: {
      zh: '每位用户仅限首借享受一次。',
      th: 'สิทธิ์นี้ใช้ได้เฉพาะการยืมครั้งแรกเพียงครั้งเดียวต่อผู้ใช้',
      en: 'Each user can enjoy this only once on the first borrow.',
    },
    buttonText: {
      zh: '去借电',
      th: 'ไปยืมพาวเวอร์แบงก์',
      en: 'Borrow Now',
    },
  },
}

function toML(v: any): LocalizedField {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v
  const s = v ? String(v) : ''
  return { zh: s, th: s, en: s }
}

function pick(v: LocalizedField | undefined, lang: AppLanguage): string {
  if (!v) return ''
  return v[lang] || v['zh'] || v['en'] || v['th'] || ''
}

export default function ActivityUserPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { language, t } = useI18n()
  const { guard, checking } = useFollowGate()

  const [activity, setActivity] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    request.get(`/growth/activities/${id}`)
      .then((res: any) => {
        const d = res?.data || res
        setActivity(d)
      })
      .catch(() => setActivity(null))
      .finally(() => setLoading(false))
  }, [id])


  const title = pick(toML(activity?.activity_name || activity?.activity_title), language)
  const subTitle = pick(toML(activity?.activity_subtitle), language)
  const description = pick(toML(activity?.activity_desc), language)
  const highlights = pick(toML(activity?.highlights), language)
  const participationGuide = pick(toML(activity?.participation_guide), language)
  const rewardGuide = pick(toML(activity?.reward_guide), language)
  const noticeText = pick(toML(activity?.notice_text), language)
  const coverImage = activity?.cover_image || ''
  const coverVideo = activity?.cover_video || ''
  const buttonText = t('detail.joinActivity') || '参与活动'

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!activity) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>😕</div>
        <div style={{ color: '#888' }}>活动不存在或已结束</div>
        <Button onClick={() => navigate('/welfare')}>返回首页</Button>
      </div>
    )
  }

  const handlePrimaryAction = () => {
    const entryCode = searchParams.get('entry_code') || ''
    const utmSource = searchParams.get('utm_source') || ''
    guard({
      label: title,
      returnPath: `/activity/${id}`,
      successPath: `/activity/${id}`,
      failPath: `/activity/${id}`,
      back: '/welfare',
      intentAction: 'participate_activity',
      resourceId: id || '',
      source: {
        ...(entryCode && { source_landing_id: entryCode }),
        ...(utmSource && { source_channel_id: utmSource }),
      },
    })
  }


  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 0 32px 0' }}>
        <div
          style={{
            height: 280,
            background: coverImage
              ? `url(${coverImage}) center/cover no-repeat`
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
          {coverVideo ? (
            <Card style={{ marginBottom: 16, borderRadius: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>
                <PlayCircleOutlined style={{ marginRight: 8 }} />
                {t('detail.video')}
              </div>
              <video src={coverVideo} controls style={{ width: '100%', borderRadius: 12 }} />
            </Card>
          ) : null}

          <Card style={{ marginBottom: 16, borderRadius: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t('detail.description')}</div>
            <div style={{ color: '#555', lineHeight: 1.9 }}>{description}</div>
          </Card>

          <Card style={{ marginBottom: 16, borderRadius: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t('detail.highlights')}</div>
            <div style={{ color: '#555', lineHeight: 1.9 }}>{highlights}</div>
          </Card>

          <Card style={{ marginBottom: 16, borderRadius: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t('detail.howToJoin')}</div>
            <div style={{ color: '#555', lineHeight: 1.9 }}>{participationGuide}</div>
          </Card>

          <Card style={{ marginBottom: 16, borderRadius: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t('detail.rewards')}</div>
            <div style={{ color: '#555', lineHeight: 1.9 }}>{rewardGuide}</div>
          </Card>

          <Card style={{ marginBottom: 20, borderRadius: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t('detail.notice')}</div>
            <div style={{ color: '#555', lineHeight: 1.9 }}>{noticeText}</div>
          </Card>

          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" size="large" block icon={<CheckCircleOutlined />} onClick={handlePrimaryAction} disabled={checking}>
              {buttonText}
            </Button>
            <Button size="large" block onClick={() => navigate('/welfare')}>
              {t('detail.backToWelfare')}
            </Button>
          </Space>
        </div>
      </div>
    </div>
  )
}
