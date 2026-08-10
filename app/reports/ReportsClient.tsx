'use client'

import { REPORT_CATALOG, type ReportId } from '@/lib/reporting'
import { useState } from 'react'

type ExportFormat = 'xlsx' | 'csv'

interface Props {
  holders: string[]
  types: string[]
  locations: Array<{ id: number; name: string; type: 'classroom' | 'other' }>
}

const MULTI_SHEET_REPORTS = new Set<ReportId>(['executive-pack', 'handover'])

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

export default function ReportsClient({ holders, types, locations }: Props) {
  const [selectedId, setSelectedId] = useState<ReportId>('complete-inventory')
  const [loading, setLoading] = useState<ExportFormat | null>(null)
  const [error, setError] = useState('')
  const [assetClass, setAssetClass] = useState('all')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('all')
  const [locationId, setLocationId] = useState('')
  const [holder, setHolder] = useState('')
  const [condition, setCondition] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [warrantyDays, setWarrantyDays] = useState('90')
  const [lifecycleYears, setLifecycleYears] = useState('4')
  const [includeRetired, setIncludeRetired] = useState(false)

  const selected = REPORT_CATALOG.find(report => report.id === selectedId)!
  const multiSheet = MULTI_SHEET_REPORTS.has(selectedId)
  const categories = Array.from(new Set(REPORT_CATALOG.map(report => report.category)))

  function resetFilters() {
    setAssetClass('all')
    setType('')
    setStatus('all')
    setLocationId('')
    setHolder('')
    setCondition('all')
    setDateFrom('')
    setDateTo('')
    setWarrantyDays('90')
    setLifecycleYears('4')
    setIncludeRetired(false)
    setError('')
  }

  async function downloadReport(format: ExportFormat) {
    setLoading(format)
    setError('')
    try {
      const params = new URLSearchParams({
        report: selectedId,
        format,
        asset_class: assetClass,
        type,
        status,
        location_id: locationId,
        teacher: holder,
        condition,
        date_from: dateFrom,
        date_to: dateTo,
        warranty_days: warrantyDays,
        lifecycle_years: lifecycleYears,
        include_retired: String(includeRetired),
      })
      const response = await fetch(`/api/reports?${params}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? 'Failed to generate report')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const disposition = response.headers.get('Content-Disposition') ?? ''
      anchor.href = url
      anchor.download = disposition.match(/filename="([^"]+)"/)?.[1] ?? `mps-${selectedId}.${format}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Failed to generate report')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">Choose a report, apply any filters you need, then download it.</p>
      </header>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 p-5 sm:p-6">
          <label className="label" htmlFor="report-type">Report type</label>
          <select
            id="report-type"
            className="input"
            value={selectedId}
            onChange={event => { setSelectedId(event.target.value as ReportId); setError('') }}
          >
            {categories.map(category => (
              <optgroup key={category} label={category}>
                {REPORT_CATALOG.filter(report => report.category === category).map(report => (
                  <option key={report.id} value={report.id}>{report.title}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="mt-3 rounded-lg bg-blue-50 px-4 py-3">
            <p className="text-sm font-medium text-blue-900">{selected.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-blue-700">{selected.description}</p>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">Filters</h2>
              <p className="text-xs text-gray-500">Leave a filter as All to include everything.</p>
            </div>
            <button type="button" onClick={resetFilters} className="text-sm font-medium text-blue-700 hover:text-blue-900">Reset</button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="asset-register">Asset register</label>
              <select id="asset-register" className="input" value={assetClass} onChange={event => setAssetClass(event.target.value)}>
                <option value="all">All registers</option>
                <option value="it">IT assets</option>
                <option value="classroom">Classroom assets</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="asset-type">Asset type</label>
              <select id="asset-type" className="input" value={type} onChange={event => setType(event.target.value)}>
                <option value="">All types</option>
                {types.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="current-holder">Allocated to</label>
              <select id="current-holder" className="input" value={holder} onChange={event => setHolder(event.target.value)}>
                <option value="">All people</option>
                {holders.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="asset-status">Status</label>
              <select id="asset-status" className="input" value={status} onChange={event => setStatus(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="available">Available</option>
                <option value="allocated">Allocated</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="asset-location">Location</label>
              <select id="asset-location" className="input" value={locationId} onChange={event => setLocationId(event.target.value)}>
                <option value="">All locations</option>
                <optgroup label="Classrooms">{locations.filter(item => item.type === 'classroom').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
                <optgroup label="Other locations">{locations.filter(item => item.type !== 'classroom').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
              </select>
            </div>
          </div>

          <details className="rounded-lg border border-gray-200">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700">More filters</summary>
            <div className="grid gap-4 border-t border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="asset-condition">Condition</label><select id="asset-condition" className="input" value={condition} onChange={event => setCondition(event.target.value)}><option value="all">All conditions</option><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option><option value="missing">Missing</option></select></div>
              <div><label className="label" htmlFor="warranty-horizon">Warranty period</label><select id="warranty-horizon" className="input" value={warrantyDays} onChange={event => setWarrantyDays(event.target.value)}><option value="30">Next 30 days</option><option value="60">Next 60 days</option><option value="90">Next 90 days</option><option value="180">Next 6 months</option><option value="365">Next 12 months</option></select></div>
              <div><label className="label" htmlFor="date-from">From date</label><input id="date-from" className="input" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /></div>
              <div><label className="label" htmlFor="date-to">To date</label><input id="date-to" className="input" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} /></div>
              <div><label className="label" htmlFor="planning-life">Replacement age</label><select id="planning-life" className="input" value={lifecycleYears} onChange={event => setLifecycleYears(event.target.value)}><option value="3">3 years</option><option value="4">4 years</option><option value="5">5 years</option><option value="7">7 years</option><option value="10">10 years</option></select></div>
              <label className="flex items-center gap-3 pt-5 text-sm text-gray-700"><input type="checkbox" checked={includeRetired} onChange={event => setIncludeRetired(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-700" />Include retired assets</label>
            </div>
          </details>

          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row">
            <button type="button" onClick={() => downloadReport('xlsx')} disabled={loading !== null} className="btn-primary flex items-center justify-center gap-2">
              <DownloadIcon />
              {loading === 'xlsx' ? 'Generating...' : 'Download Excel'}
            </button>
            <button type="button" onClick={() => downloadReport('csv')} disabled={loading !== null || multiSheet} className="btn-secondary flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
              <DownloadIcon />
              {loading === 'csv' ? 'Generating...' : 'Download CSV'}
            </button>
          </div>
          {multiSheet && <p className="text-xs text-gray-500">This report contains multiple sheets and is available as Excel only.</p>}
        </div>
      </div>
    </div>
  )
}
