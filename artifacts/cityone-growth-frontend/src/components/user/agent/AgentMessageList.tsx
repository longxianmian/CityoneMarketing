import React from 'react'
import { AgentMessage } from '../../../store/agent'
import AgentTextBubble from './AgentTextBubble'
import AgentToolCard from './AgentToolCard'
import AgentSuggestionBar from './AgentSuggestionBar'
import AgentConfirmCard from './AgentConfirmCard'

interface Props {
  messages: AgentMessage[]
  isThinking: boolean
  userAvatar?: string
  lang: 'zh' | 'th' | 'en'
  onSuggestionClick: (s: string) => void
  onConfirm: (actionCode: string, confirm: boolean) => void
  onFollowOA?: () => void
}

const FOLLOW_TEXT = { zh: '立即关注 LINE OA', th: 'ติดตาม LINE OA', en: 'Follow LINE OA' }
const UPGRADE_TEXT = { zh: '了解会员权益', th: 'ดูสิทธิ์สมาชิก', en: 'View Member Benefits' }

export default function AgentMessageList({
  messages, isThinking, userAvatar, lang,
  onSuggestionClick, onConfirm, onFollowOA,
}: Props) {
  return (
    <>
      {messages.map((msg) => {
        switch (msg.type) {
          case 'text':
          case 'file_echo':
          case 'system_notice':
            return <AgentTextBubble key={msg.id} message={msg} userAvatar={userAvatar} />

          case 'tool_card':
            return (
              <React.Fragment key={msg.id}>
                {msg.text && <AgentTextBubble message={{ ...msg, type: 'text' }} userAvatar={userAvatar} />}
                <AgentToolCard message={msg} />
              </React.Fragment>
            )

          case 'suggestions':
            return (
              <React.Fragment key={msg.id}>
                {msg.text && <AgentTextBubble message={{ ...msg, type: 'text' }} userAvatar={userAvatar} />}
                {msg.suggestions && (
                  <AgentSuggestionBar suggestions={msg.suggestions} onSelect={onSuggestionClick} />
                )}
              </React.Fragment>
            )

          case 'confirm_card':
            return (
              <React.Fragment key={msg.id}>
                {msg.text && <AgentTextBubble message={{ ...msg, type: 'text' }} userAvatar={userAvatar} />}
                <AgentConfirmCard message={msg} onConfirm={onConfirm} lang={lang} />
              </React.Fragment>
            )

          case 'follow_required':
            return (
              <React.Fragment key={msg.id}>
                {msg.text && <AgentTextBubble message={{ ...msg, type: 'text' }} userAvatar={userAvatar} />}
                <div style={{ marginLeft: 46, marginBottom: 16 }}>
                  <button
                    onClick={onFollowOA}
                    style={{
                      padding: '10px 20px', borderRadius: 10, border: 'none',
                      background: 'linear-gradient(90deg, #06C755, #04a848)',
                      color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {FOLLOW_TEXT[lang]}
                  </button>
                </div>
              </React.Fragment>
            )

          case 'upgrade_required':
            return (
              <React.Fragment key={msg.id}>
                {msg.text && <AgentTextBubble message={{ ...msg, type: 'text' }} userAvatar={userAvatar} />}
                <div style={{ marginLeft: 46, marginBottom: 16 }}>
                  <button
                    onClick={() => {}}
                    style={{
                      padding: '10px 20px', borderRadius: 10, border: 'none',
                      background: 'linear-gradient(90deg, #7B61FF, #2F80FF)',
                      color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {UPGRADE_TEXT[lang]}
                  </button>
                </div>
              </React.Fragment>
            )

          default:
            return null
        }
      })}

      {isThinking && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 999, flexShrink: 0, overflow: 'hidden' }}>
            <img src="/ai-avatar.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ background: '#fff', borderRadius: '4px 16px 16px 16px', padding: '12px 18px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', display: 'flex', gap: 5, alignItems: 'center' }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 7, height: 7, borderRadius: 999, background: '#2CDBCE', display: 'inline-block', animation: `agentBounce 1.2s ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
