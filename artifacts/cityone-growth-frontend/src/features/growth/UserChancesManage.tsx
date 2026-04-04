import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Button, Space, Statistic, Row, Col, InputNumber, Modal, Form, message } from 'antd'
import { SearchOutlined, ReloadOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import request from '../../api/request'

export default function UserChancesManage() {
  const [searchParams] = useSearchParams()
  const activityId = searchParams.get('activityId')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [summary, setSummary] = useState({ totalGranted: 0, totalUsed: 0, totalRemain: 0, userCount: 0 })
  const [grantVisible, setGrantVisible] = useState(false)
  const [grantForm] = Form.useForm()

  const fetchData = async (p = page, ps = pageSize) => {
    if (!activityId) return
    setLoading(true)
    try {
      const params: any = { page: p, pageSize: ps }
      if (keyword) params.keyword = keyword
      const res: any = await request.get(`/api/activities/${activityId}/user-chances`, { params })
      setData(res.data?.list || [])
      setTotal(res.data?.total || 0)
      setSummary({
        totalGranted: res.data?.totalGranted || 0,
        totalUsed: res.data?.totalUsed || 0,
        totalRemain: res.data?.totalRemain || 0,
        userCount: res.data?.userCount || 0,
      })
    } catch { setData([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData(1, pageSize) }, [activityId])

  const handleGrant = async () => {
    try {
      const values = await grantForm.validateFields()
      await request.post(`/api/activities/${activityId}/user-chances/grant`, values)
      message.success('赠送成功'); setGrantVisible(false); fetchData(1, pageSize)
    } catch {}
  }

  const columns = [
    { title: '用户ID', dataIndex: 'userId', key: 'userId', width: 130 },
    { title: '用户昵称', dataIndex: 'nickName', key: 'nickName', width: 150 },
    { title: '头像', dataIndex: 'avatarUrl', key: 'avatarUrl', width: 60,
      render: (v: string) => v ? <img src={v} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%' }} /> : <UserOutlined /> },
    { title: '赠送次数', dataIndex: 'grantedChances', key: 'grantedChances', width: 100,
      render: (v: number) => <span style={{ color: '#1677ff' }}>{v}</span> },
    { title: '已用次数', dataIndex: 'usedChances', key: 'usedChances', width: 100,
      render: (v: number) => <span style={{ color: '#ff4d4f' }}>{v}</span> },
    { title: '剩余次数', dataIndex: 'remainChances', key: 'remainChances', width: 100,
      render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 600 }}>{v}</span> },
    { title: '首次参与', dataIndex: 'firstPlayAt', key: 'firstPlayAt', width: 180 },
    { title: '最近参与', dataIndex: 'lastPlayAt', key: 'lastPlayAt', width: 180 },
  ]

  return (
    <Card
      title={<Space><UserOutlined />次数账户{activityId ? ` — 活动 #${activityId}` : '（请从活动列表进入）'}</Space>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData(1, pageSize)}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setGrantVisible(true)} disabled={!activityId}>赠送次数</Button>
        </Space>
      }
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { title: '参与用户', value: summary.userCount, suffix: '人' },
          { title: '总赠送次数', value: summary.totalGranted, suffix: '次' },
          { title: '总使用次数', value: summary.totalUsed, suffix: '次' },
          { title: '总剩余次数', value: summary.totalRemain, suffix: '次' },
        ].map(s => (
          <Col xs={12} sm={6} key={s.title}>
            <Card size="small" bordered style={{ textAlign: 'center' }}>
              <Statistic title={s.title} value={s.value} suffix={s.suffix} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={10}>
          <Input
            placeholder="搜索用户ID / 昵称"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={() => { setPage(1); fetchData(1, pageSize) }}
            allowClear
          />
        </Col>
        <Col>
          <Button type="primary" onClick={() => { setPage(1); fetchData(1, pageSize) }}>查询</Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="userId"
        loading={loading}
        size="small"
        scroll={{ x: 800 }}
        pagination={{
          current: page, pageSize, total,
          showSizeChanger: true,
          showTotal: t => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
        }}
      />

      <Modal
        title="批量赠送次数"
        open={grantVisible}
        onOk={handleGrant}
        onCancel={() => setGrantVisible(false)}
        destroyOnHidden
      >
        <Form form={grantForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="userId" label="用户ID（留空则赠送所有用户）">
            <Input placeholder="单个用户ID，留空则全部赠送" />
          </Form.Item>
          <Form.Item name="amount" label="赠送次数" rules={[{ required: true }]}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="如：运营活动特殊赠送" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
