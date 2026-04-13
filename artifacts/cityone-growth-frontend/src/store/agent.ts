import { create } from 'zustand'

export type AgentMessageType =
  | 'text'
  | 'tool_card'
  | 'suggestions'
  | 'confirm_card'
  | 'follow_required'
  | 'upgrade_required'
  | 'file_echo'
  | 'system_notice'

export interface AgentCard {
  type: 'site' | 'coupon' | 'benefit' | 'order' | 'invite' | 'activity'
  title: string
  subtitle?: string
  badge?: string
  meta?: string
  coverImage?: string
  ctaPrimary?: { text: string; route?: string; action?: string }
  ctaSecondary?: { text: string; route?: string; action?: string }
}

export interface AgentMessage {
  id: string
  role: 'ai' | 'user' | 'system'
  type: AgentMessageType
  text?: string
  cards?: AgentCard[]
  suggestions?: string[]
  confirmAction?: {
    actionCode: string
    actionText: string
    confirmText: string
  }
  image?: string
  createdAt: string
}

interface AgentState {
  sessionId: string | null
  identityTier: string | null
  capabilities: string[]
  messages: AgentMessage[]
  quickPrompts: string[]
  isThinking: boolean
  pendingConfirmAction: AgentMessage['confirmAction'] | null
  setSessionId: (id: string | null) => void
  setIdentityTier: (tier: string | null) => void
  setCapabilities: (caps: string[]) => void
  addMessage: (msg: AgentMessage) => void
  addMessages: (msgs: AgentMessage[]) => void
  removeMessage: (id: string) => void
  setMessages: (msgs: AgentMessage[]) => void
  setQuickPrompts: (prompts: string[]) => void
  setThinking: (v: boolean) => void
  setPendingConfirmAction: (action: AgentMessage['confirmAction'] | null) => void
  reset: () => void
}

const useAgentStore = create<AgentState>((set) => ({
  sessionId: null,
  identityTier: null,
  capabilities: [],
  messages: [],
  quickPrompts: [],
  isThinking: false,
  pendingConfirmAction: null,
  setSessionId: (id) => set({ sessionId: id }),
  setIdentityTier: (tier) => set({ identityTier: tier }),
  setCapabilities: (caps) => set({ capabilities: caps }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  addMessages: (msgs) => set((s) => ({ messages: [...s.messages, ...msgs] })),
  removeMessage: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
  setMessages: (msgs) => set({ messages: msgs }),
  setQuickPrompts: (prompts) => set({ quickPrompts: prompts }),
  setThinking: (v) => set({ isThinking: v }),
  setPendingConfirmAction: (action) => set({ pendingConfirmAction: action }),
  reset: () =>
    set({
      sessionId: null,
      identityTier: null,
      capabilities: [],
      messages: [],
      quickPrompts: [],
      isThinking: false,
      pendingConfirmAction: null,
    }),
}))

export default useAgentStore
