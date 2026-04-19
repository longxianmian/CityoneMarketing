import React from 'react'
import { ConfigProvider, App as AntdApp } from 'antd'
import { useI18n } from '../i18n'

export default function AntdShell({ children }: { children: React.ReactNode }) {
  const { antdLocale } = useI18n()

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
