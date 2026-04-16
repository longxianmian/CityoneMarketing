# CityOne 主链路生产验收清单

更新日期：2026-04-16

## 1. 文档目的

这份清单不讲概念，只用于执行验收。

目标是把 CityOne 当前最关键的主链路拆成可逐项打勾的生产级标准，避免出现：

- 页面看起来像已完成
- 实际写表、回查、归因、审计并不完整

本清单覆盖 8 条主链路：

1. 用户进入与入口解析
2. OA 关注与身份识别
3. 活动参与与奖励发放
4. 卡券领取与已拥有权益
5. 商品兑换券与积分商城兑换
6. 积分账户与积分流水
7. 站点福利承接
8. 问问 Agent 承接与动作分发

## 2. 验收标准总则

每条主链路要达到生产级，至少满足：

- 有明确输入
- 有明确写入
- 有明确回查
- 有明确归因字段
- 有明确异常兜底
- 有明确管理端验证页
- 有最小审计能力

如果只满足“页面打开了”或“接口有返回”，不能算通过。

## 3. 链路一：用户进入与入口解析

### 3.1 输入

- `entry_type`
- `entry_code`
- `site_id`
- `line_user_id`
- `user_id`
- `utm_source`
- `utm_campaign`
- `referrer_type`
- `referrer_id`

### 3.2 生产级通过标准

- 能通过统一入口解析服务解析路由结果
- 能判断是否需要 OA 关注
- 能输出用户阶段
- 能输出 feature 路由结果
- 能输出最小归因上下文
- 能输出事件上下文

### 3.3 回查点

- `/api/entry/resolve`
- `/api/entry/config`
- `/api/entry/feature-rules`

### 3.4 风险检查

- 不允许入口规则只存在前端
- 不允许 feature 路由靠页面写死
- 不允许入口与渠道混用同一个字段

### 3.5 当前状态

- 已有骨架
- 仍需补统一事件事实表

## 4. 链路二：OA 关注与身份识别

### 4.1 输入

- `line_user_id`
- OA follow 状态
- `user_id`

### 4.2 生产级通过标准

- 能判断未关注 / 已关注 / 已识别用户
- 能区分访客、已关注未识别、已识别用户
- 关注失败不影响主链路稳定性
- 福利中心前端无错误调试弹窗
- 关注状态查询有稳定兜底接口

### 4.3 回查点

- `/api/user/check-follow`
- `WelfareHomePage`
- `useFollowGate`

### 4.4 风险检查

- 不允许只依赖前端 SDK 结果作为唯一判断
- 不允许 `getFriendship` 失败后直接报错中断体验

### 4.5 当前状态

- 已完成关键收口
- 仍需在线上环境继续验真

## 5. 链路三：活动参与与奖励发放

### 5.1 输入

- `activity_id`
- `user_id`
- `line_user_id`
- 归因快照字段

### 5.2 生产级通过标准

- 活动必须存在且处于有效状态
- 同一用户重复参与必须幂等
- 参与后必须稳定写入 `activity_participations`
- 如有积分奖励，必须写入 `points_ledger`
- 如有积分奖励，必须更新 `points_accounts`
- 如有奖励券绑定，必须写入 `user_coupons`
- 所有奖励结果可回查

### 5.3 归因要求

必须快照：

- `source_entry_id`
- `source_landing_id`
- `source_banner_id`
- `source_channel_id`
- `source_station_code`
- `source_a_system_station_id`
- `source_device_code`

### 5.4 回查点

- `activity_participations`
- `points_ledger`
- `user_coupons`
- 管理端活动页

### 5.5 当前状态

- 已接近生产级
- 仍需补对账页和异常审计

## 6. 链路四：卡券领取与已拥有权益

### 6.1 输入

- `coupon_id`
- `user_id`
- `line_user_id`
- 领取来源字段

### 6.2 生产级通过标准

- 待领取券与已拥有券必须彻底分离
- 已拥有券不得再次 claim
- 重复领取必须幂等
- 领取成功必须写入 `user_coupons`
- 已拥有态必须显示真实动作，而不是继续显示领取按钮

### 6.3 归因要求

至少应落：

- `source_entry_id`
- `source_landing_id`
- `source_banner_id`
- `source_channel_id`
- `source_station_code`
- `source_a_system_station_id`
- `source_device_code`
- `source_activity_id`

### 6.4 回查点

- `/api/user/coupons/claim`
- `/api/user/benefits`
- 卡券详情页
- 我的权益页

### 6.5 当前状态

- 已完成主结构修复
- 需要继续补齐完整归因快照

## 7. 链路五：商品兑换券与积分商城兑换

### 7.1 输入

- `coupon_id` 或 `item_id`
- `user_id`
- `line_user_id`
- 配送信息
- 归因来源字段

### 7.2 生产级通过标准

- 商品兑换券必须绑定具体商品
- 绑定商品删除/下架要有保护
- 库存不足必须阻止兑换
- 兑换成功必须写入 `mall_redeems`
- 对应 `user_coupons` 必须更新状态
- 积分兑换必须写入积分流水
- 实物商品必须校验配送信息

### 7.3 归因要求

建议落：

- `source_coupon_id`
- `source_entry_id`
- `source_landing_id`
- `source_banner_id`
- `source_channel_id`
- `source_activity_id`
- `source_station_code`
- `source_a_system_station_id`
- `source_device_code`

### 7.4 回查点

- `mall_redeems`
- `user_coupons`
- `points_ledger`
- 商城兑换记录页

### 7.5 当前状态

- 商品绑定闭环已打通
- 履约和归因仍需继续加强

## 8. 链路六：积分账户与积分流水

### 8.1 输入

- 活动奖励
- 商品兑换
- 手工调整
- 邀请奖励
- 消费奖励

### 8.2 生产级通过标准

- 所有积分变化都必须有流水
- 余额变化必须能被流水解释
- `points_accounts` 与 `points_ledger` 口径一致
- 用户端与管理端查询口径一致

### 8.3 回查点

- `points_accounts`
- `points_ledger`
- 用户积分页
- 管理端积分账户页
- 管理端积分流水页

### 8.4 当前状态

- 已具备基础生产能力
- 仍需补更严格的对账清单

## 9. 链路七：站点福利承接

### 9.1 输入

- `station_code`
- `entry_code`
- `landing_code`
- `default_activity_id`
- 活动站点范围
- 卡券站点范围

### 9.2 生产级通过标准

- 能从站点视角看到命中的活动
- 能从站点视角看到命中的卡券
- 能区分默认活动与范围命中活动
- 能看到主推荐福利
- 能解释为什么这个站点会命中这些福利

### 9.3 回查点

- `stations`
- `activities.site_scope_json`
- `coupons.station_scope`
- 站点福利页

### 9.4 当前状态

- 当前是重点整改项
- 必须从“只读站点表”升级为“福利结果页”

## 10. 链路八：问问 Agent 承接与动作分发

### 10.1 输入

- 用户语句
- `line_user_id`
- `user_id`
- `entry_type`
- `entry_code`
- `site_id`

### 10.2 生产级通过标准

- 具备明确意图命中结果
- 具备明确 `dispatch_mode`
- 工具调用有权限边界
- 确认型动作必须二次确认
- 会话日志可回查
- 命中测试器可验证配置结果

### 10.3 回查点

- Agent 配置页
- 意图管理页
- 意图命中测试器
- 会话日志
- 指标看板

### 10.4 当前状态

- 已具备生产化骨架
- 仍需继续补强自动执行、审计、真实环境向量能力

## 11. 当前优先级最高的必验项

按当前系统状态，最重要的 6 项验收是：

1. 活动参与是否真正幂等
2. 活动奖励发券是否真正回写 `user_coupons`
3. 已拥有券是否彻底不再 claim
4. 商品兑换券是否真正落 `mall_redeems`
5. 归因快照是否从活动/卡券/兑换三条线打通
6. 站点福利页是否能真正展示命中结果

## 12. 建议执行方式

建议每条主链路都按以下顺序验收：

1. 看输入参数
2. 看写入表
3. 看回查接口
4. 看管理端页面
5. 看用户端页面
6. 看异常路径

## 13. 一句话总结

真正的生产级验收，不是“页面点得通”，而是：

- 写得进去
- 查得出来
- 归得回去
- 对得上账

这份清单就是用来逐项做这件事的。

