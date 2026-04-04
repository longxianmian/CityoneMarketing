import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Tag } from 'antd'

const basePointRecords = [
  { id: '1', type: 'earn', title: '参与活动奖励', points: 100, createdAt: '2026-03-31 10:00' },
  { id: '2', type: 'earn', title: '邀请好友奖励', points: 50, createdAt: '2026-03-30 18:20' },
  { id: '3', type: 'spend', title: '兑换 15 分钟券', points: -200, createdAt: '2026-03-29 14:15' },
]

function BottomNav({
  current,
  onGoWelfare,
  onGoCoupons,
  onGoPoints,
}: {
  current: 'welfare' | 'coupons' | 'points'
  onGoWelfare: () => void
  onGoCoupons: () => void
  onGoPoints: () => void
}) {
  const getItemStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    border: 'none',
    background: 'transparent',
    padding: '10px 0',
    fontSize: 14,
    fontWeight: active ? 700 : 500,
    color: active ? '#1677ff' : '#666',
    cursor: 'pointer',
  })

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        background: '#fff',
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        paddingBottom: 8,
      }}
    >
      <button style={getItemStyle(current === 'welfare')} onClick={onGoWelfare}>
        福利中心
      </button>
      <button style={getItemStyle(current === 'coupons')} onClick={onGoCoupons}>
        我的卡券
      </button>
      <button style={getItemStyle(current === 'points')} onClick={onGoPoints}>
        我的积分
      </button>
    </div>
  )
}

export default function MyPointsPage() {
  const navigate = useNavigate()

  const pointRecords = useMemo(() => {
    try {
      const localRecords = JSON.parse(localStorage.getItem('cityone_local_point_records') || '[]')
      return [...localRecords, ...basePointRecords]
    } catch {
      return basePointRecords
    }
  }, [])

  const currentPoints = useMemo(() => {
    return pointRecords.reduce((sum, item) => sum + Number(item.points || 0), 1280)
  }, [pointRecords])

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '20px 16px 90px' }}>
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>我的积分</div>

        <div
          style={{
            borderRadius: 20,
            background: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
            color: '#fff',
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.92, marginBottom: 8 }}>当前可用积分</div>
          <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 12 }}>{currentPoints}</div>
          <Button onClick={() => navigate('/redeem/1?followed=1')}>去积分兑换</Button>
        </div>

        <Card style={{ borderRadius: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>积分说明</div>
          <div style={{ color: '#666', lineHeight: 1.8 }}>
            活动参与、分享拉新、任务完成都可获得积分；积分可在数字商品积分兑换中直接兑换并即时发放。
          </div>
        </Card>

        <Card style={{ borderRadius: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>积分明细</div>

          <div style={{ display: 'grid', gap: 12 }}>
            {pointRecords.map((item) => (
              <Card key={item.id} size="small" style={{ borderRadius: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <Tag color={item.type === 'earn' ? 'green' : 'orange'}>
                        {item.type === 'earn' ? '获得' : '消耗'}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
                    <div style={{ color: '#666' }}>{item.createdAt}</div>
                  </div>

                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: Number(item.points) > 0 ? '#389e0d' : '#d46b08',
                      alignSelf: 'center',
                    }}
                  >
                    {Number(item.points) > 0 ? `+${item.points}` : item.points}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        <BottomNav
          current="points"
          onGoWelfare={() => navigate('/welfare')}
          onGoCoupons={() => navigate('/my-coupons')}
          onGoPoints={() => navigate('/my-points')}
        />
      </div>
    </div>
  )
}
