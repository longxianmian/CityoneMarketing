import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Tag, Space, Spin } from 'antd'
import {
  EnvironmentOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useI18n, type AppLanguage, pickLocalizedText } from '../../i18n'
import UserBottomNav from '../../components/user/UserBottomNav'
import request from '../../api/request'

type LocalizedField = Partial<Record<AppLanguage, string>>

interface NearbyStation {
  id: string
  name: { zh: string; th?: string; en?: string }
  distance_km: number
  available: number
  capacity: number
  status: string
}

export default function NearbyPage() {
  const navigate = useNavigate()
  const { language, t } = useI18n()
  const [hasLocation, setHasLocation] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationText, setLocationText] = useState('')
  const [nearbyStations, setNearbyStations] = useState<NearbyStation[]>([])
  const [stationsLoading, setStationsLoading] = useState(false)

  const text = useMemo(() => {
    const map = {
      zh: {
        title: '附近',
        subtitle: '查看周围 3km 范围内可参与、可使用、可借电的内容',
        locateTitle: '获取当前位置',
        locateDesc: '允许定位后，系统将优先展示你周围 3km 范围内的活动、卡券和站点。',
        locateBtn: '允许定位并查看附近',
        retryBtn: '重新定位',
        currentRange: '当前范围：3km',
        currentLocation: '当前位置',
        nearbyActivities: '附近活动',
        nearbyCoupons: '附近可用券',
        nearbyStations: '附近站点',
        backHome: '返回首页',
      },
      th: {
        title: 'ใกล้คุณ',
        subtitle: 'ดูสิ่งที่เข้าร่วมได้ ใช้ได้ และยืมได้ภายในระยะ 3 กม. รอบตัวคุณ',
        locateTitle: 'รับตำแหน่งปัจจุบัน',
        locateDesc: 'หลังอนุญาตตำแหน่ง ระบบจะแสดงกิจกรรม คูปอง และสถานีภายในระยะ 3 กม. รอบตัวคุณก่อน',
        locateBtn: 'อนุญาตตำแหน่งและดูใกล้คุณ',
        retryBtn: 'ระบุตำแหน่งใหม่',
        currentRange: 'ช่วงปัจจุบัน: 3 กม.',
        currentLocation: 'ตำแหน่งปัจจุบัน',
        nearbyActivities: 'กิจกรรมใกล้คุณ',
        nearbyCoupons: 'คูปองที่ใช้ได้ใกล้คุณ',
        nearbyStations: 'สถานีใกล้คุณ',
        backHome: 'กลับหน้าหลัก',
      },
      en: {
        title: 'Nearby',
        subtitle: 'See activities, coupons, and stations available within 3km around you',
        locateTitle: 'Get Current Location',
        locateDesc: 'After allowing location, the system will prioritize activities, coupons, and stations within 3km around you.',
        locateBtn: 'Allow Location and View Nearby',
        retryBtn: 'Locate Again',
        currentRange: 'Current range: 3km',
        currentLocation: 'Current location',
        nearbyActivities: 'Nearby Activities',
        nearbyCoupons: 'Nearby Available Coupons',
        nearbyStations: 'Nearby Stations',
        backHome: 'Back to Home',
      },
    } as const
    return map[language]
  }, [language])

  const fetchNearbyStations = (lat: number, lng: number, radius = 3) => {
    setStationsLoading(true)
    request.get('/stations/nearby', { params: { lat: String(lat), lng: String(lng), radius: String(radius) } })
      .then((res: any) => {
        const data = res?.data || res
        if (data?.list) setNearbyStations(data.list)
      })
      .catch(() => {})
      .finally(() => setStationsLoading(false))
  }

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationText(t('common.geoNotSupported'))
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setLocating(false)
        setHasLocation(true)
        setLocationText(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        fetchNearbyStations(latitude, longitude)
      },
      () => {
        setLocating(false)
        setLocationText(t('common.geoFailed'))
      }
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px 90px' }}>
        <div
          style={{
            borderRadius: 22,
            background: 'linear-gradient(135deg, #2CDBCE 0%, #2F80FF 100%)',
            color: '#fff',
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <EnvironmentOutlined style={{ fontSize: 24 }} />
            <div style={{ fontSize: 26, fontWeight: 800 }}>{text.title}</div>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.8, opacity: 0.96 }}>{text.subtitle}</div>
        </div>

        <Card style={{ borderRadius: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{text.locateTitle}</div>
          <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 14 }}>{text.locateDesc}</div>

          <Space wrap>
            <Button type="primary" onClick={requestLocation} loading={locating}>
              {hasLocation ? text.retryBtn : text.locateBtn}
            </Button>
            <Tag color="blue">{text.currentRange}</Tag>
          </Space>

          {locationText ? (
            <div style={{ marginTop: 14, color: '#555' }}>
              <b>{text.currentLocation}：</b>{locationText}
            </div>
          ) : null}
        </Card>

        <div style={{ display: 'grid', gap: 16 }}>
          <Card style={{ borderRadius: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{text.nearbyActivities}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {nearbyActivities.map((item) => (
                <Card key={item.id} size="small" style={{ borderRadius: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontWeight: 700 }}>
                      {pickLocalizedText({ title: item.title }, 'title', language)}
                    </div>
                    <Tag>{item.distance}</Tag>
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          <Card style={{ borderRadius: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{text.nearbyCoupons}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {nearbyCoupons.map((item) => (
                <Card key={item.id} size="small" style={{ borderRadius: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontWeight: 700 }}>
                      {pickLocalizedText({ title: item.title }, 'title', language)}
                    </div>
                    <Tag color="gold">{item.distance}</Tag>
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          <Card style={{ borderRadius: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{text.nearbyStations}</div>
            {stationsLoading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
            ) : nearbyStations.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#bbb', padding: 16, fontSize: 14 }}>
                {hasLocation ? '周围 3km 内暂无可用站点' : '获取位置后将显示附近站点'}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {nearbyStations.map((item) => (
                  <Card key={item.id} size="small" style={{ borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>
                          {pickLocalizedText({ name: item.name }, 'name', language)}
                        </div>
                        <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ThunderboltOutlined style={{ color: '#2CDBCE' }} />
                          {language === 'zh' ? `可借 ${item.available}/${item.capacity} 个` :
                           language === 'th' ? `ยืมได้ ${item.available}/${item.capacity}` :
                           `${item.available}/${item.capacity} available`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <Tag color="green">{item.distance_km.toFixed(2)} km</Tag>
                        {item.status === 'active' ? (
                          <Tag color="blue" style={{ marginTop: 4, display: 'block' }}>
                            {language === 'zh' ? '运营中' : language === 'th' ? 'เปิดให้บริการ' : 'Active'}
                          </Tag>
                        ) : (
                          <Tag color="orange" style={{ marginTop: 4, display: 'block' }}>
                            {language === 'zh' ? '维护中' : language === 'th' ? 'ซ่อมบำรุง' : 'Maintenance'}
                          </Tag>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div style={{ marginTop: 16 }}>
          <Button block onClick={() => navigate('/welfare')}>
            {text.backHome}
          </Button>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <UserBottomNav
          current="home"
          onHome={() => navigate('/welfare')}
          onAgent={() => navigate('/agent')}
          onMine={() => navigate('/mine')}
          activeColor="#1677ff"
        />
      </div>
    </div>
  )
}
