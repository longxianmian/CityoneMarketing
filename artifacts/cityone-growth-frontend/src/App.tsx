import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import useAuthStore from './store/auth'
import AdminLayout from './layout/AdminLayout'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))

const WelfareHomePage = lazy(() => import('./pages/user/WelfareHomePage'))
const NearbyPage = lazy(() => import('./pages/user/NearbyPage'))
const AgentPage = lazy(() => import('./pages/user/AgentPage'))
const AgentChatPage = lazy(() => import('./pages/user/AgentChatPage'))
const MinePage = lazy(() => import('./pages/user/MinePage'))
const ActivityUserPage = lazy(() => import('./pages/user/ActivityUserPage'))
const ActivityDetailPage = lazy(() => import('./pages/user/ActivityDetailPage'))
const CouponUserPage = lazy(() => import('./pages/user/CouponUserPage'))
const MyCouponsPage = lazy(() => import('./pages/user/MyCouponsPage'))
const MyPointsPage = lazy(() => import('./pages/user/MyPointsPage'))
const RedeemUserPage = lazy(() => import('./pages/user/RedeemUserPage'))
const ProductDetailPage = lazy(() => import('./pages/user/ProductDetailPage'))
const SystemDescPage = lazy(() => import('./pages/user/SystemDescPage'))
const UserAgreementPage = lazy(() => import('./pages/user/UserAgreementPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/user/PrivacyPolicyPage'))
const AboutUsPage = lazy(() => import('./pages/user/AboutUsPage'))
const LandingTemplatePage = lazy(() => import('./pages/user/LandingTemplatePage'))
const LuckyWheelPage = lazy(() => import('./pages/user/LuckyWheelPage'))
const ScratchCardPage = lazy(() => import('./pages/user/ScratchCardPage'))
const ThaiFortuneDrawPage = lazy(() => import('./pages/user/ThaiFortuneDrawPage'))

const PointsAccounts = lazy(() => import('./features/growth/PointsAccounts'))
const ShareRelations = lazy(() => import('./features/growth/ShareRelations'))
const ConsumeRelations = lazy(() => import('./features/growth/ConsumeRelations'))
const AttributionCenter = lazy(() => import('./features/growth/AttributionCenter'))
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
const AgentConfigManage = lazy(() => import('./features/growth/AgentConfigManage'))
const AgentIntentManage = lazy(() => import('./features/growth/AgentIntentManage'))
const AgentToolManage = lazy(() => import('./features/growth/AgentToolManage'))
const AgentLogManage = lazy(() => import('./features/growth/AgentLogManage'))
const AgentMetrics = lazy(() => import('./features/growth/AgentMetrics'))
const PrizePoolManage = lazy(() => import('./features/growth/PrizePoolManage'))
const FortuneSignManage = lazy(() => import('./features/growth/FortuneSignManage'))
const InteractionRecords = lazy(() => import('./features/growth/InteractionRecords'))
const UserChancesManage = lazy(() => import('./features/growth/UserChancesManage'))
const LandingTemplateManage = lazy(() => import('./features/growth/LandingTemplateManage'))
const ActivityTemplateManage = lazy(() => import('./features/growth/ActivityTemplateManage'))
const ProductTemplateManage = lazy(() => import('./features/growth/ProductTemplateManage'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
    <Spin size="large" />
  </div>
)

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* 用户端真实路由 */}
        <Route path="/welfare" element={<WelfareHomePage />} />
        <Route path="/nearby" element={<NearbyPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/agent/chat" element={<AgentChatPage />} />
        <Route path="/mine" element={<MinePage />} />
        <Route path="/activity/wheel/:id" element={<LuckyWheelPage />} />
        <Route path="/activity/scratch/:id" element={<ScratchCardPage />} />
        <Route path="/activity/fortune/:id" element={<ThaiFortuneDrawPage />} />
        <Route path="/activity/:id" element={<ActivityDetailPage />} />
        <Route path="/coupon/:id" element={<CouponUserPage />} />
        <Route path="/my-coupons" element={<MyCouponsPage />} />
        <Route path="/my-points" element={<MyPointsPage />} />
        <Route path="/redeem/:id" element={<ProductDetailPage />} />
        <Route path="/landing/:id" element={<LandingTemplatePage />} />
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

          <Route path="growth/attribution" element={<AttributionCenter />} />
          <Route path="growth/traffic" element={<Navigate to="/admin/growth/attribution?tab=traffic" replace />} />
          <Route path="growth/source" element={<Navigate to="/admin/growth/attribution?tab=source" replace />} />

          <Route path="growth/coupon" element={<CouponManage />} />
          <Route path="growth/activity" element={<ActivityManage />} />
          <Route path="growth/points/rules" element={<PointsRuleConfig />} />
          <Route path="growth/points/ledger" element={<PointsLedger />} />
          <Route path="growth/points/mall" element={<PointsMallManage />} />
          <Route path="growth/points/accounts" element={<PointsAccounts />} />
          <Route path="growth/points/share-relations" element={<ShareRelations />} />
          <Route path="growth/points/consume-relations" element={<ConsumeRelations />} />
          <Route path="growth/invite" element={<InviteManage />} />
          <Route path="growth/message" element={<MessageManage />} />
          <Route path="growth/risk" element={<RiskRuleManage />} />
          <Route path="growth/report" element={<GrowthReport />} />
          <Route path="growth/line-config" element={<LineConfig />} />
          <Route path="growth/agent/config" element={<AgentConfigManage />} />
          <Route path="growth/agent/intents" element={<AgentIntentManage />} />
          <Route path="growth/agent/tools" element={<AgentToolManage />} />
          <Route path="growth/agent/logs" element={<AgentLogManage />} />
          <Route path="growth/agent/metrics" element={<AgentMetrics />} />
          <Route path="growth/prize-pool" element={<PrizePoolManage />} />
          <Route path="growth/fortune-sign" element={<FortuneSignManage />} />
          <Route path="growth/interaction-records" element={<InteractionRecords />} />
          <Route path="growth/user-chances" element={<UserChancesManage />} />
          <Route path="growth/landing-templates" element={<LandingTemplateManage />} />
          <Route path="growth/activity-templates" element={<ActivityTemplateManage />} />
          <Route path="growth/product-templates" element={<ProductTemplateManage />} />
          <Route path="growth/entry-center" element={<EntryCenter />} />
          <Route path="growth/route-center" element={<RouteCenter />} />

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
  )
}
