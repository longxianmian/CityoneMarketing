import React from 'react'
import { LeftOutlined } from '@ant-design/icons'

interface UserPageHeaderProps {
  title: string
  onBack?: () => void
  right?: React.ReactNode
  transparent?: boolean
}

export default function UserPageHeader({ title, onBack, right, transparent }: UserPageHeaderProps) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 4px',
        height: 52,
        background: transparent ? 'transparent' : 'rgba(247,249,252,0.95)',
        backdropFilter: transparent ? 'none' : 'blur(12px)',
        borderBottom: transparent ? 'none' : '1px solid rgba(17,24,39,0.05)',
      }}
    >
      <button
        onClick={onBack}
        style={{
          width: 44,
          height: 44,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12,
          color: '#374151',
          flexShrink: 0,
        }}
      >
        <LeftOutlined style={{ fontSize: 18 }} />
      </button>

      <div
        style={{
          flex: 1,
          textAlign: 'center',
          fontWeight: 800,
          fontSize: 17,
          color: '#111827',
          letterSpacing: 0.2,
        }}
      >
        {title}
      </div>

      <div style={{ width: 44, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
        {right ?? null}
      </div>
    </div>
  )
}
