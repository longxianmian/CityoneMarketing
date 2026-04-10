import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Tag } from 'antd'
import {
  EnvironmentOutlined,
  ThunderboltOutlined,
  RightOutlined,
  GiftOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useI18n } from '../../i18n'
import UserBottomNav from '../../components/user/UserBottomNav'
import OssImage from '../../components/OssImage'
import request from '../../api/request'

type ML = { zh: string; th?: string; en?: string }
function pickML(v: ML | string | undefined, lang: string): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  return (v as any)[lang] || v.zh || v.en || v.th || ''
}

interface ActivitySummary {
  id: string
  name: ML
  subtitle: ML
  type: string
  cover: string
  goal: string
  start_time?: string
  end_time?: string
}

interface NearbyStation {
  id: string
  name: ML
  address?: string
  distance_km: number
  available: number
  capacity: number
  status: string
  venue_name?: string
  activity: ActivitySummary | null
}

const GOAL_COLOR: Record<string, string> = {
  '拉新': 'blue', '促关注': 'cyan', '转会员': 'purple',
  '复购': 'orange', '召回': 'volcano',
}

export default function NearbyPage() {
  const navigate = useNavigate()
  const { language } = useI18n()

  const [state, setState] = useState<'idle' | 'locating' | 'loading' | 'done' | 'error'>('idle')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [stations, setStations] = useState<NearbyStation[]>([])
  const [errMsg, setErrMsg] = useState('')

  const txt = useMemo(() => {
    const m = {
      zh: {
        title: '附近站点',
        sub: '3km 范围内的站点及可参与活动',
        locateBtn: '获取当前位置',
        retrying: '重新定位',
        locating: '定位中...',
        loading: '加载附近站点...',
        noStations: '周围 3km 内暂无活动站点',
        noLocation: '点击上方按钮获取位置，显示附近福利',
        available: (a: number, c: number) => `可借 ${a}/${c} 个`,
        hasActivity: '可参与活动',
        noActivity: '暂无绑定活动',
        join: '立即参与',
        km: 'km',
        active: '运营中',
        maintenance: '维护中',
        geoFail: '定位失败，请检查浏览器权限',
        backHome: '返回首页',
      },
      th: {
        title: 'สถานีใกล้คุณ',
        sub: 'กิจกรรมและสถานีภายใน 3 กม.',
        locateBtn: 'รับตำแหน่งปัจจุบัน',
        retrying: 'ระบุตำแหน่งใหม่',
        locating: 'กำลังระบุตำแหน่ง...',
        loading: 'กำลังโหลดสถานีใกล้คุณ...',
        noStations: 'ไม่มีสถานีกิจกรรมภายใน 3 กม.',
        noLocation: 'กดปุ่มด้านบนเพื่อระบุตำแหน่งและดูสิทธิพิเศษใกล้คุณ',
        available: (a: number, c: number) => `ยืมได้ ${a}/${c}`,
        hasActivity: 'กิจกรรมที่เข้าร่วมได้',
        noActivity: 'ยังไม่มีกิจกรรม',
        join: 'เข้าร่วมเลย',
        km: 'กม.',
        active: 'เปิดให้บริการ',
        maintenance: 'ซ่อมบำรุง',
        geoFail: 'ระบุตำแหน่งไม่สำเร็จ กรุณาอนุญาตการเข้าถึงตำแหน่ง',
        backHome: 'กลับหน้าหลัก',
      },
      en: {
        title: 'Nearby Stations',
        sub: 'Stations & activities within 3km',
        locateBtn: 'Get My Location',
        retrying: 'Locate Again',
        locating: 'Locating...',
        loading: 'Loading nearby stations...',
        noStations: 'No activity stations within 3km',
        noLocation: 'Tap above to find welfare activities near you',
        available: (a: number, c: number) => `${a}/${c} available`,
        hasActivity: 'Activity available',
        noActivity: 'No activities yet',
        join: 'Join Now',
        km: 'km',
        active: 'Active',
        maintenance: 'Maintenance',
        geoFail: 'Location failed. Please allow location access.',
        backHome: 'Back to Home',
      },
    } as const
    return m[language as keyof typeof m] ?? m.zh
  }, [language])

  const fetchNearby = (lat: number, lng: number) => {
    setState('loading')
    request
      .get('/stations/nearby', { params: { lat: String(lat), lng: String(lng), radius: '3' } })
      .then((res: any) => {
        setStations((res?.data?.list || []) as NearbyStation[])
        setState('done')
      })
      .catch(() => { setState('error'); setErrMsg(txt.geoFail) })
  }

  const requestLocation = () => {
    if (!navigator.geolocation) { setErrMsg(txt.geoFail); setState('error'); return }
    setState('locating')
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        setCoords({ lat: c.latitude, lng: c.longitude })
        fetchNearby(c.latitude, c.longitude)
      },
      () => { setState('error'); setErrMsg(txt.geoFail) },
      { timeout: 10000 }
    )
  }

  useEffect(() => { requestLocation() }, [])

  const isLoading = state === 'locating' || state === 'loading'

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      {/* ── 顶部渐变头 ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #2CDBCE 0%, #2F80FF 100%)',
        padding: '20px 16px 28px',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <EnvironmentOutlined style={{ fontSize: 22 }} />
          <span style={{ fontSize: 22, fontWeight: 800 }}>{txt.title}</span>
        </div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>{txt.sub}</div>

        {/* 定位按钮 */}
        <button
          onClick={requestLocation}
          disabled={isLoading}
          style={{
            marginTop: 14, display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: 50, color: '#fff', padding: '8px 18px', cursor: isLoading ? 'default' : 'pointer',
            fontSize: 13, fontWeight: 600, backdropFilter: 'blur(4px)',
          }}
        >
          {isLoading
            ? <><Spin size="small" style={{ filter: 'brightness(10)' }} /> {state === 'locating' ? txt.locating : txt.loading}</>
            : <><ReloadOutlined /> {coords ? txt.retrying : txt.locateBtn}</>
          }
        </button>

        {coords && (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            📍 {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </div>
        )}
      </div>

      {/* ── 主内容区 ───────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 12px 100px', maxWidth: 540, margin: '0 auto' }}>

        {/* 错误状态 */}
        {state === 'error' && (
          <div style={{ textAlign: 'center', padding: 32, color: '#999', fontSize: 14 }}>
            <EnvironmentOutlined style={{ fontSize: 36, marginBottom: 12, display: 'block', color: '#bbb' }} />
            {errMsg}
          </div>
        )}

        {/* 未定位 */}
        {state === 'idle' && (
          <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 14 }}>
            <EnvironmentOutlined style={{ fontSize: 48, marginBottom: 14, display: 'block' }} />
            {txt.noLocation}
          </div>
        )}

        {/* 加载中 */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        )}

        {/* 站点列表 */}
        {state === 'done' && stations.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 14 }}>
            <GiftOutlined style={{ fontSize: 48, marginBottom: 14, display: 'block' }} />
            {txt.noStations}
          </div>
        )}

        {state === 'done' && stations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stations.map(st => (
              <StationCard
                key={st.id}
                station={st}
                lang={language}
                txt={txt}
                onActivityClick={(actId) => navigate(`/activity/${actId}`)}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 540, margin: '0 auto' }}>
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

/* ── 站点卡片组件 ──────────────────────────────────────────────────────────── */
function StationCard({
  station, lang, txt, onActivityClick,
}: {
  station: NearbyStation
  lang: string
  txt: any
  onActivityClick: (id: string) => void
}) {
  const act = station.activity
  const stationName = pickML(station.name, lang)
  const address = station.address || station.venue_name || ''

  return (
    <div style={{
      background: '#fff',
      borderRadius: 18,
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    }}>
      {/* 站点基础信息 */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg, #2CDBCE, #2F80FF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ThunderboltOutlined style={{ color: '#fff', fontSize: 20 }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3, color: '#1a1a1a' }}>
            {stationName || station.id}
          </div>
          {address && (
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <EnvironmentOutlined style={{ fontSize: 11 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{address}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#555' }}>
              ⚡ {txt.available(station.available, station.capacity)}
            </span>
            <Tag
              color={station.status === 'active' ? 'green' : 'orange'}
              style={{ fontSize: 11, margin: 0, padding: '0 6px' }}
            >
              {station.status === 'active' ? txt.active : txt.maintenance}
            </Tag>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            background: 'linear-gradient(135deg, #2CDBCE, #2F80FF)',
            borderRadius: 50, padding: '4px 10px',
            fontSize: 12, fontWeight: 700, color: '#fff',
          }}>
            {station.distance_km.toFixed(1)} {txt.km}
          </div>
        </div>
      </div>

      {/* 活动区域 */}
      {act ? (
        <button
          onClick={() => onActivityClick(act.id)}
          style={{
            width: '100%', display: 'flex', alignItems: 'stretch',
            background: 'linear-gradient(90deg, #f0f9ff, #f6fff8)',
            border: 'none', borderTop: '1px solid #f0f0f0',
            cursor: 'pointer', padding: 0, textAlign: 'left',
          }}
        >
          {/* 活动封面缩略图 */}
          {act.cover ? (
            <div style={{ width: 72, flexShrink: 0, overflow: 'hidden' }}>
              <OssImage
                src={act.cover}
                alt={pickML(act.name, lang)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          ) : (
            <div style={{
              width: 72, flexShrink: 0,
              background: 'linear-gradient(135deg, #52c41a20, #1677ff20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GiftOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            </div>
          )}

          <div style={{ flex: 1, padding: '10px 12px', minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#52c41a', fontWeight: 700, marginBottom: 3 }}>
              🎁 {txt.hasActivity}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pickML(act.name, lang)}
            </div>
            {act.goal && (
              <Tag color={GOAL_COLOR[act.goal] || 'default'} style={{ fontSize: 10, margin: 0, padding: '0 5px' }}>
                {act.goal}
              </Tag>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', paddingRight: 12, color: '#1677ff' }}>
            <RightOutlined />
          </div>
        </button>
      ) : (
        <div style={{
          borderTop: '1px solid #f0f0f0', padding: '8px 16px',
          fontSize: 12, color: '#bbb', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <GiftOutlined />
          {txt.noActivity}
        </div>
      )}
    </div>
  )
}
