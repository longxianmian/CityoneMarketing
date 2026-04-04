import React from 'react'
import { HomeOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n'

type UserBottomNavProps = {
  current: 'home' | 'agent' | 'mine'
  onHome: () => void
  onAgent: () => void
  onMine: () => void
  activeColor?: string
}

export default function UserBottomNav({
  current,
  onHome,
  onAgent,
  onMine,
  activeColor = '#2CDBCE',
}: UserBottomNavProps) {
  const { t } = useI18n()

  const itemStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    background: 'transparent',
    border: 'none',
    padding: '10px 0 8px',
    color: active ? activeColor : '#7a7a7a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    fontWeight: active ? 700 : 500,
    fontSize: 12,
    cursor: 'pointer',
  })

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        paddingBottom: 8,
        paddingTop: 4,
      }}
    >
      <button style={itemStyle(current === 'home')} onClick={onHome}>
        <HomeOutlined style={{ fontSize: 19 }} />
        {t('common.home')}
      </button>
      <button style={itemStyle(current === 'agent')} onClick={onAgent}>
        <RobotOutlined style={{ fontSize: 19 }} />
        {t('common.agent')}
      </button>
      <button style={itemStyle(current === 'mine')} onClick={onMine}>
        <UserOutlined style={{ fontSize: 19 }} />
        {t('common.mine')}
      </button>
    </div>
  )
}
