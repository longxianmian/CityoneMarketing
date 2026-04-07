import React, { useEffect, useState } from 'react'
import { Select, Space, Button } from 'antd'
import { EnvironmentOutlined } from '@ant-design/icons'
import request from '../api/request'

interface District { code: string; zh: string; th: string; en: string }
interface CityItem { code: string; zh: string; th: string; en: string; districts: District[] }
interface Station { id: string; name: { zh: string; th: string; en: string }; city: string; district: string; status?: string }

export interface StationScope {
  type: 'all' | 'selected'
  city?: string
  district?: string
  station_ids?: string[]
}

interface Props {
  value?: StationScope
  onChange?: (v: StationScope) => void
}

export default function StationScopeSelect({ value, onChange }: Props) {
  const [cityDistricts, setCityDistricts] = useState<CityItem[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [loadingStations, setLoadingStations] = useState(false)

  const scope: StationScope = value || { type: 'all' }

  useEffect(() => {
    request.get('/stations/city-districts').then((res: any) => {
      const data = res?.data || res
      if (Array.isArray(data)) setCityDistricts(data)
    }).catch(() => {})
  }, [])

  const loadStations = (city: string, district: string) => {
    if (!city) { setStations([]); return }
    setLoadingStations(true)
    const params: Record<string, string> = { status: 'active', city }
    if (district) params.district = district
    request.get('/stations', { params }).then((res: any) => {
      const d = res?.data || res
      if (d?.list) setStations(d.list)
    }).catch(() => {}).finally(() => setLoadingStations(false))
  }

  const cityOptions = cityDistricts.map(c => ({ value: c.code, label: `${c.zh} / ${c.en}` }))

  const districtOptions = (cityDistricts.find(c => c.code === scope.city)?.districts || [])
    .map(d => ({ value: d.code, label: `${d.zh} / ${d.en}` }))

  const stationOptions = stations.map(s => ({ value: s.id, label: s.name.zh }))

  const handleCityChange = (city: string) => {
    onChange?.({ type: 'selected', city, district: '', station_ids: [] })
    loadStations(city, '')
  }

  const handleDistrictChange = (district: string) => {
    onChange?.({ ...scope, district, station_ids: [] })
    loadStations(scope.city || '', district)
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, background: '#fafafa' }}>
      <div style={{ marginBottom: 10, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
        <EnvironmentOutlined style={{ color: '#2CDBCE' }} />
        适用站点范围
      </div>

      <Space style={{ marginBottom: 12 }}>
        <Button
          type={scope.type === 'all' ? 'primary' : 'default'}
          size="small"
          onClick={() => onChange?.({ type: 'all' })}
          style={scope.type === 'all' ? { background: '#2CDBCE', borderColor: '#2CDBCE' } : {}}
        >
          全部站点
        </Button>
        <Button
          type={scope.type === 'selected' ? 'primary' : 'default'}
          size="small"
          onClick={() => {
            onChange?.({ type: 'selected', city: '', district: '', station_ids: [] })
          }}
          style={scope.type === 'selected' ? { background: '#2CDBCE', borderColor: '#2CDBCE' } : {}}
        >
          站点选择
        </Button>
      </Space>

      {scope.type === 'selected' && (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <div>
            <div style={{ marginBottom: 5, fontSize: 13, color: '#6b7280' }}>选择城市</div>
            <Select
              style={{ width: '100%' }}
              placeholder="请选择城市"
              options={cityOptions}
              value={scope.city || undefined}
              onChange={handleCityChange}
              allowClear
              onClear={() => onChange?.({ type: 'selected', city: '', district: '', station_ids: [] })}
            />
          </div>

          {scope.city && (
            <div>
              <div style={{ marginBottom: 5, fontSize: 13, color: '#6b7280' }}>选择区域（可选）</div>
              <Select
                style={{ width: '100%' }}
                placeholder="请选择区域（不选则包含该城市所有区域）"
                options={districtOptions}
                value={scope.district || undefined}
                onChange={handleDistrictChange}
                allowClear
                onClear={() => { onChange?.({ ...scope, district: '', station_ids: [] }); loadStations(scope.city || '', '') }}
              />
            </div>
          )}

          {scope.city && (
            <div>
              <div style={{ marginBottom: 5, fontSize: 13, color: '#6b7280' }}>
                指定站点（可多选，不选则包含上方城市/区域所有站点）
              </div>
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                placeholder="搜索并选择站点（可留空）"
                showSearch
                filterOption={(input, opt) =>
                  String(opt?.label || '').toLowerCase().includes(input.toLowerCase())
                }
                loading={loadingStations}
                options={stationOptions}
                value={scope.station_ids || []}
                onChange={v => onChange?.({ ...scope, station_ids: v })}
              />
            </div>
          )}
        </Space>
      )}
    </div>
  )
}
