import React, { useState, useEffect, useMemo } from 'react'
import { Layout, Menu, Drawer, Button, Dropdown, Avatar, theme } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  LogoutOutlined,
  SettingOutlined,
  RiseOutlined,
  TrophyOutlined,
  StarOutlined,
  ShareAltOutlined,
  MessageOutlined,
  SafetyOutlined,
  UserOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  GiftOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  GlobalOutlined,
  InteractionOutlined,
  LinkOutlined,
  FileTextOutlined,
  ShopOutlined,
  RobotOutlined,
  ToolOutlined,
  FileSearchOutlined,
  FundOutlined,
  OrderedListOutlined,
  CreditCardOutlined,
  TagsOutlined,
  BranchesOutlined,
  ThunderboltOutlined,
  ApiOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../store/auth'
import { useI18n, type AppLanguage } from '../i18n'

const { Header, Sider, Content } = Layout

function findOpenKeys(pathname: string, menuItems: any[]): string[] {
  const keys: string[] = []

  for (const item of menuItems) {
    if (!('children' in item) || !item.children) continue

    for (const child of item.children) {
      if ('children' in child && child.children) {
        for (const sub of child.children) {
          if ('children' in sub && sub.children) {
            for (const leaf of sub.children) {
              if (leaf.key === pathname) {
                keys.push(item.key, child.key, sub.key)
                return keys
              }
            }
          }

          if (sub.key === pathname) {
            keys.push(item.key, child.key)
            return keys
          }
        }
      }

      if (child.key === pathname) {
        keys.push(item.key)
        return keys
      }
    }
  }

  return keys
}

const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  zh: '中文',
  th: 'ไทย',
  en: 'English',
}

export default function AdminLayout() {
  const nav = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>([])
  const { userInfo, logout: authLogout } = useAuthStore()
  const { t, language, setLanguage } = useI18n()

  const lt = (key: string) => t(`admin.layout.${key}`)

  const menuItems = useMemo(
    () => [
      // === 1. 增长总览 ===
      {
        key: 'overview',
        icon: <DashboardOutlined />,
        label: lt('overviewGroup'),
        children: [
          { key: '/admin', label: lt('overviewBoard') },
          { key: '/admin/growth/attribution', label: lt('channelEffect') },
          { key: '/admin/growth/report', label: lt('activityEffect') },
          { key: '/admin/overview/funnel', label: lt('funnelConvert') },
          { key: '/admin/overview/order-attr', label: lt('orderAttrib') },
        ],
      },
      // === 2. 福利中心 ===
      {
        key: 'welfare',
        icon: <GiftOutlined />,
        label: lt('welfareGroup'),
        children: [
          {
            key: 'welfare-activity',
            icon: <TrophyOutlined />,
            label: lt('activityGroup'),
            children: [
              { key: '/admin/growth/activity', label: lt('activityInstances') },
              { key: '/admin/welfare/game', label: lt('gamePrograms') },
              { key: '/admin/growth/interaction-records', label: lt('interactiveResources') },
            ],
          },
          {
            key: 'welfare-coupon',
            icon: <CreditCardOutlined />,
            label: lt('couponGroup'),
            children: [
              { key: '/admin/growth/coupon', label: lt('couponItems') },
              { key: '/admin/growth/prize-pool', label: lt('prizePool') },
              { key: '/admin/welfare/coupon-stats', label: lt('couponStats') },
            ],
          },
          {
            key: 'welfare-benefit',
            icon: <TagsOutlined />,
            label: lt('benefitGroup'),
            children: [
              { key: '/admin/growth/points/mall', label: lt('benefitItems') },
              { key: '/admin/growth/fortune-sign', label: lt('fortuneSign') },
              { key: '/admin/welfare/redeem-stats', label: lt('redeemStats') },
            ],
          },
        ],
      },
      // === 3. 入口与分发 ===
      {
        key: 'entry',
        icon: <NodeIndexOutlined />,
        label: lt('entryDistrib'),
        children: [
          { key: '/admin/growth/landing-templates', label: lt('entryTemplates') },
          { key: '/admin/growth/entry-center', label: lt('entryCenter') },
          { key: '/admin/growth/route-center', label: lt('routeCenter') },
          { key: '/admin/entry/qrcode', label: lt('qrcodeAssets') },
          { key: '/admin/entry/oa-guide', label: lt('oaGuide') },
        ],
      },
      // === 4. 激励与归因 ===
      {
        key: 'incentive',
        icon: <RiseOutlined />,
        label: lt('incentiveAttrib'),
        children: [
          { key: '/admin/growth/points/rules', label: lt('pointsRules') },
          { key: '/admin/growth/points/accounts', label: lt('pointsAccounts') },
          { key: '/admin/growth/points/ledger', label: lt('pointsLedger') },
          { key: '/admin/growth/points/share-relations', label: lt('shareAttribution') },
          { key: '/admin/growth/points/consume-relations', label: lt('consumeAttribution') },
          { key: '/admin/growth/invite', label: lt('inviteFission') },
          { key: '/admin/incentive/reward-records', label: lt('rewardRecords') },
        ],
      },
      // === 5. AI Agent ===
      {
        key: 'ai-agent',
        icon: <RobotOutlined />,
        label: lt('aiAgent'),
        children: [
          { key: '/admin/agent/wenwen', label: lt('agentWenwen') },
          {
            key: 'agent-biz',
            label: lt('agentBizManage'),
            children: [
              { key: '/admin/agent/biz/commerce', label: lt('agentCommerce') },
              { key: '/admin/agent/biz/marketing', label: lt('agentMarketing') },
              { key: '/admin/agent/biz/ops', label: lt('agentOpsAgent') },
            ],
          },
          { key: '/admin/agent/sysops', label: lt('agentSysOps') },
          { key: '/admin/growth/agent/config', label: lt('agentConfig') },
          { key: '/admin/growth/agent/intents', label: lt('intentManage') },
          { key: '/admin/growth/agent/tools', label: lt('toolManage') },
          { key: '/admin/growth/agent/logs', label: lt('sessionLogs') },
          { key: '/admin/growth/agent/metrics', label: lt('metricsBoard') },
        ],
      },
      // === 6. 系统配置 ===
      {
        key: 'system-config',
        icon: <SettingOutlined />,
        label: lt('sysConfig'),
        children: [
          { key: '/admin/growth/line-config', label: lt('lineConfig') },
          { key: '/admin/system/i18n', label: lt('i18nConfig') },
          { key: '/admin/growth/risk', label: lt('riskRules') },
          { key: '/admin/growth/message', label: lt('messageReach') },
          { key: '/admin/system/params', label: lt('sysParams') },
        ],
      },
    ],
    [language]
  )

  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setDrawerOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    setOpenKeys(findOpenKeys(location.pathname, menuItems))
  }, [location.pathname, menuItems])

  const handleMenuClick = ({ key }: { key: string }) => {
    nav(key)
    if (isMobile) setDrawerOpen(false)
  }

  const handleLogout = () => {
    authLogout()
    nav('/admin/login', { replace: true })
  }

  const selectedKeys = useMemo(() => [location.pathname], [location.pathname])

  const siderMenu = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          padding: '0 12px',
        }}
      >
        <span
          style={{
            fontSize: collapsed && !isMobile ? 16 : 20,
            fontWeight: 700,
            color: '#1677ff',
            whiteSpace: 'nowrap',
          }}
        >
          {collapsed && !isMobile ? lt('sidebarCollapsed') : lt('sidebarTitle')}
        </span>
      </div>

      <Menu
        mode="inline"
        selectedKeys={selectedKeys}
        openKeys={collapsed && !isMobile ? [] : openKeys}
        onOpenChange={(keys) => setOpenKeys(keys as string[])}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ flex: 1, border: 0, overflowY: 'auto' }}
      />
    </div>
  )

  const userMenu = {
    items: [{ key: 'logout', icon: <LogoutOutlined />, label: lt('logout'), onClick: handleLogout }],
  }

  const languageMenu = {
    items: [
      { key: 'zh', label: '中文' },
      { key: 'th', label: 'ไทย' },
      { key: 'en', label: 'English' },
    ],
    onClick: ({ key }: { key: string }) => setLanguage(key as AppLanguage),
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={240}
          style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}
        >
          {siderMenu}
        </Sider>
      )}

      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={280}
          styles={{ body: { padding: 0 } }}
          closable={false}
        >
          {siderMenu}
        </Drawer>
      )}

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            height: 56,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Button
            type="text"
            icon={isMobile ? <MenuUnfoldOutlined /> : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => (isMobile ? setDrawerOpen(true) : setCollapsed(!collapsed))}
          />

          <div style={{ fontSize: 14, color: '#666' }}>{lt('adminTitle')}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Dropdown menu={languageMenu} placement="bottomRight" trigger={['click']}>
              <Button icon={<GlobalOutlined />}>{LANGUAGE_LABELS[language]}</Button>
            </Dropdown>

            <Dropdown menu={userMenu} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Avatar size={32} icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                {!isMobile && <span style={{ fontSize: 14 }}>{userInfo?.nickName || 'Admin'}</span>}
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ padding: isMobile ? 12 : 24, background: token.colorBgLayout }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
