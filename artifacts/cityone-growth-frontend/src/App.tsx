import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/auth'
import AdminLayout from './layout/AdminLayout'
import ErrorBoundary from './components/ErrorBoundary'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const WelfareEntryPage = lazy(() => import('./pages/user/WelfareEntryPage'))
const NearbyPage = lazy(() => import('./pages/user/NearbyPage'))
const AgentPage = lazy(() => import('./pages/user/AgentPage'))
const AgentChatPage = lazy(() => import('./pages/user/AgentChatPage'))
const MinePage = lazy(() => import('./pages/user/MinePage'))
const ActivityUserPage = lazy(() => import('./pages/user/ActivityUserPage'))
const ActivityDetailPage = lazy(() => import('./pages/user/ActivityDetailPage'))
const CouponUserPage = lazy(() => import('./pages/user/CouponUserPage'))
const BenefitUsePage = lazy(() => import('./pages/user/BenefitUsePage'))
const RedeemUserPage = lazy(() => import('./pages/user/RedeemUserPage'))
const ProductDetailPage = lazy(() => import('./pages/user/ProductDetailPage'))
const SystemDescPage = lazy(() => import('./pages/user/SystemDescPage'))
const UserAgreementPage = lazy(() => import('./pages/user/UserAgreementPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/user/PrivacyPolicyPage'))
const AboutUsPage = lazy(() => import('./pages/user/AboutUsPage'))
const LuckyWheelPage = lazy(() => import('./pages/user/LuckyWheelPage'))
const FollowOAPage = lazy(() => import('./pages/user/FollowOAPage'))
const ContinuePage = lazy(() => import('./pages/user/ContinuePage'))
const OpenInLinePage = lazy(() => import('./pages/user/OpenInLinePage'))
const FollowConfirmPage = lazy(() => import('./pages/user/FollowConfirmPage'))
const ScratchCardPage = lazy(() => import('./pages/user/ScratchCardPage'))
const ThaiFortuneDrawPage = lazy(() => import('./pages/user/ThaiFortuneDrawPage'))
const MyAddressPage = lazy(() => import('./pages/user/MyAddressPage'))

const PointsAccounts = lazy(() => import('./features/growth/PointsAccounts'))
const CouponManage = lazy(() => import('./features/growth/CouponManage'))
const PointsRuleConfig = lazy(() => import('./features/growth/PointsRuleConfig'))
const ActivityManage = lazy(() => import('./features/growth/ActivityManage'))
const InviteManage = lazy(() => import('./features/growth/InviteManage'))
const PointsLedger = lazy(() => import('./features/growth/PointsLedger'))
const MessageManage = lazy(() => import('./features/growth/MessageManage'))
const RiskRuleManage = lazy(() => import('./features/growth/RiskRuleManage'))
const PointsMallManage = lazy(() => import('./features/growth/PointsMallManage'))
const GrowthReport = lazy(() => import('./features/growth/GrowthReport'))
const LineConfig = lazy(() => import('./features/growth/LineConfig'))
const EntryCenter = lazy(() => import('./features/growth/EntryCenter'))
const RouteCenter = lazy(() => import('./features/growth/RouteCenter'))
const StationPromoPage = lazy(() => import('./features/growth/StationPromoPage'))
const CouponVerifyPage = lazy(() => import('./features/growth/CouponVerifyPage'))
const AgentConfigManage = lazy(() => import('./features/growth/AgentConfigManage'))
const AgentIntentManage = lazy(() => import('./features/growth/AgentIntentManage'))
const AgentIntentTester = lazy(() => import('./features/growth/AgentIntentTester'))
const AgentToolManage = lazy(() => import('./features/growth/AgentToolManage'))
const AgentLogManage = lazy(() => import('./features/growth/AgentLogManage'))
const AgentMetrics = lazy(() => import('./features/growth/AgentMetrics'))
const PrizePoolManage = lazy(() => import('./features/growth/PrizePoolManage'))
const InteractionRecords = lazy(() => import('./features/growth/InteractionRecords'))
const UserChancesManage = lazy(() => import('./features/growth/UserChancesManage'))
const CouponStatsPage = lazy(() => import('./features/growth/CouponStatsPage'))
const RedeemStatsPage = lazy(() => import('./features/growth/RedeemStatsPage'))
const BannerManage = lazy(() => import('./features/growth/BannerManage'))
const ProductTemplateManage = lazy(() => import('./features/growth/ProductTemplateManage'))
const GameProgram = lazy(() => import('./features/growth/GameProgram'))
const ComingSoon = lazy(() => import('./features/growth/ComingSoon'))
const StationManage = lazy(() => import('./features/growth/StationManage'))

const AttributionCenter = lazy(() => import('./features/growth/AttributionCenter'))

const AgentWenwenPage = lazy(() => import('./features/growth/AgentWenwenPage'))
const AgentReservedPage = lazy(() => import('./features/growth/AgentReservedPage'))
const AccountManage = lazy(() => import('./features/growth/AccountManage'))
const CustomerManage = lazy(() => import('./features/growth/CustomerManage'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const isLocalDevHost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  if (token === 'dev-bypass-token' && !isLocalDevHost) {
    logout()
    return <Navigate to="/admin/login" replace />
  }
  if (!token) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

const Loading = () => (
  <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f6ffed', padding: 24 }}>
    <div style={{ width: '100%', maxWidth: 360, textAlign: 'center', background: '#fff', borderRadius: 20, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)', padding: '28px 24px' }}>
      <div
        style={{
          width: 34,
          height: 34,
          margin: '0 auto',
          borderRadius: '50%',
          border: '3px solid rgba(44, 219, 206, 0.18)',
          borderTopColor: '#2cdbce',
          animation: 'boot-spin 0.8s linear infinite',
        }}
      />
      <div style={{ marginTop: 18, fontSize: 18, fontWeight: 700, color: '#172b24' }}>正在继续领取</div>
      <div style={{ marginTop: 10, color: '#666', lineHeight: 1.8 }}>系统正在确认 LINE 身份并自动完成后续步骤。</div>
    </div>
  </div>
)

function CS({ title, description }: { title: string; description?: string }) {
  return <ComingSoon title={title} description={description} />
}

export default function App() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* 用户端路由 */}
        <Route path="/welfare" element={<WelfareEntryPage />} />
        <Route path="/welfare/continue" element={<ContinuePage />} />
        <Route path="/welfare/open-in-line" element={<OpenInLinePage />} />
        <Route path="/welfare/follow-confirm" element={<FollowConfirmPage />} />
        <Route path="/continue" element={<Navigate to="/welfare/continue" replace />} />
        <Route path="/nearby" element={<NearbyPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/agent/chat" element={<AgentChatPage />} />
        <Route path="/mine" element={<MinePage />} />
        <Route path="/activity/wheel/:id" element={<LuckyWheelPage />} />
        <Route path="/activity/scratch/:id" element={<ScratchCardPage />} />
        <Route path="/activity/fortune/:id" element={<ThaiFortuneDrawPage />} />
        <Route path="/activity/:id" element={<ActivityDetailPage />} />
        <Route path="/coupon/:id" element={<CouponUserPage />} />
        <Route path="/benefit/use/:kind" element={<BenefitUsePage />} />
        <Route path="/my-coupons" element={<Navigate to="/mine?tab=benefits" replace />} />
        <Route path="/my-points" element={<Navigate to="/mine?tab=member" replace />} />
        <Route path="/my-addresses" element={<MyAddressPage />} />
        <Route path="/redeem/:id" element={<ProductDetailPage />} />
        <Route path="/follow-oa" element={<FollowOAPage />} />
        <Route path="/system-desc" element={<SystemDescPage />} />
        <Route path="/user-agreement" element={<UserAgreementPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/about-us" element={<AboutUsPage />} />

        {/* 后台登录 */}
        <Route path="/admin/login" element={<Login />} />

        {/* 后台主系统 */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />

          {/* 增长总览 */}
          <Route path="growth/attribution" element={<AttributionCenter />} />
          <Route path="growth/report" element={<GrowthReport />} />
          <Route path="overview/funnel" element={<CS title="转化漏斗" description="用户从入口到业务转化的全链路漏斗分析，阶段二实现" />} />
          <Route path="overview/order-attr" element={<CS title="订单归因" description="当前可先占位，阶段四对接 A 系统订单数据后实现" />} />

          {/* 福利中心 */}
          <Route path="growth/coupon" element={<CouponManage />} />
          <Route path="growth/activity" element={<ActivityManage />} />

          <Route path="growth/interaction-records" element={<InteractionRecords />} />
          <Route path="welfare/game" element={<GameProgram />} />
          <Route path="growth/prize-pool" element={<PrizePoolManage />} />
          <Route path="welfare/coupon-stats" element={<CouponStatsPage />} />
          <Route path="welfare/banners" element={<BannerManage />} />
          <Route path="growth/points/mall" element={<PointsMallManage />} />
          <Route path="welfare/redeem-stats" element={<RedeemStatsPage />} />
          <Route path="growth/product-templates" element={<ProductTemplateManage />} />

          {/* 卡券核销 */}
          <Route path="growth/coupon/verify" element={<CouponVerifyPage />} />

          {/* 站点管理 */}
          <Route path="growth/stations" element={<StationManage />} />
          <Route path="growth/station-benefits" element={<StationManage />} />

          {/* 入口与分发 */}
          <Route path="growth/station-promo" element={<StationPromoPage />} />
          <Route path="growth/entry-center" element={<EntryCenter />} />
          <Route path="growth/route-center" element={<RouteCenter />} />
          <Route path="entry/qrcode" element={<CS title="二维码资产" description="QR Code 批次管理与资产库，阶段二实现" />} />
          <Route path="entry/oa-guide" element={<CS title="OA 引导与入口测试" description="LINE OA 绑定引导配置与入口链路测试，阶段二实现" />} />

          {/* 积分管理 */}
          <Route path="growth/points/rules"    element={<PointsRuleConfig />} />
          <Route path="growth/points/accounts" element={<PointsAccounts />} />
          <Route path="growth/points/ledger"   element={<PointsLedger />} />
          <Route path="growth/invite"          element={<Navigate to="/admin/growth/points/rules" replace />} />

          {/* AI Agent */}
          <Route path="agent/wenwen" element={<AgentWenwenPage />} />
          <Route path="agent/biz" element={<AgentReservedPage />} />
          <Route path="agent/biz/commerce" element={<AgentReservedPage />} />
          <Route path="agent/biz/marketing" element={<AgentReservedPage />} />
          <Route path="agent/biz/ops" element={<AgentReservedPage />} />
          <Route path="agent/sysops" element={<AgentReservedPage />} />
          <Route path="growth/agent/config" element={<AgentConfigManage />} />
          <Route path="growth/agent/intents" element={<AgentIntentManage />} />
          <Route path="growth/agent/intent-tester" element={<AgentIntentTester />} />
          <Route path="growth/agent/tools" element={<AgentToolManage />} />
          <Route path="growth/agent/logs" element={<AgentLogManage />} />
          <Route path="growth/agent/metrics" element={<AgentMetrics />} />

          {/* 系统配置 */}
          <Route path="growth/line-config" element={<LineConfig />} />
          <Route path="system/i18n" element={<CS title="三语配置" description="界面三语文案管理，阶段五实现" />} />
          <Route path="growth/risk" element={<RiskRuleManage />} />
          <Route path="growth/message" element={<MessageManage />} />
          <Route path="system/params" element={<CS title="基础系统参数" description="系统全局参数配置，阶段二实现" />} />
          {/* 客户管理 */}
          <Route path="member/list" element={<CustomerManage />} />
          <Route path="member/benefits" element={<CustomerManage />} />
          {/* 系统管理员：操作员管理 */}
          <Route path="system/accounts" element={<AccountManage mode="my" />} />
          {/* 超管中心：全量账号管理（super_admin only，后端也鉴权）*/}
          <Route path="superadmin/accounts" element={<AccountManage mode="super" />} />

          {/* 旧路由兼容重定向 */}
          <Route path="device" element={<Navigate to="/admin/growth/activity" replace />} />
          <Route path="shop" element={<Navigate to="/admin/growth/activity" replace />} />
          <Route path="order" element={<Navigate to="/admin/growth/activity" replace />} />
          <Route path="user" element={<Navigate to="/admin/growth/activity" replace />} />
          <Route path="system" element={<Navigate to="/admin/growth/activity" replace />} />

          <Route path="*" element={<Navigate to="/admin/growth/activity" replace />} />
        </Route>

        <Route path="/" element={<Navigate to="/welfare" replace />} />
        <Route path="*" element={<Navigate to="/welfare" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}
