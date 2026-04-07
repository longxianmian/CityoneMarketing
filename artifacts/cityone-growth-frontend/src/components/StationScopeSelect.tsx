import React, { useEffect, useState } from 'react'
import { Select, Space, Tag, Radio } from 'antd'
import { EnvironmentOutlined } from '@ant-design/icons'
import request from '../api/request'

interface District { code: string; zh: string; th: string; en: string }
interface CityItem { code: string; zh: string; th: string; en: string; districts: District[] }
interface Station { id: string; name: { zh: string; th: string; en: string }; city: string; district: string; address?: string; status?: string }

export interface StationScope {
  type: 'all' | 'cities' | 'districts' | 'stations'
  city_codes?: string[]
  district_codes?: string[]
  station_ids?: string[]
}

interface Props {
  value?: StationScope
  onChange?: (v: StationScope) => void
}

const TYPE_OPTIONS = [
  { value: 'all', label: '全部站点' },
  { value: 'cities', label: '按城市' },
  { value: 'districts', label: '按区域' },
  { value: 'stations', label: '指定站点' },
]

export default function StationScopeSelect({ value, onChange }: Props) {
  const [cityDistricts, setCityDistricts] = useState<CityItem[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [loadingStations, setLoadingStations] = useState(false)
  const [selectedCity, setSelectedCity] = useState<string>('')

  const scope: StationScope = value || { type: 'all' }

  useEffect(() => {
    request.get('/stations/city-districts').then((res: any) => {
      const data = res?.data || res
      if (Array.isArray(data)) setCityDistricts(data)
    }).catch(() => {})
  }, [])

  const loadStations = (city?: string) => {
    setLoadingStations(true)
    const params: Record<string, string> = { status: 'active' }
    if (city) params.city = city
    request.get('/stations', { params }).then((res: any) => {
      const d = res?.data || res
      if (d?.list) setStations(d.list)
    }).catch(() => {}).finally(() => setLoadingStations(false))
  }

  const handleTypeChange = (type: StationScope['type']) => {
    onChange?.({ type })
    if (type === 'stations' || type === 'districts') {
      loadStations()
    }
  }

  const cityOptions = cityDistricts.map(c => ({ value: c.code, label: `${c.zh} / ${c.en}` }))

  const getDistrictOptions = () => {
    const cities = scope.type === 'districts' ? (scope.city_codes || []) : [selectedCity]
    const result: { value: string; label: string; cityZh: string }[] = []
    for (const cityCode of cities) {
      const city = cityDistricts.find(c => c.code === cityCode)
      if (city) {
        city.districts.forEach(d => result.push({ value: `${cityCode}::${d.code}`, label: `${city.zh} · ${d.zh}`, cityZh: city.zh }))
      }
    }
    return result
  }

  const getStationOptions = () => {
    let list = stations
    if (selectedCity) list = list.filter(s => s.city === selectedCity)
    return list.map(s => ({
      value: s.id,
      label: `${s.name.zh}`,
      desc: s.address || '',
    }))
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, background: '#fafafa' }}>
      <div style={{ marginBottom: 10, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
        <EnvironmentOutlined style={{ color: '#2CDBCE' }} />
        适用站点范围
      </div>

      <Radio.Group
        value={scope.type}
        onChange={e => handleTypeChange(e.target.value)}
        optionType="button"
        buttonStyle="solid"
        size="small"
        options={TYPE_OPTIONS}
        style={{ marginBottom: 12 }}
      />

      {scope.type === 'all' && (
        <div style={{ color: '#6b7280', fontSize: 13 }}>
          <Tag color="blue">全部站点</Tag> 所有城市、所有区域的站点均适用此活动/卡券
        </div>
      )}

      {scope.type === 'cities' && (
        <div>
          <div style={{ marginBottom: 6, fontSize: 13, color: '#6b7280' }}>选择适用城市（可多选）</div>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="选择城市"
            options={cityOptions}
            value={scope.city_codes || []}
            onChange={v => onChange?.({ ...scope, city_codes: v })}
          />
        </div>
      )}

      {scope.type === 'districts' && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 6, fontSize: 13, color: '#6b7280' }}>先选城市</div>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="选择城市"
              options={cityOptions}
              value={scope.city_codes || []}
              onChange={v => onChange?.({ ...scope, city_codes: v, district_codes: [] })}
            />
          </div>
          {(scope.city_codes || []).length > 0 && (
            <div>
              <div style={{ marginBottom: 6, fontSize: 13, color: '#6b7280' }}>再选区域（可多选）</div>
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                placeholder="选择区域"
                options={getDistrictOptions()}
                value={scope.district_codes || []}
                onChange={v => onChange?.({ ...scope, district_codes: v })}
              />
            </div>
          )}
        </Space>
      )}

      {scope.type === 'stations' && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 6, fontSize: 13, color: '#6b7280' }}>按城市筛选站点</div>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder="选择城市（可选）"
              options={cityOptions}
              value={selectedCity || undefined}
              onChange={v => {
                setSelectedCity(v || '')
                loadStations(v || '')
              }}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontSize: 13, color: '#6b7280' }}>指定站点（可多选，已选 {(scope.station_ids || []).length} 个）</div>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="搜索并选择站点"
              showSearch
              filterOption={(input, opt) =>
                String(opt?.label || '').toLowerCase().includes(input.toLowerCase())
              }
              loading={loadingStations}
              options={getStationOptions()}
              value={scope.station_ids || []}
              onChange={v => onChange?.({ ...scope, station_ids: v })}
            />
          </div>
        </Space>
      )}
    </div>
  )
}
