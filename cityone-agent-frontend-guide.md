# CityOne AI Agent 前端改造文档

## 一、本次改造目标

解决用户从 Agent 聊天页跳转到福利中心、兑换页等其他页面后，**返回时历史消息被清空**的问题。

后端已完成改造，前端需要配合做以下几件事：

1. 进入聊天页时调用 `session/init`，优先恢复上一次会话，不再每次新建
2. 用 `restored` 字段判断是否为恢复场景，决定是否展示"历史恢复"提示
3. 从 init 响应直接渲染历史消息，而不依赖本地 state
4. 移除前端本地 `sessionId` 的强绑定，允许从后端恢复 sessionId
5. 支持 `GET /api/agent/session/latest` 作为兜底恢复入口

---

## 二、后端接口变更说明

### 1. `POST /api/agent/session/init`（核心改动）

**原行为**：每次调用都创建新会话，返回空消息列表。

**新行为**：同一用户（同一 `line_user_id`）7 天内有活跃会话，则**直接恢复**，返回历史消息。

#### 请求（无变化）

```json
{
  "line_user_id": "Ufakexxxx",
  "site_id": "site_001",
  "entry_type": "device_qr",
  "language": "zh"
}
```

#### 响应（新增字段）

```json
{
  "code": 200,
  "data": {
    "session_id": "as_00081",
    "restored": true,
    "messages": [
      {
        "message_id": "am_00001",
        "session_id": "as_00081",
        "role": "agent",
        "type": "welcome",
        "text": "你好，我是 CityOne AI 助理。",
        "payload": {
          "reply_type": "welcome",
          "text": "你好，我是 CityOne AI 助理。",
          "cards": [],
          "suggestions": ["帮我找附近站点", "有哪些券能用？", "积分怎么兑换？"]
        },
        "intent_code": "session_init",
        "created_at": "2026-04-04T10:00:00.000Z"
      }
    ],
    "identity_tier": "oa_fan",
    "capabilities": ["nearby_sites_query", "coupon_list_query"],
    "quick_prompts": ["帮我找附近站点", "有哪些券能用？"],
    "welcome_message": "你好，我是 CityOne AI 助理。"
  }
}
```

| 新增字段 | 说明 |
|---|---|
| `restored` | `true` = 恢复旧会话，`false` = 全新会话 |
| `messages` | 最近 50 条历史消息，前端直接用于渲染，无需再单独请求 |
| 消息结构 `.type` | 消息类型：`welcome` / `text` / `tool_result` / `tool_card` 等 |
| 消息结构 `.payload` | 前端渲染卡片用的结构化数据（含 `cards` / `suggestions`） |

---

### 2. `GET /api/agent/session/:sessionId/messages`（消息结构升级）

消息结构新增 `type` 和 `payload` 字段：

```json
{
  "message_id": "am_00010",
  "session_id": "as_00081",
  "role": "agent",
  "type": "tool_result",
  "text": "我帮你找到了最划算的券。",
  "payload": {
    "reply_type": "tool_result",
    "text": "我帮你找到了最划算的券。",
    "cards": [
      {
        "card_type": "coupon",
        "title": "首借 1 小时免费券",
        "desc": "当前站点可用，优先级最高",
        "action_text": "立即使用",
        "action_type": "open_coupon"
      }
    ],
    "suggestions": ["帮我找附近站点", "还有什么福利？"]
  },
  "intent_code": "coupon_recommend",
  "created_at": "2026-04-04T10:01:00.000Z"
}
```

---

### 3. `GET /api/agent/session/latest`（新增接口）

**用途**：前端本地没有 `sessionId`（如清除缓存后）仍可恢复会话。

```
GET /api/agent/session/latest?line_user_id=Ufakexxxx
```

```json
{
  "code": 200,
  "data": {
    "session": { "session_id": "as_00081", ... },
    "messages": [ ... ]
  }
}
```

若没有活跃会话，`session` 为 `null`，`messages` 为空数组。

---

## 三、前端需要修改的文件

### 主要改动集中在聊天页入口逻辑，预计改动范围较小。

---

## 四、`AgentChatPage.tsx` 改造步骤

### Step 1：修改 `initSession` 函数

**改造前（错误做法）**：

```ts
// 每次进入页面都创建新会话，清空消息
const initSession = async () => {
  const res = await postAgentSessionInit({ line_user_id: lineUserId });
  setSessionId(res.data.session_id);
  setMessages([]);  // ❌ 每次清空
};
```

**改造后（正确做法）**：

```ts
const initSession = async () => {
  const res = await postAgentSessionInit({
    line_user_id: lineUserId,
    site_id: siteId,
    language: 'zh',
  });
  const { session_id, restored, messages } = res.data;

  setSessionId(session_id);

  if (restored && messages.length > 0) {
    // 恢复历史消息，直接渲染，不加欢迎语
    setMessages(messages.map(normalizeMessage));
  } else {
    // 新会话，后端 init 已写入欢迎消息，messages[0] 就是欢迎消息
    setMessages(messages.map(normalizeMessage));
  }
};
```

---

### Step 2：实现 `normalizeMessage` 消息格式化函数

后端消息结构与前端渲染结构需要适配，新增一个转换函数：

```ts
function normalizeMessage(backendMsg: AgentMessage): ChatMessage {
  return {
    id: backendMsg.message_id,
    role: backendMsg.role,           // "user" | "agent"
    type: backendMsg.type,           // "welcome" | "text" | "tool_result" | "tool_card"
    text: backendMsg.text,
    cards: backendMsg.payload?.cards || [],
    suggestions: backendMsg.payload?.suggestions || [],
    payload: backendMsg.payload,     // 保留完整 payload 供高级渲染使用
    createdAt: backendMsg.created_at,
  };
}
```

---

### Step 3：移除本地 `sessionId` 的强绑定

**改造前**：

```ts
// 使用 localStorage 存 sessionId，刷新后继续用旧 sessionId
const [sessionId, setSessionId] = useState(
  localStorage.getItem('agentSessionId') || ''
);
```

**改造后**：

```ts
// 不再依赖本地 sessionId，每次进入页面从后端恢复
const [sessionId, setSessionId] = useState('');

useEffect(() => {
  initSession();  // 每次进入页面都走 init，由后端决定恢复还是新建
}, []);
```

---

### Step 4：支持 "恢复提示" UI（可选，推荐）

```tsx
{restored && messages.length > 1 && (
  <div className="session-restore-tip">
    ↩ 已恢复上次对话
  </div>
)}
```

---

### Step 5：消息渲染支持 `type` 和 `payload`

根据 `type` 判断渲染方式：

```tsx
function ChatBubble({ message }: { message: ChatMessage }) {
  // 渲染 AI 消息
  if (message.role === 'agent') {
    return (
      <div className="bubble agent">
        {/* 文本 */}
        <p>{message.text}</p>

        {/* 卡片列表 */}
        {message.cards?.map((card, i) => (
          <ActionCard key={i} card={card} />
        ))}

        {/* 快捷建议按钮 */}
        {message.suggestions?.length > 0 && (
          <SuggestionChips suggestions={message.suggestions} />
        )}
      </div>
    );
  }
  // 用户消息
  return <div className="bubble user"><p>{message.text}</p></div>;
}
```

---

### Step 6：兜底恢复（清除缓存场景）

如果进入页面时本地无 `sessionId`，且 `init` 因某些原因失败，可以用 `/latest` 接口兜底：

```ts
const recoverSession = async (lineUserId: string) => {
  try {
    const res = await getAgentSessionLatest(lineUserId);
    if (res.data.session) {
      setSessionId(res.data.session.session_id);
      setMessages(res.data.messages.map(normalizeMessage));
      return true;
    }
  } catch {}
  return false;
};
```

---

## 五、API 函数封装建议

```ts
// api/agent.ts

/** 初始化或恢复会话 */
export const postAgentSessionInit = (params: {
  line_user_id: string;
  site_id?: string;
  entry_type?: string;
  entry_code?: string;
  language?: string;
}) => api.post('/api/agent/session/init', params);

/** 获取会话历史消息 */
export const getAgentSessionMessages = (sessionId: string, limit = 50) =>
  api.get(`/api/agent/session/${sessionId}/messages?limit=${limit}`);

/** 发送消息 */
export const postAgentMessage = (sessionId: string, text: string, language = 'zh') =>
  api.post(`/api/agent/session/${sessionId}/message`, { text, language });

/** 通过 line_user_id 恢复最近会话（兜底） */
export const getAgentSessionLatest = (lineUserId: string) =>
  api.get(`/api/agent/session/latest?line_user_id=${lineUserId}`);
```

---

## 六、消息类型 TypeScript 接口

```ts
// types/agent.ts

export interface AgentBackendMessage {
  message_id: string;
  session_id: string;
  role: 'user' | 'agent';
  type: 'welcome' | 'text' | 'tool_result' | 'tool_card' | 'confirm_request';
  text: string;
  payload: {
    reply_type: string;
    text: string;
    cards?: AgentCard[];
    suggestions?: string[];
    action?: string;
  } | null;
  intent_code: string;
  created_at: string;
}

export interface AgentCard {
  card_type: 'coupon' | 'link' | 'site' | 'poster' | 'info';
  title: string;
  desc?: string;
  action_text?: string;
  action_type?: string;
  action_url?: string;
  data?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  type: string;
  text: string;
  cards: AgentCard[];
  suggestions: string[];
  payload: AgentBackendMessage['payload'];
  createdAt: string;
}
```

---

## 七、改造前后对比

| 场景 | 改造前 | 改造后 |
|---|---|---|
| 首次进入聊天页 | 创建新会话，空消息 | 创建新会话，返回欢迎消息 |
| 跳出后返回聊天页 | 重新 init，**清空消息** | 恢复原会话，**显示历史消息** |
| 本地无 sessionId | 只能新建 | `/latest` 兜底恢复 |
| 消息渲染 | 仅支持文本 | 支持文本 + 卡片 + 按钮 |
| 用户继续发消息 | 可能发到错误会话 | 与历史消息在同一会话 |

---

## 八、注意事项

1. **不要在 `useEffect` 里检查 sessionId 是否存在再决定是否 init**。直接每次进入都调用 `session/init`，由后端决定恢复还是新建，不要在前端做这个判断。

2. **不要在消息列表里过滤掉 `type=welcome` 的消息**。恢复会话后欢迎消息也应该展示，用户体验更连贯。

3. **快捷建议按钮点击后，直接将按钮文本作为用户消息发送**，不需要特殊处理：
   ```ts
   onSuggestionClick={(text) => sendMessage(text)}
   ```

4. **卡片按钮跳转时，不要清空 `sessionId`**，跳转前保留当前 sessionId，返回时 init 会恢复同一会话。

---

## 九、验收标准

1. 用户首次进入 Agent，创建新会话，看到欢迎消息
2. 用户发送 3 条消息，AI 各自回复，消息显示正常
3. 用户点击"积分兑换中心"卡片跳转到福利页
4. 用户返回 Agent 聊天页，看到 `restored: true`，历史 6 条消息全部显示
5. 用户继续发送"刚才那个怎么兑换"，AI 在同一会话中继续回复
6. 清除本地缓存后再次进入，通过 `/latest` 接口仍能恢复最近会话

---

## 十、后端接口地址汇总

| 接口 | 方法 | 路径 |
|---|---|---|
| 初始化/恢复会话 | POST | `/api/agent/session/init` |
| 获取历史消息 | GET | `/api/agent/session/:id/messages` |
| 发送消息 | POST | `/api/agent/session/:id/message` |
| 恢复最近会话（兜底） | GET | `/api/agent/session/latest?line_user_id=xxx` |
| 确认动作 | POST | `/api/agent/session/:id/confirm` |
| 获取可用能力 | GET | `/api/agent/capabilities?line_user_id=xxx` |
| 获取快捷问题 | GET | `/api/agent/quick-prompts?language=zh` |
