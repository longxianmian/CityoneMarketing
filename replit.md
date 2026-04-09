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
- **Remaining (JSON-backed)**: auth/admins, activities, entries, landing, banners, stations, members, accounts, game-programs, agent-*, messages, biz-* (~35+ files still JSON-backed, awaiting second batch migration).

**UI/UX Decisions:**
- **AdminLayout:** Features 6 main menu groups (Growth Overview, Welfare Center, Entry & Distribution, Incentive & Attribution, AI Agent, System Configuration).
- **MinePage:** Implements a four-button structure (Prizes, Benefits, Orders, Membership) with deep linking support (`/mine?tab=...`). Identity tags (fan/user/member) and membership levels are displayed distinctly.
- **Multi-language Input:** The `MultiLangInput` component has been refactored to support single-language input with a language selector, AI translation button, and foldable preview for other languages, ensuring adherence to the multi-language specification. Dynamic content uses `pickLocalizedText` for display based on the current UI language.

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