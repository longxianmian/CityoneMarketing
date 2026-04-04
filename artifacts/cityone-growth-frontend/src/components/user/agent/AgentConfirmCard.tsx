import React from 'react'
import { AgentMessage } from '../../../store/agent'

interface Props {
  message: AgentMessage
  onConfirm: (actionCode: string, confirm: boolean) => void
  lang: 'zh' | 'th' | 'en'
}

const CONFIRM_TEXT = { zh: '确认执行', th: 'ยืนยัน', en: 'Confirm' }
const CANCEL_TEXT = { zh: '取消', th: 'ยกเลิก', en: 'Cancel' }

export default function AgentConfirmCard({ message, onConfirm, lang }: Props) {
  const action = message.confirmAction
  if (!action) return null

  return (
    <div style={{ marginLeft: 46, marginBottom: 16 }}>
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '16px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #FFA94022',
        }}
      >
        <div style={{ fontSize: 14, color: '#111827', lineHeight: 1.6, marginBottom: 12 }}>
          ⚡ {action.actionText}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onConfirm(action.actionCode, true)}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
              background: 'linear-gradient(90deg, #2CDBCE, #2F80FF)',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {action.confirmText || CONFIRM_TEXT[lang]}
          </button>
          <button
            onClick={() => onConfirm(action.actionCode, false)}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 10,
              border: '1.5px solid #E0E7F0', background: '#fff',
              color: '#6B7280', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {CANCEL_TEXT[lang]}
          </button>
        </div>
      </div>
    </div>
  )
}
