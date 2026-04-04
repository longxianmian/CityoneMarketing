import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Statistic, DatePicker, Button, Table, Tag, Select, Progress, Tabs, Input } from 'antd'
import {
  LineChartOutlined,
  EyeOutlined,
  LinkOutlined,
  HeartOutlined,
  UserOutlined,
  CrownOutlined,
  TeamOutlined,
  ApartmentOutlined,
  FundProjectionScreenOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

export default function GrowthReport() {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [department, setDepartment] = useState<string>('all')
  const [unitType, setUnitType] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<string>('promotion')
  const [operationSubTab, setOperationSubTab] = useState<string>('onsite')
  const [keyword, setKeyword] = useState<string>('')

  const promotionData = [
    {
      key: '1',
      unitType: '活动',
      unitName: '扫码抽奖赢免费时长',
      department: '互联网推广部',
      ownerDept: '互联网推广部',
      partnerDept: '--',
      goal: '拉新',
      reads: 18600,
      clicks: 6320,
      follows: 2110,
      clickRate: 33.98,
      followRate: 33.39,
    },
    {
      key: '2',
      unitType: '卡券',
      unitName: '关注 LINE 领 15 分钟券',
      department: '互联网推广部',
      ownerDept: '互联网推广部',
      partnerDept: '--',
      goal: '促关注',
      reads: 12100,
      clicks: 3880,
      follows: 1620,
      clickRate: 32.07,
      followRate: 41.75,
    },
    {
      key: '3',
      unitType: '活动',
      unitName: '节日海报活动页',
      department: '互联网推广部',
      ownerDept: '互联网推广部',
      partnerDept: '--',
      goal: '拉新',
      reads: 9200,
      clicks: 2710,
      follows: 980,
      clickRate: 29.46,
      followRate: 36.16,
    },
  ]

  const onsiteOperationData = [
    {
      key: '1',
      unitType: '活动',
      unitName: '站点首借免单',
      department: '运营部',
      ownerDept: '运营部',
      partnerDept: '--',
      goal: '转用户',
      follows: 1320,
      users: 860,
      members: 402,
      userRate: 65.15,
      memberRate: 46.74,
      totalMemberRate: 30.45,
    },
    {
      key: '2',
      unitType: '卡券',
      unitName: '30分钟免费时长券',
      department: '运营部',
      ownerDept: '运营部',
      partnerDept: '--',
      goal: '转会员',
      follows: 980,
      users: 622,
      members: 255,
      userRate: 63.47,
      memberRate: 40.99,
      totalMemberRate: 26.02,
    },
  ]

  const oaOperationData = [
    {
      key: '3',
      unitType: '活动',
      unitName: 'OA 唤醒返券活动',
      department: '运营部',
      ownerDept: '运营部',
      partnerDept: '--',
      goal: '召回',
      follows: 760,
      users: 438,
      members: 186,
      userRate: 57.63,
      memberRate: 42.47,
      totalMemberRate: 24.47,
    },
    {
      key: '4',
      unitType: '卡券',
      unitName: '沉睡用户唤醒券',
      department: '运营部',
      ownerDept: '运营部',
      partnerDept: '--',
      goal: '复购',
      follows: 540,
      users: 286,
      members: 119,
      userRate: 52.96,
      memberRate: 41.61,
      totalMemberRate: 22.04,
    },
  ]

  const jointData = [
    {
      key: '1',
      unitType: '活动',
      unitName: '线上引流 + 线下首借转会员',
      department: '联合活动',
      ownerDept: '互联网推广部',
      partnerDept: '运营部',
      goal: '联合转会员',
      follows: 1120,
      users: 760,
      members: 356,
      userRate: 67.86,
      memberRate: 46.84,
      totalMemberRate: 31.79,
    },
    {
      key: '2',
      unitType: '卡券',
      unitName: '线上领券 + 到站核销券',
      department: '联合活动',
      ownerDept: '互联网推广部',
      partnerDept: '运营部',
      goal: '联合转用户',
      follows: 860,
      users: 514,
      members: 228,
      userRate: 59.77,
      memberRate: 44.36,
      totalMemberRate: 26.51,
    },
  ]

  const filterRows = (rows: any[]) =>
    rows.filter((item) => {
      const okDept = department === 'all' || item.department === department
      const okType = unitType === 'all' || item.unitType === unitType
      const okKeyword = !keyword.trim() || item.unitName.includes(keyword.trim())
      return okDept && okType && okKeyword
    })

  const filteredPromotionData = useMemo(() => filterRows(promotionData), [department, unitType, keyword])
  const filteredOnsiteOperationData = useMemo(() => filterRows(onsiteOperationData), [department, unitType, keyword])
  const filteredOaOperationData = useMemo(() => filterRows(oaOperationData), [department, unitType, keyword])
  const filteredJointData = useMemo(() => filterRows(jointData), [department, unitType, keyword])

  const promotionColumns = [
    {
      title: '考核单元',
      dataIndex: 'unitName',
      key: 'unitName',
      render: (_: string, row: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.unitName}</div>
          <div style={{ marginTop: 4 }}>
            <Tag color="blue">{row.unitType}</Tag>
            <Tag>{row.department}</Tag>
          </div>
        </div>
      ),
    },
    { title: '活动目标', dataIndex: 'goal', key: 'goal', render: (v: string) => <Tag color="cyan">{v}</Tag> },
    { title: '主责部门', dataIndex: 'ownerDept', key: 'ownerDept' },
    { title: '协同部门', dataIndex: 'partnerDept', key: 'partnerDept' },
    { title: '阅读数', dataIndex: 'reads', key: 'reads' },
    { title: '点击数', dataIndex: 'clicks', key: 'clicks' },
    { title: '关注数', dataIndex: 'follows', key: 'follows' },
    {
      title: '点击转化率',
      dataIndex: 'clickRate',
      key: 'clickRate',
      render: (v: number) => <Tag color={v >= 30 ? 'green' : v >= 20 ? 'blue' : 'default'}>{v}%</Tag>,
    },
    {
      title: '关注转化率',
      dataIndex: 'followRate',
      key: 'followRate',
      render: (v: number) => <Tag color={v >= 35 ? 'green' : v >= 25 ? 'blue' : 'default'}>{v}%</Tag>,
    },
  ]

  const operationColumns = [
    {
      title: '考核单元',
      dataIndex: 'unitName',
      key: 'unitName',
      render: (_: string, row: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.unitName}</div>
          <div style={{ marginTop: 4 }}>
            <Tag color="purple">{row.unitType}</Tag>
            <Tag>{row.department}</Tag>
          </div>
        </div>
      ),
    },
    { title: '活动目标', dataIndex: 'goal', key: 'goal', render: (v: string) => <Tag color="gold">{v}</Tag> },
    { title: '主责部门', dataIndex: 'ownerDept', key: 'ownerDept' },
    { title: '协同部门', dataIndex: 'partnerDept', key: 'partnerDept' },
    { title: '关注数', dataIndex: 'follows', key: 'follows' },
    { title: '用户数', dataIndex: 'users', key: 'users' },
    { title: '会员数', dataIndex: 'members', key: 'members' },
    {
      title: '关注→用户转化率',
      dataIndex: 'userRate',
      key: 'userRate',
      render: (v: number) => <Tag color={v >= 60 ? 'green' : v >= 45 ? 'blue' : 'default'}>{v}%</Tag>,
    },
    {
      title: '用户→会员转化率',
      dataIndex: 'memberRate',
      key: 'memberRate',
      render: (v: number) => <Tag color={v >= 45 ? 'green' : v >= 30 ? 'blue' : 'default'}>{v}%</Tag>,
    },
    {
      title: '关注→会员总转化率',
      dataIndex: 'totalMemberRate',
      key: 'totalMemberRate',
      render: (v: number) => <Tag color={v >= 28 ? 'green' : v >= 20 ? 'blue' : 'default'}>{v}%</Tag>,
    },
  ]

  const currentTitle =
    activeTab === 'promotion'
      ? '推广数据分析'
      : activeTab === 'operation'
        ? '运营数据分析'
        : '联合活动数据分析'

  const renderPromotionPanel = () => {
    const totalReads = filteredPromotionData.reduce((sum, item) => sum + item.reads, 0)
    const totalClicks = filteredPromotionData.reduce((sum, item) => sum + item.clicks, 0)
    const totalFollows = filteredPromotionData.reduce((sum, item) => sum + item.follows, 0)
    const clickRate = totalReads ? Number(((totalClicks / totalReads) * 100).toFixed(2)) : 0
    const followRate = totalClicks ? Number(((totalFollows / totalClicks) * 100).toFixed(2)) : 0

    return (
      <>
        <Card title="推广数据总盘" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="总阅读数" value={totalReads} prefix={<EyeOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="总点击数" value={totalClicks} prefix={<LinkOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="总关注数" value={totalFollows} prefix={<HeartOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="点击转化率" value={clickRate} suffix="%" prefix={<LineChartOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="关注转化率" value={followRate} suffix="%" prefix={<FundProjectionScreenOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="考核单元数" value={filteredPromotionData.length} prefix={<ApartmentOutlined />} /></Card></Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12}>
              <Card size="small" title="推广链路">
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>阅读 → 点击</span>
                      <span>{clickRate}%</span>
                    </div>
                    <Progress percent={clickRate} showInfo={false} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>点击 → 关注</span>
                      <span>{followRate}%</span>
                    </div>
                    <Progress percent={followRate} showInfo={false} />
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title="说明">
                <div style={{ color: '#666', lineHeight: 1.9 }}>
                  推广数据主要服务互联网推广部。<br />
                  除总关注转化率外，其余考核按活动/卡券维度进行总结与复盘。
                </div>
              </Card>
            </Col>
          </Row>
        </Card>

        <Card title="推广数据明细">
          <Table rowKey="key" columns={promotionColumns} dataSource={filteredPromotionData} pagination={false} />
        </Card>
      </>
    )
  }

  const renderOperationBlock = (title: string, rows: any[], desc: string) => {
    const totalFollows = rows.reduce((sum, item) => sum + item.follows, 0)
    const totalUsers = rows.reduce((sum, item) => sum + item.users, 0)
    const totalMembers = rows.reduce((sum, item) => sum + item.members, 0)
    const userRate = totalFollows ? Number(((totalUsers / totalFollows) * 100).toFixed(2)) : 0
    const memberRate = totalUsers ? Number(((totalMembers / totalUsers) * 100).toFixed(2)) : 0
    const totalMemberRate = totalFollows ? Number(((totalMembers / totalFollows) * 100).toFixed(2)) : 0

    return (
      <>
        <Card title={`${title}总盘`} style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="总关注数" value={totalFollows} prefix={<HeartOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="总用户数" value={totalUsers} prefix={<UserOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="总会员数" value={totalMembers} prefix={<CrownOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="关注→用户转化率" value={userRate} suffix="%" prefix={<LineChartOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="用户→会员转化率" value={memberRate} suffix="%" prefix={<FundProjectionScreenOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="关注→会员总转化率" value={totalMemberRate} suffix="%" prefix={<TeamOutlined />} /></Card></Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12}>
              <Card size="small" title={`${title}链路`}>
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>关注 → 用户</span>
                      <span>{userRate}%</span>
                    </div>
                    <Progress percent={userRate} showInfo={false} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>用户 → 会员</span>
                      <span>{memberRate}%</span>
                    </div>
                    <Progress percent={memberRate} showInfo={false} />
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title="说明">
                <div style={{ color: '#666', lineHeight: 1.9 }}>{desc}</div>
              </Card>
            </Col>
          </Row>
        </Card>

        <Card title={`${title}明细`}>
          <Table rowKey="key" columns={operationColumns} dataSource={rows} pagination={false} />
        </Card>
      </>
    )
  }

  const renderOperationPanel = () => {
    return (
      <Tabs
        activeKey={operationSubTab}
        onChange={setOperationSubTab}
        items={[
          {
            key: 'onsite',
            label: '现场转化',
            children: renderOperationBlock(
              '现场转化',
              filteredOnsiteOperationData,
              '现场转化主要服务运营部的站点现场推广，重点看关注后的借电使用与会员沉淀。'
            ),
          },
          {
            key: 'oa',
            label: 'OA运营',
            children: renderOperationBlock(
              'OA运营',
              filteredOaOperationData,
              'OA运营主要服务运营部的粉丝经营，重点看唤醒、促活、复购与转会员效果。'
            ),
          },
        ]}
      />
    )
  }

  const renderJointPanel = () => {
    const totalFollows = filteredJointData.reduce((sum, item) => sum + item.follows, 0)
    const totalUsers = filteredJointData.reduce((sum, item) => sum + item.users, 0)
    const totalMembers = filteredJointData.reduce((sum, item) => sum + item.members, 0)
    const userRate = totalFollows ? Number(((totalUsers / totalFollows) * 100).toFixed(2)) : 0
    const memberRate = totalUsers ? Number(((totalMembers / totalUsers) * 100).toFixed(2)) : 0
    const totalMemberRate = totalFollows ? Number(((totalMembers / totalFollows) * 100).toFixed(2)) : 0

    return (
      <>
        <Card title="联合活动数据总盘" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="总关注数" value={totalFollows} prefix={<HeartOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="总用户数" value={totalUsers} prefix={<UserOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="总会员数" value={totalMembers} prefix={<CrownOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="关注→用户转化率" value={userRate} suffix="%" prefix={<LineChartOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="用户→会员转化率" value={memberRate} suffix="%" prefix={<FundProjectionScreenOutlined />} /></Card></Col>
            <Col xs={12} sm={8} md={4}><Card><Statistic title="关注→会员总转化率" value={totalMemberRate} suffix="%" prefix={<TeamOutlined />} /></Card></Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12}>
              <Card size="small" title="联合活动链路">
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>关注 → 用户</span>
                      <span>{userRate}%</span>
                    </div>
                    <Progress percent={userRate} showInfo={false} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>用户 → 会员</span>
                      <span>{memberRate}%</span>
                    </div>
                    <Progress percent={memberRate} showInfo={false} />
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title="说明">
                <div style={{ color: '#666', lineHeight: 1.9 }}>
                  联合活动数据用于复盘互联网推广部 + 运营部的协同效果。<br />
                  重点看引流后的用户沉淀与会员转化结果。
                </div>
              </Card>
            </Col>
          </Row>
        </Card>

        <Card title="联合活动数据明细">
          <Table rowKey="key" columns={operationColumns} dataSource={filteredJointData} pagination={false} />
        </Card>
      </>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{currentTitle}</h2>
        <RangePicker onChange={(v: any) => setDateRange(v)} />
        <Select
          value={department}
          onChange={setDepartment}
          style={{ width: 180 }}
          options={[
            { value: 'all', label: '全部部门' },
            { value: '互联网推广部', label: '互联网推广部' },
            { value: '运营部', label: '运营部' },
            { value: '联合活动', label: '联合活动' },
          ]}
        />
        <Select
          value={unitType}
          onChange={setUnitType}
          style={{ width: 160 }}
          options={[
            { value: 'all', label: '全部单元' },
            { value: '活动', label: '活动' },
            { value: '卡券', label: '卡券' },
          ]}
        />
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索活动/卡券名称"
          prefix={<SearchOutlined />}
          style={{ width: 220 }}
        />
        <Button type="primary" icon={<LineChartOutlined />}>刷新</Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'promotion',
            label: (
              <span>
                推广数据
                <Tag color="blue" style={{ marginLeft: 8 }}>总关注转化率 33.94%</Tag>
              </span>
            ),
            children: renderPromotionPanel(),
          },
          {
            key: 'operation',
            label: (
              <span>
                运营数据
                <Tag color="green" style={{ marginLeft: 8 }}>关注转会员 18.20%</Tag>
              </span>
            ),
            children: renderOperationPanel(),
          },
          {
            key: 'joint',
            label: (
              <span>
                联合活动数据
                <Tag color="purple" style={{ marginLeft: 8 }}>会员沉淀 584</Tag>
              </span>
            ),
            children: renderJointPanel(),
          },
        ]}
      />
    </div>
  )
}
