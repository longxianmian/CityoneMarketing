import React from 'react'

interface Props {
  suggestions: string[]
  onSelect: (s: string) => void
  inline?: boolean
}

export default function AgentSuggestionBar({ suggestions, onSelect, inline }: Props) {
  if (!suggestions.length) return null

  if (inline) {
    return (
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '6px 16px', scrollbarWidth: 'none', flexShrink: 0 }}>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            style={{
              flexShrink: 0, border: '1px solid #2CDBCE', borderRadius: 999,
              padding: '5px 12px', background: '#fff', cursor: 'pointer',
              fontSize: 12, color: '#2CDBCE', fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            {s}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div style={{ marginLeft: 46, marginBottom: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            style={{
              border: '1px solid #2CDBCE', borderRadius: 10,
              padding: '7px 13px', background: '#fff', cursor: 'pointer',
              fontSize: 13, color: '#2CDBCE', fontWeight: 600,
              boxShadow: '0 2px 6px rgba(44,219,206,0.10)',
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
