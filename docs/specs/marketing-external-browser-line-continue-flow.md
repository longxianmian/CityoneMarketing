# 营销系统外部浏览器进入 LINE 继续链路规范文档

## 文档目标

本文件统一以下场景的产品与技术设计：

- 用户从 Google 浏览器打开落地页
- 用户从 TikTok、Meta、Facebook、Instagram、Messenger 等外部浏览器打开落地页
- 用户先浏览内容，再点击“立即领取 / 立即参与 / 立即兑换 / 立即使用 / 立即取电”
- 系统随后跳转到 LINE 内完成身份识别、关注 OA 确认，并且自动继续原业务动作的下一步

目标不是传统“先关注 -> 再找业务页 -> 再操作”的长路径，而是把优化后的真实路径写死。

## 必须先写死的产品原则

### 浏览开放，动作门控

外部浏览器用户允许：

- 浏览落地页
- 浏览活动详情
- 浏览卡券详情
- 浏览商品详情

但点击以下动作时，必须进入统一门控链：

- 立即领取
- 立即参与
- 立即兑换
- 立即使用
- 立即取电

### 外部浏览器是前置引导层，不是失败页

Google Chrome、Safari、TikTok、Meta、Facebook、Instagram、Messenger 等外部浏览器：

- 可浏览
- 可创建业务 intent
- 但执行关键动作时，需要跳入 LINE 内继续完成身份识别与 OA 确认

### 关注 OA 后必须自动继续原业务

禁止：

- 关注后再回首页
- 关注后再回个人中心
- 关注后让用户重新找原卡券/原活动/原商品
- 关注后再点一次“立即领取”

正确路径必须是：

- 用户先浏览并点击业务动作
- 系统自动补齐身份与关注确认
- 然后自动执行原业务动作的下一步

## 统一场景定义

### A. LINE 内终端

- LINE LIFF 浏览器
- LINE 内可识别当前身份的环境

特点：

- 可直接做身份识别
- 可直接做关注确认
- 可直接推进业务动作

### B. 外部浏览器终端

包括：

- iPhone Safari
- iPhone Chrome
- Android Chrome
- TikTok 浏览器
- Meta/Facebook 浏览器
- Instagram 浏览器
- Messenger 浏览器

特点：

- 可浏览内容
- 可点击业务按钮
- 但真正业务执行要跳入 LINE 内继续

## 唯一正确链路

统一业务链路固定为：

`浏览落地页 -> 点击业务动作 -> 创建 pending intent -> 判断当前终端 -> 若外部浏览器则进入 /welfare/follow-confirm 门控页并跳转 LINE 内 -> identify -> check-follow -> 若未关注则关注确认 -> consume intent -> 自动继续原业务下一步`

## 页面职责

### 落地页 / 详情页

只负责：

- 展示内容
- 让用户点击业务动作
- 创建 `pending_intent`
- 跳转下一层

禁止：

- 页面自己做关注确认
- 页面自己做 LINE 身份识别
- 页面自己决定回首页或回个人中心
- 页面自己直接执行业务动作

### /welfare/follow-confirm（统一门控页）

只负责：

- 告诉用户：当前操作需要在 LINE 内继续
- 提供“在 LINE 中继续”按钮
- 提供“返回当前详情页”按钮
- 提供“重新识别 LINE 身份”按钮

禁止：

- 显示“恢复原操作失败”
- 显示“请先注册/请先登录”
- 自动跳福利中心
- 自动跳个人中心

### ContinuePage

只负责：

1. 读取 `intent`
2. 识别当前 LINE 身份
3. 检查是否已关注 OA
4. 若未关注则走关注确认
5. 完成后直接 `consume intent`
6. 跳转到 `success_path / return_path`

禁止：

- 自己拼业务页面逻辑
- 自己决定用户等级
- 失败时默认跳 `/welfare`
- 失败时默认跳 `/mine`

## 关注 OA 确认的正确设计

关注确认只是主链中的一步，不是独立终点。

未关注用户：

1. 保留当前 `intent`
2. 在 LINE 内触发关注确认
3. 关注成功后立即继续 `consume intent`
4. 不再让用户重复找页面

已关注用户：

- 不再重复提示关注
- 直接推进 `consume intent`

## 动作与下一步映射

### claim_coupon

- 直接 `consume`
- 成功后回当前卡券详情页
- 页面状态变成“已领取”

### participate_activity

- 直接 `consume`
- 成功后进入活动结果页 / 奖励结果页

### redeem_product

- 直接 `consume`
- 成功后跳商品兑换结果页或兑换记录页

### use_benefit

- 直接 `consume`
- 成功后按权益类型进入下一业务页

## 前端状态机规范

统一建议状态机：

`browsing -> intent_created -> open_in_line -> line_continue -> identified -> follow_checked -> follow_confirmed_if_needed -> consuming -> success`

禁止错误状态机：

- 点击按钮 -> 回首页 -> 弹关注 -> 再找按钮
- 点击按钮 -> 关注完成 -> 回个人中心
- 点击按钮 -> 外部浏览器报错 -> 返回福利中心
- 点击按钮 -> 多个页面各自恢复动作

## URL 与路径规范

外部浏览器到 LINE 的统一目标只允许：

- `/welfare/continue?intent=...`

禁止：

- `/welfare/welfare/continue`
- `/welfare//continue`
- `continue` 二次拼接
- 打开 LINE 后再补一层 `/welfare`

统一门控页使用：

- `/welfare/follow-confirm?intent=...`

失败时只允许：

- 停留在 `/welfare/follow-confirm`
- 或停留在 `ContinuePage`
- 给“重试”“返回详情页”按钮

禁止：

- 自动跳 `/welfare`
- 自动跳 `/mine`

## 日志要求

`pending_intent` 必须保留：

- `intent_id`
- `action_type`
- `resource_id`
- `return_path`
- `success_path`
- `fail_path`
- `terminal`
- `line_user_id`
- `canonical_user_id`
- `consume_status`
- `result_code`

一条完整成功链路至少能看到：

- `issued`
- `continue enter`
- `identify`
- `check-follow`
- `consume_start`
- `consume_done`

外部浏览器需额外记录：

- `follow_gate_view`
- `follow_gate_continue_click`
- `line_continue_enter`

## 文案规范

/welfare/follow-confirm：

- 标题：`请在 LINE 内继续完成身份识别`
- 副文案：`当前操作需要在 LINE 内继续完成，返回原详情页后可重新发起。`
- 按钮：
  - `在 LINE 中继续`
  - `返回当前详情页`
  - `重新识别 LINE 身份`

禁止文案：

- 恢复原操作失败
- 请先注册
- 请先登录
- 尚未注册系统
- 返回福利中心

## 一句话总纲

针对 Google/TikTok/Meta 等外部浏览器用户的正确设计必须固定为：

- 浏览开放
- 动作门控
- 点击后立即创建业务 intent
- 外部浏览器统一进入 `/welfare/follow-confirm`
- 跳入 LINE 内完成身份识别与 OA 确认
- 确认后自动继续原业务动作的下一步
- 不再走传统“先关注 -> 再找业务页 -> 再点下一步”的长路径
