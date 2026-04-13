### Overview

This is a pnpm workspace monorepo utilizing TypeScript, designed for the CityOne Growth project. It includes an Express API server, a Node.js Express backend application for CityOne Growth business logic, and shared libraries for API specifications, client-side React hooks, Zod schemas, and Drizzle ORM database interactions. The project aims to provide a robust, scalable platform for growth-related features, including an Admin and User-facing portal, gamification, and an AI Agent framework.

The business vision is to create a comprehensive growth engagement platform that can handle multi-language content, intricate user journeys, and integrate with external systems like LINE for enhanced user interaction. The project seeks to unify terminology and streamline user experience across different modules, from administrative management to end-user facing features like the MinePage and various gamified activities.

### User Preferences

I prefer iterative development and clear communication. Please ask before making major architectural changes or introducing new dependencies. For any frontend module development, always adhere to the CityOne multi-language development specification, prioritizing `t('module.key')` for static UI text and `pickLocalizedText` for dynamic content. Avoid hardcoding strings directly in the UI. For backend development, ensure all new routes follow the specified architecture, including proper proxying and body parsing rules. All modifications to proxy, routes, or middleware must pass the health check with 0 failures before submission. I prefer detailed explanations for complex technical decisions.

### System Architecture

The project is structured as a pnpm workspace monorepo, with distinct `artifacts` for deployable applications (e.g., `api-server`, `cityone-growth-backend`) and `lib` for shared libraries.

**Core Technologies:**
- **Monorepo Tool:** pnpm workspaces
- **Node.js:** v24
- **TypeScript:** v5.9
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild (CJS bundle)

**Monorepo Structure:**
- `artifacts/`: Deployable applications (e.g., `api-server`, `cityone-growth-backend`)
- `lib/`: Shared libraries (`api-spec`, `api-client-react`, `api-zod`, `db`)
- `scripts/`: Utility scripts

**TypeScript Configuration:**
- All packages extend a base `tsconfig.base.json` with `composite: true`.
- Root `tsconfig.json` lists all packages as project references for correct cross-package import resolution and build order.
- Typechecking is performed from the root (`pnpm run typecheck`) and emits only `.d.ts` files; actual JS bundling is handled by esbuild/tsx/vite.

**API Server (`@workspace/api-server`):**
- Express 5 API server.
- Uses `@workspace/api-zod` for request/response validation and `@workspace/db` for persistence.
- Routes are mounted at `/api`.

**CityOne Growth Backend (`@workspace/cityone-growth-backend`):**
- Node.js Express application for CityOne Growth business logic (port 3100).
- Routes are prefixed with `/api/growth/` (not `/cityone`).
- Includes health check endpoint `GET /health`.
- **Database**: Uses PostgreSQL (Replit built-in `heliumdb` for dev; Alibaba Cloud RDS `pgm-t4n5aixu9y1rrpvk.pgsql.singapore.rds.aliyuncs.com` for production). No code change needed — just set `DATABASE_URL` env var.
- **DB Pool**: `backend/src/db/pool.js` — connection pool, `DATABASE_URL`-first fallback to `DB_HOST/PORT/NAME/USER/PASSWORD`.
- **Migrations**: `backend/src/db/migrate.js` runs automatically on startup; migration files in `backend/src/db/migrations/`.
- **Migration 001**: `001_core_business.sql` — 10 core tables: `coupons`, `user_coupons`, `mall_items`, `points_accounts`, `points_ledger`, `mall_redeems`, `share_relations`, `consume_relations`, `points_rules`, `media_assets`, `activities`, `activity_participations`.
- **Migrated Routes**: `coupons.js`, `mall-items.js`, `growth-points.js` — fully async PostgreSQL with `withTransaction` for atomic ops (redeem, adjust, claim).
- **Historical Seed**: `scripts/seed-from-json.js` migrated all 10 JSON datasets into PostgreSQL.
- **JSONB Pattern**: All JSONB column values MUST use `JSON.stringify(v)` — bare strings fail PostgreSQL JSONB type.
- **Transaction Pattern**: `withTransaction(async (client) => {...})` for multi-table atomic ops; `query(sql, params)` for reads.
- **Batch 2 Part 1 (Done)**: auth/admins, accounts (admin operators), members (customers) — fully migrated to PostgreSQL.
  - `admins` table: 3 admins seeded (super_admin, admin, growth_content operator); bcrypt passwords preserved
  - `member_config` table: charging_discount + deposit config seeded from JSON
  - `role_templates` table: 4 templates seeded (growth_content, growth_data, ops_activity, ops_data)
  - `points_accounts` extended with member columns: deposit_paid, deposit_amount, has_used_charging, source, source_hint, line_display_name, member_level, tags
  - Login chain: `POST /api/admin/login` → bcrypt verify → JWT sign → `last_login_at` updated in DB
- **Batch 2 Part 2 (Done)**: entries, activities, landing, banners — fully migrated to PostgreSQL.
  - `entry_templates` (3 seeded), `entry_instances` (3 seeded)
  - `landing_pages` (4 seeded, deduped from 6 JSON records), `creative_landing_bindings` (1 seeded)
  - `banners` (2 seeded), `activity_templates` (2 seeded)
  - `activities` table ALTER'd with 30+ business fields added; participations (3 seeded), product_bindings (1 seeded)
  - `handleActivityParticipate` rewired to PostgreSQL — writes `activity_participations`, `points_ledger`, `points_accounts` atomically
  - Main归因链路：entry → landing → banner → activity 全部字段落库
- **Remaining (JSON-backed)**: stations, game-programs, agent-*, messages, biz-* (~25+ files still JSON-backed, awaiting next batch).

**UI/UX Decisions:**
- **AdminLayout:** Features 6 main menu groups (Growth Overview, Welfare Center, Entry & Distribution, Incentive & Attribution, AI Agent, System Configuration).
- **MinePage:** Implements a four-button structure (Prizes, Benefits, Orders, Membership) with deep linking support (`/mine?tab=...`). Identity tags (fan/user/member) and membership levels are displayed distinctly.
- **Multi-language Input:** The `MultiLangInput` component has been refactored to support single-language input with a language selector, AI translation button, and foldable preview for other languages, ensuring adherence to the multi-language specification. Dynamic content uses `pickLocalizedText` for display based on the current UI language.
- **Physical vs Digital Coupons:** `item_type='physical'` coupons show a purple delivery info modal; `item_type='digital'` coupons show the teal scan-to-charge modal.
- **Banner SPA Navigation:** `handleBannerClick` in WelfareHomePage detects same-domain absolute URLs (e.g. `https://domain.com/coupon/xxx`) and routes them via React Router `navigate()` instead of `window.location.href`, eliminating full-page reloads on banner clicks.

**Client-Side Caching:**
- **TanStack Query:** `@tanstack/react-query` singleton QueryClient at `src/lib/queryClient.ts` (staleTime=5min, gcTime=10min, refetchOnWindowFocus=false). Wrapped in `QueryClientProvider` in `main.tsx`. Vite `dedupe: ['react','react-dom']` prevents monorepo multi-instance conflicts.
- **Activity Prefetch:** `src/cache/activityCache.ts` prefetches activity detail data when WelfareHomePage loads its activity list, so clicking an activity card renders instantly from cache.
- **useEffectiveUserId Hook:** `src/hooks/useEffectiveUserId.ts` — priority chain: `canonicalUserId > lineUserId > getDeviceUserId()`. Used in MinePage, FollowOAPage, and all user-identity-dependent pages.

**AI Agent「问问」新架构（向量召回 + dispatch_mode 分流）：**
- 架构路线：意图标签向量化 → pgvector 语义召回（当前：LLM 分类降级）→ dispatch_mode 分流 → 卡片输出
- dispatch_mode 共 5 种：`chat_only`（1次LLM无工具）/ `card_only`（1次LLM+前端INTENT_ACTION_CARDS）/ `tool_then_card`（直接调工具+1次LLM摘要）/ `tool_then_confirm`（返回confirm_action payload）/ `out_of_scope`（0次LLM）
- 核心文件：`agent-vector-service.js`（意图检索/LLM分类/种子）/ `agent-llm-pipeline.js`（管道主入口）/ `agent-vector-service.js`
- 14条意图均配置 dispatch_mode/tool_name/card_template_key/similarity_threshold（见 `agent-intents.json`）
- pgvector：`wenwen_intent_labels` 表（1536维embedding，ivfflat索引），migration 015
- 管理端接口：`POST /api/agent-admin/seed-intent-vectors`（批量种子）/ `POST /api/agent-admin/recall-test`（召回测试）/ `GET /api/agent-admin/intent-labels`（列表）
- 当前降级策略：embedding 不可用时自动降级到 `recognizeIntentWithLLM`（已验证），dispatch_mode 路由仍全量生效
- 若需启用真正向量召回，设置 `OPENAI_API_KEY`（标准 OpenAI 端点支持 /embeddings），再调用 seed 接口
- 两层工具设计（参考阿里店小蜜 / OpenAI GPT Actions 方案），5 个工具：
  - **Layer 1 平台知识层（无状态）**：`search_platform_content` — 统一扫描 coupons.json / activities.json / mall-items.json，运营新增内容自动生效，零代码变更
  - **Layer 2 用户私有层（有状态）**：`get_user_account`（积分+钱包）、`query_nearby_stations`、`generate_invite_link`、`get_user_orders`
- 管道流程：关键词模板 → OUT_OF_SCOPE 快速拦截 → LLM function calling（5工具）→ 工具执行 → LLM摘要(max_tokens=256) → buildToolFallback兜底
- 超出范围（天气/打车/外卖等）：IN_SCOPE_RE 优先，OUT_OF_SCOPE_RE 兜底，~150ms 零 LLM 调用直接返回
- 前端超时 60s，5秒无回复插入"请稍等"提示消息
- 关键工具文件：`tool-platform-search.js`（平台内容）、`tool-user-account.js`（用户账户）

**API Architecture & Routing:**
- A three-layer proxy architecture: `Browser → Vite → api-server → growth-backend`.
- Specific proxying rules for different route types (e.g., `POST /api/upload` before body-parser, native `http.request` for `/uploads/*` and `/api/agent/*`).
- Backend routes are added to `backend/src/routes/*.js` and registered in `backend/src/index.js` with precise `method + pathname` mapping.

**Data Flow & States (MinePage):**
- Frontend fetches user profile (`/api/user/profile`), prizes (`/api/user/prizes`), benefits (`/api/user/benefits`), and orders (`/api/user/orders`) from dedicated backend endpoints.
- `identity_tag`, `deposit_paid`, and `member_level` are derived from backend responses.
- Mock data has been replaced with real API calls for key result domains.

### External Dependencies

- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Object-relational mapper for PostgreSQL.
- **Orval:** API client and Zod schema generator from OpenAPI specifications.
- **React Query:** For data fetching and state management in the frontend.
- **Express:** Web application framework for API servers.
- **Zod:** Schema declaration and validation library.
- **pnpm:** Package manager.
- **esbuild:** Bundler for JavaScript and TypeScript.
- **CORS:** Middleware for enabling Cross-Origin Resource Sharing.
- **LINE API:** (Future integration planned) For user authentication and profile data.