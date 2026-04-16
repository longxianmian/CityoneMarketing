# CityOne 全系统数据地图

更新日期：2026-04-16

## 1. 文档目的

这份文档用于回答 4 个问题：

- 系统里到底有哪些核心数据对象
- 每个对象的主键和主数据来源是什么
- 哪些接口负责写入，哪些页面/接口负责读取
- 当前哪些对象已经稳定，哪些对象仍处于过渡态

本文以当前仓库代码为准，重点覆盖：

- 用户端
- 管理端
- 后端核心业务对象
- 归因与入口对象
- Agent 运行对象

## 2. 系统分层

当前系统可以分成 6 层：

1. 用户端展示层
   - 福利中心
   - 活动详情
   - 卡券详情
   - 我的权益
   - 附近站点
   - 问问 Agent

2. 管理端运营层
   - 福利中心
   - 站点管理
   - 积分管理
   - AI Agent
   - 客户管理
   - 系统配置

3. 后端业务路由层
   - activities
   - coupons
   - stations
   - growth-points
   - mall-items
   - user-profile
   - agent / agent-admin
   - entry / attribution

4. 服务编排层
   - entry-resolver
   - feature-router
   - reward-engine
   - event-tracker
   - staff-attribution
   - agent identity / policy / tool router

5. 持久化层
   - PostgreSQL 主表
   - 少量本地 JSON 配置/兜底文件

6. 外部依赖层
   - LINE OA
   - A 系统
   - OSS
   - OpenAI / embedding
   - 远端 PostgreSQL

## 3. 核心对象总览

| 对象 | 主键 | 当前主数据来源 | 主要写入链路 | 主要读取链路 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| 用户账户 | `user_id` | PostgreSQL + 部分 JSON 兜底 | 活动参与、积分初始化、A 系统桥接 | 个人中心、客户管理、Agent | 过渡态 |
| LINE 身份 | `line_user_id` | LINE / 请求上下文 | OA 关注、Agent 会话、入口解析 | 用户端、Agent、客户管理 | 过渡态 |
| 积分账户 | `user_id` | `points_accounts` | 活动奖励、积分调整、积分初始化 | 个人中心、积分管理、Agent | 较稳定 |
| 积分流水 | `id` | `points_ledger` | 活动奖励、积分调整、兑换 | 用户积分流水、管理端流水 | 较稳定 |
| 活动 | `activity_id` | `activities` | 管理端活动配置 | 福利中心、活动详情、归因统计 | 较稳定 |
| 活动参与记录 | `id` | `activity_participations` | `/api/activities/:id/participate` | 归因、统计、奖励发放 | 较稳定 |
| 卡券定义 | `id` | `coupons` | 管理端卡券配置 | 福利中心、卡券详情、活动奖励绑定 | 较稳定 |
| 用户卡券 | `id` | `user_coupons` | 领券、活动发券、兑换写回 | 我的权益、卡券详情、核销 | 较稳定 |
| 商城商品 | `id` | `mall_items` | 管理端商品配置 | 商城、商品兑换券承接 | 较稳定 |
| 兑换记录 | `id` | `mall_redeems` | 商品兑换、商品券兑换 | 兑换记录、履约回查 | 半闭环 |
| 站点 | `station_code` | `stations` | 管理端站点配置、A 系统同步 | 附近站点、站点管理、活动归因 | 较稳定 |
| 入口实例 | `entry_code` | `entry_instances` 等入口配置 | 入口中心/二维码链路 | 入口解析、活动参与归因 | 半闭环 |
| 渠道 | `source_channel_id` | 活动/入口请求上下文 | 活动参与、积分流水快照 | 归因统计 | 口径未统一 |
| Banner/落地页 | `source_banner_id` / `landing_code` | 活动配置 / 入口上下文 | 活动参与快照 | 归因统计 | 口径未统一 |
| 邀请关系 | 组合关系 | `invite_relations` / `share_relations` | 邀请链路 | 积分归因、邀请统计 | 半闭环 |
| 消费归因 | 组合关系 | `consume_relations` | 订单/消费链路 | 积分归因、归因统计 | 半闭环 |
| Agent 会话 | `session_id` | Agent 会话服务存储 | 用户发起问问会话 | 会话日志、消息历史 | 较稳定 |
| Agent 意图 | `intent_code` | JSON 配置 + 向量标签表 | 管理端意图配置 | 意图测试器、问问运行时 | 过渡态 |

## 4. 用户与身份对象

### 4.1 当前存在的身份字段

系统里实际存在并被使用的身份维度主要有：

- `user_id`
- `line_user_id`
- `identity_tag`
- `user_stage_code`
- `deposit_paid`
- `member_level`

### 4.2 当前身份口径

当前代码里实际存在两套相关但不完全一致的身份体系：

1. 用户运营身份
   - `fan`
   - `user`
   - `member`

2. 入口/Agent 运行时身份
   - `visitor_unfollowed`
   - `oa_followed_registered`
   - `identified_user`

### 4.3 当前主问题

- 这两套身份体系尚未完全统一
- `user_id` 与 `line_user_id` 仍存在并行查询
- 部分页面仍通过“存在积分账户/是否缴押金”推断身份

### 4.4 建议主键策略

建议全系统统一采用：

- 业务主用户键：`user_id`
- 社交身份关联键：`line_user_id`

规则：

- 所有业务表以 `user_id` 为主
- `line_user_id` 作为关联字段和回查字段
- 不再允许新业务逻辑只依赖 `line_user_id` 独立运转

## 5. 福利与增长对象

### 5.1 活动

核心对象：

- `activities`
- `activity_participations`
- `activity_product_bindings`

关键关系：

- 一个活动可绑定多个奖励对象
- 奖励对象当前以卡券为主，也可扩展到商品
- 用户参与活动后，会写入活动参与记录，并触发积分/卡券发放

### 5.2 卡券

核心对象：

- `coupons`
- `user_coupons`

关键关系：

- `coupons` 是平台券定义
- `user_coupons` 是用户实际拥有的权益实例

推荐理解：

- `coupons` = 模板
- `user_coupons` = 实例

### 5.3 商城与兑换

核心对象：

- `mall_items`
- `mall_redeems`

关键关系：

- 商品兑换券可绑定具体 `mall_items`
- 用户完成兑换后会写入 `mall_redeems`

当前状态：

- 商品绑定已成型
- 履约、发货、售后仍未完成全链路生产验收

### 5.4 积分

核心对象：

- `points_accounts`
- `points_ledger`
- `points_rules`

关键关系：

- `points_accounts` 记录账户余额类信息
- `points_ledger` 记录所有积分变化明细
- `points_rules` 提供规则配置

当前建议：

- 所有积分变化以 `points_ledger` 为审计基准
- `points_accounts` 只作为余额快照，不应作为唯一审计依据

## 6. 站点与入口对象

### 6.1 站点

核心对象：

- `stations`

当前已承载信息：

- 站点基础位置
- 容量与可用数
- A 系统站点/设备映射
- 增长入口绑定字段
- 默认活动字段

### 6.2 入口

当前入口链路实际涉及：

- `entry_type`
- `entry_code`
- `entry_instances`
- `landing_code`
- `banner_code`

系统角色：

- 入口负责把用户从“扫描、点击、打开页面”带入业务链路
- 入口解析服务决定去哪个 feature、是否需要关注 OA、是否需要自动注册

### 6.3 当前问题

- 站点对象已较清楚
- 入口对象有服务骨架，但配置中心和最终落库口径还没有完全收敛
- 站点福利视图尚未升级成“站点命中的活动/卡券/入口结果页”

## 7. 归因对象

当前代码中实际出现的归因字段主要包括：

- `source_entry_id`
- `source_landing_id`
- `source_banner_id`
- `source_channel_id`
- `source_station_code`
- `source_a_system_station_id`
- `source_device_code`

这些字段当前最稳定的写入点是：

- `activity_participations`
- `points_ledger`

这说明当前系统的归因主线实际上是：

- 活动参与记录
- 积分发放记录

而不是：

- 完整订单主链路
- 完整曝光点击链路

## 8. 客户与会员对象

管理端“客户管理”当前主要是运营视图，不是完整客户主数据中心。

当前可见信息包括：

- 身份标签
- 来源标签
- 押金状态
- 积分
- 部分权益摘要

但这块还存在几个明显过渡态特征：

- 来源口径仍不完全来自统一真实主数据
- 粉丝/用户/会员权益并未全部配置化
- 客户对象与订单对象、站点对象、归因对象之间还未形成统一客户画像

## 9. Agent 对象

当前问问 Agent 相关对象分成 4 组：

### 9.1 配置对象

- Agent 配置
- 意图配置
- 工具配置
- 卡片模板
- 协议内容
- 角色关键词

### 9.2 运行对象

- Agent 会话
- Agent 消息
- 命中意图
- 工具执行结果
- 确认动作

### 9.3 用户身份上下文

- `line_user_id`
- `user_id`
- `entry_type`
- `entry_code`
- `site_id`
- `user_stage_code`

### 9.4 当前状态

- 配置对象已基本成型
- 测试对象已可用
- 真正的生产级“自动执行对象”还未完全收口

## 10. 当前主数据来源说明

### 10.1 已以 PostgreSQL 为主的对象

- `activities`
- `activity_participations`
- `activity_product_bindings`
- `coupons`
- `user_coupons`
- `stations`
- `points_accounts`
- `points_ledger`
- `mall_items`
- `mall_redeems`

### 10.2 仍依赖 JSON 配置或本地文件的对象

- 部分 Agent 意图/配置资产
- 部分用户 profile 补充字段
- 部分历史活动/互动兼容数据

### 10.3 仍依赖外部系统或待桥接对象

- A 系统用户/设备/借电订单
- LINE OA 关注与回跳真实数据
- OpenAI / embedding 向量能力

## 11. 主链路数据流

### 11.1 活动参与链路

数据流：

1. 用户进入活动页
2. 发起活动参与
3. 写入 `activity_participations`
4. 视规则写入 `points_ledger`
5. 更新 `points_accounts`
6. 如有绑定奖励则写入 `user_coupons`

### 11.2 领券链路

数据流：

1. 用户查看券详情
2. 发起 claim
3. 写入 `user_coupons`
4. 用户端改为已拥有态展示

### 11.3 商品券兑换链路

数据流：

1. 用户打开已拥有的商品兑换券
2. 进入兑换动作页
3. 发起兑换
4. 写入 `mall_redeems`
5. 更新 `user_coupons` 状态

### 11.4 问问链路

数据流：

1. 用户发起会话
2. 系统确定身份上下文
3. 命中意图
4. 决定分发方式
5. 执行工具或生成卡片
6. 记录会话与日志

## 12. 当前最需要统一的对象口径

优先级最高的 6 个对象：

1. 用户
2. 站点
3. 入口
4. 活动
5. 卡券
6. 归因快照

如果这 6 个对象口径不统一，后续再扩页面和报表会持续出现：

- 数据不一致
- 页面结果不一致
- 归因不一致
- 对账困难

## 13. 建议的下一步输出

基于这份数据地图，建议继续补 3 份文档：

1. 《归因口径说明》
2. 《主链路生产验收清单》
3. 《环境与部署依赖说明》

## 14. 一句话总结

当前 CityOne 的系统对象已经不是“没有结构”，而是：

- 核心业务对象已经出现清晰骨架
- 但主数据主键、归因字段、外部桥接对象还没有完全统一

真正进入生产级之前，最关键的不是再加多少页面，而是先把这些对象统一成一张所有人都能按同一个口径理解的数据地图。

