import React from 'react'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import thTH from 'antd/locale/th_TH'
import { useI18n } from '../i18n'

export default function AntdShell({ children }: { children: React.ReactNode }) {
  const { language } = useI18n()
  const antdLocale = language === 'zh' ? zhCN : language === 'th' ? thTH : enUS

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        token: {
          colorPrimary: '#2CDBCE',
          borderRadius: 6,
        },
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  )
}
