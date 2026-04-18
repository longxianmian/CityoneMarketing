# 唯一身份与业务身份分层规范

本规范是用户端身份识别、关注判断、业务身份分层的唯一约束。修改本模块前，必须先阅读本文件与同目录下的《README-外部浏览器进入LINE继续链路规范.md》。

## 固定规则

- 唯一身份映射固定为：`line_user_id -> user_id`
- 关注 OA = 自动注册系统用户
- 业务身份等级固定为：
  - `visitor`
  - `fan`
  - `customer`
  - `member`
- 状态流转固定为：`visitor -> fan -> customer -> member`
- `identity_level` 只允许后端统一计算
- 前端禁止自行推断身份
- `check-follow` 只回答是否关注 OA
- 所有卡券、积分、订单、押金、权益统一挂 `user_id`
- 禁止使用“注册 / 登录 / 未注册 / 请先注册”传统账号体系语义

## 唯一身份规则

- 外部唯一身份：`line_user_id`
- 内部唯一主键：`user_id`
- 一个 `line_user_id` 只能绑定一个 `user_id`
- 前端页面不得自行生成或拼装正式用户主键

## 业务身份等级

### visitor

- 当前会话尚未识别到 LINE 身份
- 仅表示当前会话未识别，不代表这个人一定没有关注 OA

### fan

- 已识别到 `line_user_id`
- 已确认关注 OA
- 等于已完成 H5 系统注册

### customer

- 已是 `fan`
- 且至少发生过一次真实充电业务

### member

- 已是 `customer`
- 且已缴纳押金

## 强约束

- 前端禁止用本地缓存头像昵称推身份
- 前端禁止用 points 账户推 `fan`
- 前端禁止不同接口各算一套身份等级
- 页面自己禁止把 `visitor` 升级成 `fan / customer / member`
- 页面文案禁止再出现“注册 / 登录 / 未注册 / 请先注册”
- 首页 / 个人中心禁止承担恢复业务动作的 fallback 角色

## 读取真源

前端用户端页面必须以 `/api/user/profile/me` 返回的以下字段为身份真源：

- `user_id`
- `line_user_id`
- `is_fan`
- `identity_level`
- `deposit_paid`
- `has_charge_order`

除 `/api/user/check-follow` 外，其它接口不得再单独计算“是否关注 OA”。

## 一句话总纲

本模块后续所有开发必须服从以下规则：

- 唯一身份：`line_user_id -> user_id`
- 关注 OA = 自动注册系统用户
- 唯一关注真源：`is_fan`
- 唯一业务身份等级：`visitor / fan / customer / member`
- 唯一升级路径：关注 OA -> `fan`，使用充电 -> `customer`，缴纳押金 -> `member`
