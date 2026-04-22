# 外部浏览器进入 LINE 继续链路规范

本规范是外部浏览器进入 LINE 继续完成身份识别与业务动作恢复的唯一约束。修改本模块前，必须先阅读本文件与同目录下的《README-唯一身份与业务身份分层规范.md》。

## 固定规则

- 外部浏览器可浏览内容
- 点击业务动作统一创建 `pending_intent`
- 外部浏览器统一进入 `/welfare/follow-confirm`
- LINE 内统一进入 `/welfare/continue?intent=...`
- 关注确认后自动继续原业务下一步
- 禁止传统“先关注 -> 再找业务页”路径
- 禁止自动 fallback 到 `/welfare` 或 `/mine`

## 浏览与门控

- 内容浏览开放
- 业务执行门控
- 落地页、活动页、卡券页、商品页都允许自由浏览
- 只有点击“立即领取 / 立即参与 / 立即兑换 / 立即使用 / 立即取电”等执行型动作时，才进入统一门控链

## 正确链路

统一链路固定为：

`浏览内容 -> 点击业务动作 -> 创建 pending_intent -> 外部浏览器进入 /welfare/follow-confirm -> 跳入 LINE -> /welfare/continue?intent=... -> identify -> check-follow -> consume -> 自动继续原业务下一步`

## 页面职责

### 详情页 / 落地页

- 只负责展示内容与发起业务动作
- 只负责创建 `pending_intent`
- 禁止页面自己做关注确认
- 禁止页面自己恢复业务动作
- 禁止页面自己决定跳首页或跳个人中心

### /welfare/follow-confirm

- 是引导页，不是报错页
- 只负责提示“请在 LINE 内继续完成身份识别”
- 只负责提供：
  - 在 LINE 中继续
  - 返回当前详情页
  - 重新识别 LINE 身份
- 禁止自动跳 `/welfare`
- 禁止自动跳 `/mine`

### ContinuePage

- 只负责：
  - 读取 intent
  - 识别当前 LINE 身份
  - 检查是否已关注 OA
  - 满足条件后 consume intent
  - 跳转到 `success_path / return_path`
- 禁止默认回首页
- 禁止默认回个人中心
- 禁止把业务动作恢复交给首页或个人中心

### useFollowGate 单一路径约束

`useFollowGate.guard()` 不再保留任何 fast path，也不再允许页面侧绕过 `ContinuePage` 直接执行 `consume`。

所有执行动作统一流程：

- 创建 `pendingIntent`
- LINE 内进入 `/welfare/continue?intent=...`
- 统一完成 `identify -> check-follow -> consume`
- 已关注则继续业务结果页，未关注则先进入 `/welfare/follow-confirm`，完成关注后再回 `/welfare/continue`

## 禁止事项

- 禁止再回到“先关注 -> 再找业务页 -> 再点下一步”的传统长路径
- 禁止自动 fallback 到 `/welfare`
- 禁止自动 fallback 到 `/mine`
- 禁止首页承担业务动作恢复器
- 禁止页面各自恢复原动作

## 一句话总纲

本模块后续所有开发必须服从以下规则：

- 浏览开放
- 动作门控
- 点击后立即创建业务 intent
- 外部浏览器统一进入 `/welfare/follow-confirm`
- LINE 内统一进入 `/welfare/continue?intent=...`
- 关注确认后自动继续原业务下一步
- 不再走传统“先关注 -> 再找业务页 -> 再点下一步”的长路径
