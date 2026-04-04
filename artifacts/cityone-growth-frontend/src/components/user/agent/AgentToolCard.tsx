import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AgentCard, AgentMessage } from '../../../store/agent'

const CARD_ICONS: Record<string, string> = {
  site: '📍',
  coupon: '🎟️',
  benefit: '🎁',
  order: '📦',
  invite: '🤝',
}

const CARD_COLORS: Record<string, string> = {
  site: '#2CDBCE',
  coupon: '#FF7A59',
  benefit: '#7B61FF',
  order: '#2F80FF',
  invite: '#52c41a',
}

interface CardItemProps {
  card: AgentCard
  onAction?: (action?: string, route?: string) => void
}

function CardItem({ card, onAction }: CardItemProps) {
  const icon = CARD_ICONS[card.type] || '✦'
  const color = CARD_COLORS[card.type] || '#1677ff'

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: '14px 14px 12px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        border: `1px solid ${color}22`,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>{card.title}</div>
          {card.badge && (
            <span style={{ fontSize: 10, fontWeight: 700, color: color, background: color + '18', borderRadius: 999, padding: '2px 8px' }}>
              {card.badge}
            </span>
          )}
        </div>
      </div>
      {card.subtitle && (
        <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, marginBottom: 8 }}>{card.subtitle}</div>
      )}
      {card.meta && (
        <div style={{ fontSize: 12, color: '#A0A7B3', marginBottom: 10 }}>{card.meta}</div>
      )}
      {(card.ctaPrimary || card.ctaSecondary) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {card.ctaPrimary && (
            <button
              onClick={() => onAction?.(card.ctaPrimary?.action, card.ctaPrimary?.route)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
                background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {card.ctaPrimary.text}
            </button>
          )}
          {card.ctaSecondary && (
            <button
              onClick={() => onAction?.(card.ctaSecondary?.action, card.ctaSecondary?.route)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 10,
                border: `1.5px solid ${color}`, background: '#fff',
                color: color, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {card.ctaSecondary.text}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  message: AgentMessage
}

export default function AgentToolCard({ message }: Props) {
  const nav = useNavigate()

  const handleAction = (action?: string, route?: string) => {
    if (route) nav(route)
    else if (action) console.log('[AgentToolCard] action:', action)
  }

  if (!message.cards?.length) return null

  return (
    <div style={{ marginLeft: 46, marginBottom: 16 }}>
      {message.cards.map((card, i) => (
        <CardItem key={i} card={card} onAction={handleAction} />
      ))}
    </div>
  )
}
