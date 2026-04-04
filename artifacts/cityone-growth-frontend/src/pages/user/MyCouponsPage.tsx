import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Tag } from 'antd'

const mockCoupons = [
  {
    id: '1',
    title: '关注 LINE 领 15 分钟券',
    valueText: '15分钟免费时长',
    expireText: '2026-04-07 到期',
    applyText: '适用于首次借电或活动指定场景',
    status: 'available',
  },
  {
    id: '2',
    title: '首借免单券',
    valueText: '首单免单',
    expireText: '2026-04-03 到期',
    applyText: '到站借电时自动核销',
    status: 'available',
  },
  {
    id: '3',
    title: 'Battery SOS 救援券',
    valueText: '10 THB 抵扣',
    expireText: '2026-03-28 已过期',
    applyText: '适用于 SOS 指定场景',
    status: 'expired',
  },
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

export default function MyCouponsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'available' | 'used' | 'expired'>('available')

  const list = useMemo(() => {
    if (tab === 'used') return []
    return mockCoupons.filter((item) => item.status === tab)
  }, [tab])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: 999,
    border: 'none',
    background: active ? '#1677ff' : '#eef2f6',
    color: active ? '#fff' : '#666',
    fontWeight: 700,
    cursor: 'pointer',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '20px 16px 90px' }}>
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>我的卡券</div>

        <Card style={{ borderRadius: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={tabStyle(tab === 'available')} onClick={() => setTab('available')}>
              可使用
            </button>
            <button style={tabStyle(tab === 'used')} onClick={() => setTab('used')}>
              已使用
            </button>
            <button style={tabStyle(tab === 'expired')} onClick={() => setTab('expired')}>
              已过期
            </button>
          </div>
        </Card>

        {list.length === 0 ? (
          <Card style={{ borderRadius: 16 }}>
            <div style={{ textAlign: 'center', color: '#666', padding: '24px 0' }}>
              当前暂无对应状态的卡券
            </div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {list.map((item) => (
              <Card key={item.id} style={{ borderRadius: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 8 }}>
                      <Tag color={tab === 'expired' ? 'default' : 'blue'}>
                        {tab === 'expired' ? '已过期' : '可使用'}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{item.title}</div>
                    <div style={{ fontSize: 16, color: '#fa8c16', fontWeight: 700, marginBottom: 8 }}>
                      {item.valueText}
                    </div>
                    <div style={{ color: '#666', marginBottom: 6 }}>{item.expireText}</div>
                    <div style={{ color: '#666', lineHeight: 1.7 }}>{item.applyText}</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
                    <Button onClick={() => navigate(`/coupon/${item.id}?followed=1`)}>
                      查看详情
                    </Button>
                    {tab !== 'expired' ? (
                      <Button type="primary" onClick={() => navigate(`/coupon/${item.id}?followed=1`)}>
                        去使用
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        <BottomNav
          current="coupons"
          onGoWelfare={() => navigate('/welfare')}
          onGoCoupons={() => navigate('/my-coupons')}
          onGoPoints={() => navigate('/my-points')}
        />
      </div>
    </div>
  )
}
