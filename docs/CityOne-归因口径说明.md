# CityOne 归因口径说明

更新日期：2026-04-16

## 1. 文档目的

这份文档用于统一回答：

- 什么叫“归因”
- 系统里哪些字段属于归因字段
- 这些字段应该在哪些表里落快照
- 不同模块之间应该如何复用同一套归因口径

本文的目标不是讲 BI 术语，而是定义 CityOne 当前系统里真正要执行的归因标准。

## 2. 归因的核心定义

在 CityOne 里，归因的最小定义是：

**把一次业务结果，绑定回它的来源入口、来源渠道、来源站点、来源活动和来源设备。**

当前最重要的业务结果包括：

- 活动参与
- 积分发放
- 卡券发放
- 商品兑换
- 借电订单
- 用户关注/注册/识别

## 3. 归因对象分层

为了避免混乱，归因对象分成 5 层。

### 3.1 渠道层

字段：

- `source_channel_id`
- `utm_source`
- `utm_campaign`

含义：

- 用户从哪个推广渠道进入
- 例如 LINE、Facebook、TikTok、线下二维码、店员推荐

### 3.2 入口层

字段：

- `entry_type`
- `entry_code`
- `source_entry_id`
- `landing_code`
- `source_landing_id`
- `banner_code`
- `source_banner_id`

含义：

- 用户具体从哪个入口对象进入
- 入口对象可以是二维码、落地页、Banner、业务入口位

### 3.3 站点层

字段：

- `site_id`
- `source_station_code`
- `source_a_system_station_id`
- `source_device_code`

含义：

- 这次业务结果最终归属于哪个站点和设备

### 3.4 活动层

字段：

- `activity_id`
- `source_activity_id`

含义：

- 这次结果是由哪个活动触发或关联的

### 3.5 用户层

字段：

- `user_id`
- `line_user_id`

含义：

- 最终把归因结果绑定到谁身上

## 4. 当前系统里已经存在的关键归因字段

当前代码里已经真实使用的归因字段包括：

- `source_entry_id`
- `source_landing_id`
- `source_banner_id`
- `source_channel_id`
- `source_station_code`
- `source_a_system_station_id`
- `source_device_code`
- `source_activity_id`

这些字段目前最明确地落在：

- `activity_participations`
- `points_ledger`

说明：

- 活动参与记录和积分流水已经是当前最重要的归因快照载体

## 5. 当前最应遵守的归因原则

### 5.1 一次业务结果只认一份快照

规则：

- 一旦写入业务结果表，就同时写入归因快照
- 后续报表和页面应优先读这份快照
- 不应依赖实时回推入口关系来重算历史归因

原因：

- 入口配置、站点绑定、活动配置都会变化
- 如果不写快照，历史数据会被“今天的配置”污染

### 5.2 业务结果优先于展示过程

当前系统最需要先稳定的是“结果归因”，而不是“曝光归因”。

优先顺序应为：

1. 活动参与归因
2. 积分发放归因
3. 卡券发放归因
4. 商品兑换归因
5. 借电订单归因
6. 页面曝光/点击归因

### 5.3 `user_id` 是业务归因主键

规则：

- 所有最终业务结果都应尽量以 `user_id` 为主键落账
- `line_user_id` 只作为关联补充

原因：

- `line_user_id` 更适合社交身份
- `user_id` 才适合做订单、积分、权益、履约等业务归因主键

### 5.4 快照优先级必须固定

对于活动参与和积分发放，建议固定以下优先级：

1. 请求体明确传入的归因字段
2. 活动自身配置的默认来源字段
3. 通过 `source_entry_id` 反查入口实例
4. 通过站点映射补齐站点/A 系统站点/设备字段
5. 实在缺失时再为空，不允许随意猜测

## 6. 当前代码里的归因落点

### 6.1 入口解析阶段

入口解析服务当前会输出：

- 用户阶段
- 路由结果
- 入口上下文
- 店员归因摘要
- 事件上下文

这部分更偏“归因前置计算”，不是真正的业务结果落库。

### 6.2 活动参与阶段

当前活动参与已经是最完整的归因落点之一。

已写入字段包括：

- `source_entry_id`
- `source_landing_id`
- `source_banner_id`
- `source_channel_id`
- `source_station_code`
- `source_a_system_station_id`
- `source_device_code`

这部分已经具备“结果归因快照”的基本标准。

### 6.3 积分发放阶段

当前积分流水会继承活动参与的归因快照。

这很好，因为它保证了：

- 奖励积分能回查来源
- 归因分析不只停留在“参与了”，还能追踪到“实际发了多少奖励”

### 6.4 分享/消费归因阶段

当前系统已存在：

- `share_relations`
- `consume_relations`

但这两块和活动、站点、订单主链路之间还没形成完全统一口径。

### 6.5 订单归因阶段

这是当前明显未完成的部分。

管理端已有“订单归因”占位，但还没有形成完整生产级实现。

## 7. 建议的统一归因字典

### 7.1 必备字段

所有重要结果表，建议都支持以下字段：

- `user_id`
- `line_user_id`
- `source_entry_id`
- `source_landing_id`
- `source_banner_id`
- `source_channel_id`
- `source_activity_id`
- `source_station_code`
- `source_a_system_station_id`
- `source_device_code`
- `created_at`

### 7.2 按对象补充字段

#### 活动参与

- `activity_id`
- `joined_at`

#### 积分流水

- `ref_type`
- `ref_id`
- `reason`

#### 用户卡券

建议补强：

- `source_entry_id`
- `source_landing_id`
- `source_banner_id`
- `source_channel_id`
- `source_station_code`

当前 `user_coupons` 已有 `source_activity_id` 和基础来源字段，但还不够完整。

#### 兑换记录

建议补强：

- `source_coupon_id`
- `source_activity_id`
- `source_entry_id`
- `source_channel_id`
- `source_station_code`

#### 订单

未来正式接入后建议至少具备：

- `order_id`
- `user_id`
- `source_entry_id`
- `source_channel_id`
- `source_station_code`
- `source_device_code`
- `source_activity_id`

## 8. 报表口径建议

### 8.1 归因总览

归因总览建议只统计已落快照的数据，不做过多推测。

建议定义：

- 到页数：入口事件
- 点击数：有效点击/参与触发
- 关注数：`share_relations` 或 OA follow 事件
- 用户数：形成有效 `user_id` 的用户
- 会员数：满足会员口径的用户
- 归因订单：带有效归因快照的订单数

### 8.2 按对象归因

对象可分：

- 活动
- 卡券
- 站点
- 渠道
- 入口

原则：

- 一个报表口径只能有一个主归因对象
- 不能同一张表里把“活动”和“入口”混成同一层级统计维度

### 8.3 按渠道归因

规则：

- 统一优先使用 `source_channel_id`
- 没有值时才落到“直接访问”或默认渠道

### 8.4 按站点归因

规则：

- 优先使用 `source_station_code`
- 仅当站点码缺失时才使用 `source_a_system_station_id`

## 9. 当前口径缺口

### 9.1 曝光与点击未形成统一事件主表

当前系统已有入口事件上下文，但没有统一“事件事实表”落库。

影响：

- 漏斗归因不够可信

### 9.2 卡券与兑换的归因字段仍不完整

当前活动发券和用户券已有来源字段基础，但还没有像活动参与那样形成完整快照体系。

影响：

- 后续很难做“哪种入口发出去的券最有效”这类分析

### 9.3 订单归因未正式落地

这是当前归因体系最关键的缺口之一。

影响：

- 无法把增长链路真正连接到收入或借电业务结果

### 9.4 入口对象和渠道对象边界仍可能混用

风险表现：

- 把二维码当渠道
- 把 Banner 当入口又当活动
- 把站点码当来源 ID

解决原则：

- 渠道、入口、站点、活动必须强制分层

## 10. 生产级验收标准

归因模块达到生产级，至少要满足：

1. 有统一字段字典
2. 关键结果表都写入归因快照
3. 历史结果不依赖运行时重算
4. 报表维度边界清晰
5. 订单归因正式接入
6. 页面与报表口径一致
7. 可回查到入口、站点、活动、渠道

## 11. 当前建议的推进顺序

### 第一优先级

1. 统一归因字段字典
2. 补齐 `user_coupons` 和 `mall_redeems` 的归因快照
3. 定义订单归因主表方案

### 第二优先级

1. 补统一事件事实表
2. 把入口、点击、关注、注册、参与串起来
3. 收口归因中心页面与后端接口口径

### 第三优先级

1. 做渠道/入口/站点三层钻取报表
2. 做跨对象归因复盘能力

## 12. 一句话总结

CityOne 当前已经具备“归因快照”的雏形，特别是在活动参与和积分奖励这两块。

但真正达到生产级，还必须继续补：

- 统一字段字典
- 卡券与兑换归因
- 订单归因
- 统一事件事实表

否则归因能力仍然只能算“局部可用”，不能算“全系统可信”。

