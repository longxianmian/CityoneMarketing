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

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
