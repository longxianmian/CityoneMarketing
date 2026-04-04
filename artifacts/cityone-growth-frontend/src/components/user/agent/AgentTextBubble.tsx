import React from 'react'
import { AgentMessage } from '../../../store/agent'

interface Props {
  message: AgentMessage
  userAvatar?: string
}

export default function AgentTextBubble({ message, userAvatar }: Props) {
  const isAI = message.role === 'ai'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', margin: '8px 0' }}>
        <span style={{ fontSize: 12, color: '#A0A7B3', background: '#F0F4F8', borderRadius: 999, padding: '4px 12px' }}>
          {message.text}
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 16,
        flexDirection: isAI ? 'row' : 'row-reverse',
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 999, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isAI ? 'transparent' : 'rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        {isAI ? (
          <img src="/ai-avatar.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : userAvatar ? (
          <img src={userAvatar} alt="me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 16 }}>👤</span>
        )}
      </div>
      <div style={{ maxWidth: '72%' }}>
        {message.image && (
          <img src={message.image} alt="upload" style={{ maxWidth: '100%', borderRadius: 12, display: 'block', marginBottom: message.text ? 6 : 0 }} />
        )}
        {message.text && (
          <div
            style={{
              background: isAI ? '#fff' : 'linear-gradient(135deg, #2CDBCE, #2F80FF)',
              color: isAI ? '#111827' : '#fff',
              borderRadius: isAI ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
              padding: '10px 14px',
              fontSize: 14,
              lineHeight: 1.65,
              boxShadow: isAI ? '0 2px 10px rgba(0,0,0,0.07)' : 'none',
              whiteSpace: 'pre-line',
            }}
          >
            {message.text}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#A0A7B3', marginTop: 4, textAlign: isAI ? 'left' : 'right' }}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
