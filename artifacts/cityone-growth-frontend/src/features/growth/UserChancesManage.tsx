import React, { useEffect, useState } from 'react'
import { Card, Table, Input, Button, Space, Statistic, Row, Col, InputNumber, Modal, Form, message } from 'antd'
import { SearchOutlined, ReloadOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import request from '../../api/request'
import { useI18n } from '../../i18n'

export default function UserChancesManage() {
  const { t } = useI18n()
  const uc = (key: string) => t(`userChances.${key}`)

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
      message.success(uc('grantSuccess')); setGrantVisible(false); fetchData(1, pageSize)
    } catch {}
  }

  const statCards = [
    { key: 'userCount', title: uc('statUsers'), value: summary.userCount, suffix: uc('suffixPerson') },
    { key: 'totalGranted', title: uc('statGranted'), value: summary.totalGranted, suffix: uc('suffixTimes') },
    { key: 'totalUsed', title: uc('statUsed'), value: summary.totalUsed, suffix: uc('suffixTimes') },
    { key: 'totalRemain', title: uc('statRemain'), value: summary.totalRemain, suffix: uc('suffixTimes') },
  ]

  const columns = [
    { title: uc('colUserId'), dataIndex: 'userId', key: 'userId', width: 130 },
    { title: uc('colNickName'), dataIndex: 'nickName', key: 'nickName', width: 150 },
    { title: uc('colAvatar'), dataIndex: 'avatarUrl', key: 'avatarUrl', width: 60,
      render: (v: string) => v ? <img src={v} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%' }} /> : <UserOutlined /> },
    { title: uc('colGranted'), dataIndex: 'grantedChances', key: 'grantedChances', width: 100, render: (v: number) => <span style={{ color: '#1677ff' }}>{v}</span> },
    { title: uc('colUsed'), dataIndex: 'usedChances', key: 'usedChances', width: 100, render: (v: number) => <span style={{ color: '#ff4d4f' }}>{v}</span> },
    { title: uc('colRemain'), dataIndex: 'remainChances', key: 'remainChances', width: 100, render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 600 }}>{v}</span> },
    { title: uc('colFirstPlay'), dataIndex: 'firstPlayAt', key: 'firstPlayAt', width: 180 },
    { title: uc('colLastPlay'), dataIndex: 'lastPlayAt', key: 'lastPlayAt', width: 180 },
  ]

  return (
    <Card
      title={<Space><UserOutlined />{uc('pageTitle')}{activityId ? ` — #${activityId}` : ` (${uc('noActivity')})`}</Space>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData(1, pageSize)}>{uc('btnRefresh')}</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setGrantVisible(true)} disabled={!activityId}>{uc('btnGrant')}</Button>
        </Space>
      }
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {statCards.map(s => (
          <Col xs={12} sm={6} key={s.key}>
            <Card size="small" bordered style={{ textAlign: 'center' }}>
              <Statistic title={s.title} value={s.value} suffix={s.suffix} />
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={10}>
          <Input placeholder={uc('searchPlaceholder')} prefix={<SearchOutlined />} value={keyword}
            onChange={e => setKeyword(e.target.value)} onPressEnter={() => { setPage(1); fetchData(1, pageSize) }} allowClear />
        </Col>
        <Col>
          <Button type="primary" onClick={() => { setPage(1); fetchData(1, pageSize) }}>{uc('btnSearch')}</Button>
        </Col>
      </Row>
      <Table
        columns={columns} dataSource={data} rowKey="userId" loading={loading} size="small" scroll={{ x: 800 }}
        pagination={{
          current: page, pageSize, total, showSizeChanger: true,
          showTotal: total => uc('totalRows').replace('{n}', String(total)),
          onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps) },
        }}
      />
      <Modal title={uc('grantTitle')} open={grantVisible} onOk={handleGrant} onCancel={() => setGrantVisible(false)} destroyOnHidden>
        <Form form={grantForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="userId" label={uc('formUserId')}><Input placeholder={uc('formUserIdPlaceholder')} /></Form.Item>
          <Form.Item name="amount" label={uc('formAmount')} rules={[{ required: true }]}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label={uc('formRemark')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
