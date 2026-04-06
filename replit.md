# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

## CityOne Growth 阶段一整改（已完成）

### AdminLayout 6组菜单
1. **增长总览** — 总览看板/渠道效果/活动效果/转化漏斗(CS)/订单归因(CS)
2. **福利中心** — 3子组：活动/卡券/权益
3. **入口与分发** — 承接页模板/入口中心/路由中心/二维码(CS)/OA引导(CS)
4. **激励与归因** — 积分规则/积分账户/积分流水/分享归因/消费归因/邀请裂变/奖励记录(CS)
5. **AI Agent** — 问问Agent/业务管理Agent(商务/推广/运营)/系统运维Agent/配置/意图/工具/日志/指标
6. **系统配置** — LINE配置/三语配置(CS)/风控规则/消息配置/系统参数(CS)

### MinePage 四按钮结构（T005 ✅）
- **奖品** (prize): 活动获得的抽奖/活动奖品，空状态占位
- **权益** (benefit): 原卡券tab，可用/已用/过期卡券列表
- **订单** (order): 借电订单记录
- **会员** (member): 原积分tab，积分摘要/明细/获取引导

### Agent 骨架页面（T003 ✅）
- `AgentWenwenPage.tsx` — 用户端问答 Agent 说明 + 接口预留
- `AgentBizPage.tsx` — 商务/推广/运营 3标签 KPI 监控占位
- `AgentSysOpsPage.tsx` — 系统运维监测范围 + 告警机制说明

---

## T007：阶段一验收结论（正式归档）

### 验收性质

**结构收敛验收 · 有条件通过**

本次通过仅代表：
- 管理端菜单与模块结构初步收敛
- 用户端 MinePage 四按钮结构初步收敛
- Agent 三类模块骨架初步建立
- 术语口径初步统一（粉丝/用户/会员、奖品/权益/卡券）

本次通过**不代表**：
- 用户端完整体验已通过
- 身份体系完整落地已通过
- 真实数据闭环已通过
- 生产闭环已通过

---

### 完成项（T001–T006 全部完成）

| # | 任务 | 状态 |
|---|------|------|
| T001 | i18n 补充新菜单6组 + mine四按钮 + Agent三类 + 身份三层 zh/th/en | ✅ |
| T002 | AdminLayout 重构6组菜单 | ✅ |
| T003 | Agent 三类骨架页 | ✅ |
| T004 | App.tsx 路由全量更新 + ComingSoon 占位 | ✅ |
| T005 | MinePage 四按钮改造（奖品/权益/订单/会员） | ✅ |
| T006 | 身份与术语口径统一（5文件7处定点修正） | ✅ |

---

### 高优先遗留问题（阶段二必须优先处理）

**A. MinePage 顶部身份标签未完全达标（高优先）**
- 当前仅显示等级信息（如"黄金会员"），不等于"粉丝 / 用户 / 会员"身份层级标签
- 身份标签显示依赖 LINE 登录链路的真实 profile 数据
- **阶段二优先修正项，不得延后**

**B. 旧页面兼容入口存在漂移风险（高优先）**
- `MyCouponsPage` / `MyPointsPage` 旧页面仍可直接访问，与 MinePage 四按钮体系语义重叠
- 会持续带来入口混乱与开发漂移风险
- **阶段二必须优先处理：旧入口隐藏、收口或重定向**

---

### 当前系统实际状态

**已达到：**
- 管理端菜单与模块结构初步收敛
- 用户端 MinePage 四按钮结构初步收敛
- Agent 三类模块骨架初步建立
- 术语口径初步统一

**尚未达到：**
- 身份展示完整达标
- 用户端结果域完整闭环（奖品Tab无真实数据）
- A 系统桥接闭环
- 生产级运营闭环

---

### 阶段二启动约束

**禁止**基于旧菜单、旧入口、旧页面继续扩展开发。
**必须**以阶段一整改后的结构为唯一正式基线继续推进。

---

## 阶段二执行记录（T101–T106）

### 验收性质

**结构与口径收敛推进 · 阶段二完成**

---

### T101：lineUser store 添加 identityTag + depositPaid 字段

- `store/lineUser.ts` 新增 `IdentityTag = 'fan' | 'user' | 'member'`
- `LineUserProfile` 新增 `identityTag?` 和 `depositPaid?` 字段
- mock 默认值：`identityTag: 'user'`，`depositPaid: false`

### T102：MinePage 顶部身份标签独立展示（与等级分离）

- 身份标签（粉丝/用户/会员）独立 badge 显示，图标 ⭐👤💎 对应三层
- 等级信息（Gold Level）另一个 badge 独立显示
- 两者不再混用，口径：粉丝=已关注OA / 用户=已进入业务链路 / 会员=已缴押金
- mockProfile.memberLevel 文案从"黄金会员"改为"黄金等级"（等级不等于身份）

### T103：URL 深链参数 `/mine?tab=...` 支持

- 使用 `useSearchParams` 读取 `tab` 参数，初始化 mainTab
- 四按钮点击更新 URL 参数（replace 模式）
- 参数映射：prizes→prize，benefits→benefit，orders→order，member→member
- 截图验证：`/mine?tab=prizes` → Prizes tab；`/mine?tab=member` → Membership tab

### T104：旧页面入口收口（方式A：重定向）

- `App.tsx` 移除 `MyCouponsPage` / `MyPointsPage` lazy import
- `/my-coupons` → `<Navigate to="/mine?tab=benefits" replace />`
- `/my-points` → `<Navigate to="/mine?tab=member" replace />`
- 截图验证：两个旧 URL 均自动跳转到对应 tab

### T105：会员 tab 整改（身份状态 + 押金状态区）

- Membership tab 顶部新增身份状态卡（双格：身份层级 | 押金状态）
- 身份层级：显示 identityTag 及其描述（已关注OA/已进入业务链路/已缴押金）
- 押金状态：depositPaid 控制显示"已缴纳/未缴纳"，颜色区分
- 积分成长内容保留在下方，标题加"成长积分"说明

### T106：游戏页面"我的奖品"跳转精准落点

- `LuckyWheelPage` / `ScratchCardPage` / `ThaiFortuneDrawPage` 三个游戏页面
- "我的奖品"按钮从 `nav('/my-coupons')` 改为 `nav('/mine?tab=prizes')`
- 精准落到 Prizes tab，不再经过旧路由

---

### 阶段二已达到

- ✅ MinePage 顶部身份标签结构达标（身份/等级分离）
- ✅ 四结果域（奖品/权益/订单/会员）承接关系清晰
- ✅ 旧入口风险收口（/my-coupons + /my-points 已重定向）
- ✅ `/mine?tab=...` 深链完整生效（prizes/benefits/orders/member）
- ✅ 会员页包含身份状态 + 押金状态区域（不只是积分）
- ✅ 游戏结果跳转精准落到奖品 tab

### 阶段二尚未达到（留待后续阶段）

- ❌ LINE 真实登录链路 profile 数据（identityTag 真实值）
- ❌ 奖品 tab 真实发放记录（当前空状态占位）
- ❌ 押金状态真实数据（depositPaid 当前 mock=false）
- ❌ A 系统真实借电订单桥接
- ❌ 积分/成长数据真实 API 闭环

---

## 阶段三执行记录（T201–T2xx）

### 验收性质

**关键数据链路真实化 · 阶段三完成**

---

### T201：后端新增四条用户端真实接口

新建文件：`backend/src/routes/user-profile.js`

**接口一：GET /api/user/profile**
- 数据来源：`points-accounts.json` + `user-products.json`
- 返回：`identity_tag`（系统规则推断）、`deposit_paid`、`member_level`、`coupon_count`、积分余额
- identityTag 规则：depositPaid=true → member；account 不存在 → fan；account 存在无押金 → user
- depositPaid：阶段三本系统内字段，阶段四接 A 系统

**接口二：GET /api/user/prizes**
- 数据来源：`activity-interactions.json`（filter: result_type = 'prize'）
- 关联：`activity-prizes.json`（奖品名）、`digital-products.json`（产品名）
- 返回：interaction_id、prize_name、prize_type、product_name、created_at

**接口三：GET /api/user/benefits**
- 数据来源：`user-products.json`
- 状态映射：claimed→available / used→used / expired→expired
- 支持 status 过滤参数

**接口四：GET /api/user/orders**
- 当前返回：真实空列表 + data_note（明确说明：借电订单待阶段四 A 系统桥接）

### T202：index.js 注册四条路由

路由前缀统一为 `/api/user/...`，与 api-server 代理链路一致（frontend → /api → port 8080 → port 3100 /api/...）

### T203：前端 API 方法追加

`src/api/growth.ts` 追加：
- `getUserProfile(params)` → `/user/profile`
- `getUserPrizes(params)` → `/user/prizes`
- `getUserBenefits(params)` → `/user/benefits`
- `getUserOrders(params)` → `/user/orders`

### T204：MinePage 全面真实化

**移除**：`couponList`（4 条 mock 卡券）、`orderRecords`（3 条 mock 订单）、`pointsLedger/exchangeRecords/earnRecords`（mock 流水）

**新增**：
- `serverProfile` state：加载 `/api/user/profile`
- `prizeItems/prizeLoading`：加载 `/api/user/prizes`（mainTab=prize 时触发）
- `benefitItems/benefitLoading`：加载 `/api/user/benefits`（mainTab=benefit 且 couponSub 变化时触发）
- `orderItems/orderLoading/orderDataNote`：加载 `/api/user/orders`（mainTab=order 时触发）

**字段来源统一**：
- `lineDisplayName`：serverProfile.line_display_name → profile.lineDisplayName → fallback
- `identityTag`：serverProfile.identity_tag → profile.identityTag → 'user'
- `depositPaid`：serverProfile.deposit_paid → profile.depositPaid → false
- `memberLevel`：serverProfile.member_level 映射三语

---

### 阶段三验证结论

**验证方式**：真实运行 + 截图验证（4 个 tab）

| 验证项 | 结果 | 说明 |
|-------|------|------|
| MinePage 顶部身份标签 | ✅ 真实接口推断 | 从 'user'(mock) 变为 'fan'(真实)，规则推断生效 |
| MinePage 顶部等级 | ✅ 真实字段 | `member_level: 'standard'` → 'Standard Level' |
| 奖品 tab | ✅ 真实接口空状态 | 来源标注：活动互动记录（真实接口） |
| 权益 tab | ✅ 真实接口空状态 | 来源标注：用户权益记录（真实接口） |
| 订单 tab | ✅ 真实接口空列表 | 明确说明待阶段四 A 系统桥接 |
| 会员 tab 身份状态 | ✅ 真实接口 | Fan + 未缴纳押金，来源标注 |
| 会员 tab 押金状态 | ✅ 真实结构 | 阶段三 false；标注阶段四接 A 系统 |
| 四结果域 mock 数据清除 | ✅ 已清除 | couponList/orderRecords 已全部移除 |
| 页面无白屏 | ✅ 正常 | 四个 tab 均可访问 |
| 旧路由收口 | ✅ 保持 | /my-coupons /my-points 重定向不受影响 |
| 阶段一/二成果保护 | ✅ 未破坏 | MinePage 四按钮体系、身份标签分离、深链均保持 |

---

### 阶段三已达到

- ✅ MinePage 顶部身份标签开始来自真实接口规则推断
- ✅ 奖品结果域接入真实接口（活动互动记录）
- ✅ 权益结果域接入真实接口（用户产品记录）
- ✅ 订单结果域明确承接边界（真实空列表 + 说明）
- ✅ 会员结果域身份/押金状态来自真实接口
- ✅ 前后端字段口径初步统一（identity_tag / deposit_paid / member_level）
- ✅ 四结果域 mock 数据全部清除
- ✅ 项目可运行，无新增白屏或死链

### 阶段三尚未达到（留待阶段四）

- ❌ LINE 真实 LIFF 登录（lineDisplayName/linePictureUrl 仍为 fallback）
- ❌ A 系统押金状态真实桥接（depositPaid 当前本系统内字段，阶段三内含 mock）
- ❌ 借电订单真实回流（A 系统数据，阶段四桥接）
- ❌ 奖励领取后 user-products 自动写入并实时同步（目前权益需人工触发写入才可见）

---

## 三语录入方案整改记录（新任务 · 来自文档扫描）

### 整改背景

用户文档明确规定三语录入方式：
- **正确方案**：单语输入（默认 zh，可切换） + AI 自动翻译按钮 + 其他语言折叠预览区（可手动微调）
- **禁止方案**：三个等权 tab 并排强制逐项手填

### 扫描发现的问题

1. `MultiLangInput` 组件（根源）：三个 tab（中文/ไทย/EN）等权并排，UI 隐含"三语都要手填"的错误意图
2. `AgentConfigManage`：欢迎语和提示词用手工三 tab TextArea，未使用 MultiLangInput
3. `MessageManage`：消息内容用三个独立 Form.Item（content_zh/content_th/content_en）
4. `Login.tsx`：i18n key 前缀错误，用 `admin.login.xxx`，应为 `login.xxx`
5. 三个模板页（ActivityTemplate/ProductTemplate/LandingTemplate）：已使用 MultiLangInput，但组件本身设计错误

### 整改结果

| 文件 | 整改内容 | 状态 |
|------|---------|------|
| `components/MultiLangInput.tsx` | **完全重写**：单语输入+语言选择器+AI翻译按钮+折叠预览其他语言 | ✅ |
| `features/growth/AgentConfigManage.tsx` | 欢迎语/提示词改为 MultiLangInput，去除手工三 tab | ✅ |
| `features/growth/MessageManage.tsx` | content_zh/th/en 三独立字段合并为 content MultiLangInput | ✅ |
| `pages/Login.tsx` | 修正 i18n key 前缀 `admin.login.` → `login.` | ✅ |
| `i18n/index.tsx` | 三语 admin.message 节点新增 formContent/formContentRequired key | ✅ |
| 三个模板页 | 已使用 MultiLangInput，随组件修复自动得到正确 UX | ✅ |

### 新 MultiLangInput 设计

```
[语言选择器 ▼]  [主语言输入框...]
[AI 自动翻译 ▶] [查看/编辑其他语言 ▼]
--- 折叠展开区 ---
  ไทย: [可编辑预览，翻译后自动填入]
  EN:  [可编辑预览，翻译后自动填入]
```

- 不再强制三语都填
- 翻译后其他语言可手动微调
- `AutoTranslateButton`（批量翻译所有字段）继续保留在模板页作为一键翻译入口

### `admin.activity.*` i18n 节点修复（90+ key，三语言）

**问题背景**：误将 zh/th/en 三语言 `activity:` 块插入到错误父节点内（zh:growthReport、th/en:adminTemplate），导致路径为 `growthReport.activity` / `adminTemplate.activity` 而非 `admin.activity`。

**修复方案**：用 Node.js 脚本精准删除三处误放块（按行号从下到上操作），再正确插入到各语言 `admin:` 节点内部（位于 `productDetail:` 之前）：

| 语言 | `activity:` 起始行 | `activity:` 结束行 | `admin:` 关闭行 | 后续节点 |
|------|-----------------|-------------------|----------------|---------|
| zh | 649 | 792 | 793 | productDetail (794) |
| th | 2635 | 2778 | 2779 | productDetail (2780) |
| en | 4607 | 4750 | 4751 | productDetail (4752) |

**验收结果**：Vite 编译无 `activity` 重复 key 警告；`admin.activity.cardOverview` 三语言均可正确查找。

### 动态内容 pickLocalizedText 统一（三个模板页 + MessageManage）

**问题**：三个模板页 `displayTitle` 函数和 MessageManage 内容列固定取 `v.zh`，不随 UI 语言切换。

**修复**：`v?.[language] || v?.zh || v?.th || v?.en || ''`，优先取当前语言。

涉及文件：
- `features/growth/ActivityTemplateManage.tsx`
- `features/growth/LandingTemplateManage.tsx`
- `features/growth/ProductTemplateManage.tsx`
- `features/growth/MessageManage.tsx`（同时补充 `language` 解构）

---

### `artifacts/cityone-growth-backend` (`@workspace/cityone-growth-backend`)

空白 Node.js Express 后端应用，用于 CityOne Growth 业务逻辑。

- Entry: `src/index.ts` — 读取 `PORT`，启动 Express
- App setup: `src/app.ts` — 配置 CORS、JSON 解析、路由（前缀 `/cityone`）
- Routes: `src/routes/index.ts` 挂载子路由；`src/routes/health.ts` 提供健康检查 `GET /cityone/healthz`
- 工作流: `CityOne Growth Backend`（端口 3001）
- `pnpm --filter @workspace/cityone-growth-backend run dev` — 启动开发服务器

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### ActivityManage 多语化完整重构（2026-04）

| 改动 | 文件 | 状态 |
|------|------|------|
| 表单 `name`/`subTitle` 字段替换为 `MultiLangInput` | ActivityManage.tsx | ✅ |
| 表单内容区所有 TextArea 替换为 `MultiLangInput textarea` | ActivityManage.tsx | ✅ |
| 内容区新增 `AutoTranslateButton`（一键翻译所有字段到 th/en） | ActivityManage.tsx | ✅ |
| `handleFormOk` 用 `ensureML()` 确保所有字段发送 `{zh,th,en}` 对象 | ActivityManage.tsx | ✅ |
| 表格 name 列安全处理 `activity_name` 为对象的情况 | ActivityManage.tsx | ✅ |
| 后端 `handleActivityCreate` 支持 `activity_name` 为 `{zh,th,en}` 对象 | activities.js | ✅ |
| `ActivityUserPage` 从 mock 数据切换为真实 API (`/growth/activities/:id`) | ActivityUserPage.tsx | ✅ |
| `ActivityUserPage` 新增加载态 + 404 容错 + `requireFollow` 真实字段驱动 | ActivityUserPage.tsx | ✅ |
| `WelfareHomePage` `toML()` 辅助函数处理多语对象型 activity_name | WelfareHomePage.tsx | ✅ |
| `detail.joinActivity` 翻译 key 补充三语 | i18n/index.tsx | ✅ |
| activities.json 恢复 act_001/act_002 示例数据（多语格式） | data/activities.json | ✅ |

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
