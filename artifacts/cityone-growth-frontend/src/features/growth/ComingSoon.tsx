import React from 'react'
import { Card, Result } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'

interface Props {
  title: string
  description?: string
}

export default function ComingSoon({ title, description }: Props) {
  return (
    <Card>
      <Result
        icon={<ClockCircleOutlined style={{ color: '#1677ff' }} />}
        title={title}
        subTitle={description || '该功能正在开发中，将在后续版本上线'}
      />
    </Card>
  )
}
