# 管理端客户/会员管理旧语义统一任务单

## 目标

将管理端旧的 `fan / user / member` 语义统一到：

- `visitor`
- `fan`
- `customer`
- `member`

本任务单只定义改造范围与顺序，本轮不改业务逻辑。

## 当前已识别范围

### 后端

- `/Users/lxtx/Documents/New project/CityoneMarketing/artifacts/cityone-growth-backend/backend/src/routes/members.js`
  - 当前仍按 `fan / user / member` 组织列表与统计
  - 注释、标签和返回结构仍是旧语义

### 前端管理端

- `/Users/lxtx/Documents/New project/CityoneMarketing/artifacts/cityone-growth-frontend/src/features/growth/CustomerManage.tsx`
  - 当前核心类型：`member | user | fan`
  - 统计、筛选、颜色、标签均是旧语义

- `/Users/lxtx/Documents/New project/CityoneMarketing/artifacts/cityone-growth-frontend/src/features/growth/MemberManage.tsx`
  - 当前 `identity_tag` 仍是 `member | user | fan`
  - 列表与统计仍按旧语义展示

- `/Users/lxtx/Documents/New project/CityoneMarketing/artifacts/cityone-growth-frontend/src/layout/AdminLayout.tsx`
  - 菜单仍沿用 `member/list`、`member/benefits` 旧路径与文案

## 建议改造顺序

### 第一步：后端统一返回新语义

- `routes/members.js`
  - 统一返回 `visitor / fan / customer / member`
  - 旧 `user` 映射为 `customer`

### 第二步：前端管理端统一标签/筛选/统计

- `CustomerManage.tsx`
- `MemberManage.tsx`

要求：

- 不再显示旧 `user`
- 统计项统一成：
  - visitorCount
  - fanCount
  - customerCount
  - memberCount

### 第三步：菜单与页面文案统一

- `AdminLayout.tsx`
- 相关 i18n 文案

## 验收标准

1. 管理端列表不再出现旧 `user` 身份标签
2. 管理端筛选和统计统一为 `visitor / fan / customer / member`
3. 前后端返回与展示口径一致
4. 不影响当前用户端身份真源链路
