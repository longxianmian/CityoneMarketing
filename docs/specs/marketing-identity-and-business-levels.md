# 营销系统唯一身份与业务身份分层规范文档

## 文档目标

本文件是 CityOne 营销增长系统关于“唯一身份”“关注状态”“业务身份等级”的唯一规范，用来彻底终止以下混乱：

- 同一用户在不同页面被识别成不同身份
- 页面自行推断身份，导致逻辑漂移
- 关注 OA、领取卡券、充电、押金之间关系不清
- 前端和后端各算一套身份
- H5 系统与共享充电宝系统旁路连接后出现双重注册、双重身份

后续所有开发、调试、接口、页面显示、埋点、风控、旁路桥接，都必须服从本文件。

## 总原则

### 唯一身份与业务身份必须分层

系统必须区分两层：

#### 第一层：底层唯一身份

用于回答“这个人是谁”。

- 外部唯一身份：`line_user_id`
- 内部唯一主键：`user_id`

规则：

- 一个 `line_user_id` 只能绑定一个 `user_id`
- 所有卡券、积分、订单、押金、权益、充电记录统一挂在 `user_id`
- 前端任何页面都不得自行发明用户身份，只能读取后端返回的当前 `user_id`

#### 第二层：业务身份等级

用于表达“这个用户当前处于什么业务阶段”。

统一只允许：

- `visitor`
- `fan`
- `customer`
- `member`

### 产品规则写死

- 关注 OA = 自动注册 H5 系统用户
- 使用过充电业务 = 升级为业务用户
- 缴纳押金 = 升级为会员

因此：

- 不再使用传统账号体系逻辑
- 不再使用“注册/未注册/请先注册”等文案
- 所有身份逻辑统一以 LINE 身份识别与真实业务事件为准

### 身份升级只能由后端业务事件驱动

禁止：

- 页面点击后自己改身份
- 前端根据缓存、昵称、头像、积分账户等自行推断身份
- 不同接口各算一套身份等级

只允许：

- 后端根据真实业务事实计算并返回身份等级

## 身份模型

### visitor

- 当前会话尚未识别到 LINE 身份
- 仅代表“当前会话未识别”，不代表这个人一定没有关注 OA

条件：

- `line_user_id` 缺失

能力：

- 可浏览公开内容
- 不可领取卡券、参与活动、兑换权益、发起充电业务

### fan

- 已识别到 `line_user_id`
- 已确认关注 OA
- 等于已完成 H5 系统注册

条件：

- `line_user_id` 存在
- `is_fan = true`
- `has_charge_order = false`

### customer

- 已是 fan
- 且至少发生过一次真实充电业务

条件：

- `line_user_id` 存在
- `is_fan = true`
- `has_charge_order = true`
- `deposit_paid = false`

### member

- 已是 customer
- 且已完成押金缴纳

条件：

- `line_user_id` 存在
- `is_fan = true`
- `has_charge_order = true`
- `deposit_paid = true`

## 唯一状态机

业务身份状态机固定为：

`visitor -> fan -> customer -> member`

升级条件：

- `visitor -> fan`：成功识别 LINE 身份 + 成功确认关注 OA
- `fan -> customer`：第一次完成真实充电业务
- `customer -> member`：成功缴纳押金

## users 表核心字段

`users` 至少应统一维护：

- `user_id`
- `line_user_id`
- `display_name`
- `picture_url`
- `is_fan`
- `has_charge_order`
- `deposit_paid`
- `identity_level`
- `last_identified_at`
- `last_follow_checked_at`

约束：

- `line_user_id` 必须唯一
- `identity_level` 只允许：`visitor/fan/customer/member`

后端计算规则：

```ts
if (!line_user_id) return 'visitor'
if (!is_fan) return 'visitor'
if (deposit_paid) return 'member'
if (has_charge_order) return 'customer'
return 'fan'
```

## 接口规范

### POST /api/user/identify

作用：

- 识别当前 LINE 用户
- 建立或获取唯一 `user_id`
- 将 `line_user_id` 映射到系统主键

必须返回：

- `user_id`
- `line_user_id`
- `is_fan`
- `identity_level`
- `deposit_paid`
- `has_charge_order`
- `display_name`
- `picture_url`

### GET /api/user/profile/me

作用：

- 返回当前用户唯一身份与业务身份真源

前端所有页面统一只读：

- `user_id`
- `line_user_id`
- `is_fan`
- `identity_level`
- `deposit_paid`
- `has_charge_order`
- `display_name`
- `picture_url`

### GET /api/user/check-follow

作用：

- 只回答当前是否已关注 OA

只允许返回：

- `line_user_id`
- `is_fan`

## 前端显示规则

总规则：

- 前端页面只能读后端真源，不自行推断身份

禁止：

- 用本地缓存昵称头像推身份
- 用是否存在 points 账户推 fan
- 用不同接口各算一套身份
- 用会话缓存替代后端真源

用户端页面统一从 `profile/me` 获取身份：

- WelfareHomePage
- MinePage
- CouponUserPage
- ActivityUserPage
- ProductDetailPage
- RedeemUserPage
- BenefitUsePage
- OpenInLinePage

## 文案规范

禁止再使用：

- 注册
- 未注册
- 请先注册
- 登录
- 请先登录
- 注销账户
- 退出账号

统一使用：

- `visitor`：当前会话尚未识别到 LINE 身份 / 请在 LINE 内继续完成身份识别
- `fan`：已关注 LINE OA，已完成系统注册
- `customer`：已使用充电服务
- `member`：已缴纳押金，可直接取电

## 与共享充电宝系统旁路连接的兼容规则

- 不改变“关注 OA = 自动注册系统用户”
- 只旁路补充：
  - 是否有真实充电订单
  - 是否已缴纳押金
- 禁止双注册体系、双 user_id 体系

## 一句话总纲

本系统今后的身份规则固定为：

- 唯一身份：`line_user_id -> user_id`
- 关注 OA = 自动注册系统用户
- 唯一关注真源：`is_fan`
- 唯一业务身份等级：`visitor / fan / customer / member`
- 唯一升级路径：关注 OA -> fan，使用充电 -> customer，缴纳押金 -> member
