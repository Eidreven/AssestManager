'use client'

import { REPORT_CATALOG, type ReportId } from '@/lib/reporting'
import { useMemo, useState } from 'react'

type ExportFormat = 'xlsx' | 'csv'

interface Props {
  holders: string[]
  types: string[]
  locations: Array<{ id: number; name: string; type: 'classroom' | 'other' }>
}

const CATEGORY_STYLES: Record<string, string> = {
  Overview: 'bg-emerald-100 text-emerald-800',
  Inventory: 'bg-blue-100 text-blue-800',
  Risk: 'bg-red-100 text-red-800',
  Finance: 'bg-teal-100 text-teal-800',
  Lifecycle: 'bg-amber-100 text-amber-800',
  Custody: 'bg-cyan-100 text-cyan-800',
  Operations: 'bg-orange-100 text-orange-800',
  Audit: 'bg-slate-200 text-slate-800',
}

const MULTI_SHEET_REPORTS = new Set<ReportId>(['executive-pack', 'handover'])

function DownloadIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

export default function ReportsClient({ holders, types, locations }: Props) {
  const [selectedId, setSelectedId] = useState<ReportId>('executive-pack')
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [assetClass, setAssetClass] = useState('all')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('all')
  const [locationId, setLocationId] = useState('')
  const [teacher, setTeacher] = useState('')
  const [condition, setCondition] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [warrantyDays, setWarrantyDays] = useState('90')
  const [lifecycleYears, setLifecycleYears] = useState('4')
  const [includeRetired, setIncludeRetired] = useState(false)

  const selected = REPORT_CATALOG.find(report => report.id === selectedId)!
  const multiSheet = MULTI_SHEET_REPORTS.has(selectedId)
  const categories = ['All', ...Array.from(new Set(REPORT_CATALOG.map(report => report.category)))]
  const visibleReports = useMemo(() => {
    const term = search.trim().toLowerCase()
    return REPORT_CATALOG.filter(report =>
      (category === 'All' || report.category === category) &&
      (!term || `${report.title} ${report.description} ${report.category}`.toLowerCase().includes(term))
    )
  }, [category, search])

  function selectReport(id: ReportId) {
    setSelectedId(id)
    setError('')
    if (MULTI_SHEET_REPORTS.has(id)) setFormat('xlsx')
  }

  function resetFilters() {
    setAssetClass('all')
    setType('')
    setStatus('all')
    setLocationId('')
    setTeacher('')
    setCondition('all')
    setDateFrom('')
    setDateTo('')
    setWarrantyDays('90')
    setLifecycleYears('4')
    setIncludeRetired(false)
  }

  async function downloadReport() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        report: selectedId,
        format: multiSheet ? 'xlsx' : format,
        asset_class: assetClass,
        type,
        status,
        location_id: locationId,
        teacher,
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
      const filename = disposition.match(/filename="([^"]+)"/)?.[1]
      anchor.href = url
      anchor.download = filename ?? `mps-${selectedId}.${format}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.28),_transparent_35%),linear-gradient(135deg,#052e2b,#064e3b_55%,#115e59)] px-6 py-7 text-white shadow-sm sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Management intelligence</p>
        <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Report Centre</h1>
            <p className="mt-2 max-w-2xl text-sm text-emerald-50/85">Audit the register, prepare a stocktake, monitor risk, plan replacements and export management-ready workbooks.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur"><p className="text-xl font-bold">{REPORT_CATALOG.length}</p><p className="text-[11px] text-emerald-100">Reports</p></div>
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur"><p className="text-xl font-bold">{categories.length - 1}</p><p className="text-[11px] text-emerald-100">Categories</p></div>
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur"><p className="text-xl font-bold">2</p><p className="text-[11px] text-emerald-100">Formats</p></div>
          </div>
        </div>
      </header>

      <details className="card group overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="font-semibold text-gray-900">Report filters and assumptions</p>
            <p className="text-xs text-gray-500">Filters apply wherever the selected report contains the relevant field.</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={event => { event.preventDefault(); resetFilters() }} className="text-xs font-medium text-emerald-700 hover:text-emerald-900">Reset</button>
            <svg className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </summary>
        <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className="label" htmlFor="report-register">Asset register</label><select id="report-register" className="input" value={assetClass} onChange={event => setAssetClass(event.target.value)}><option value="all">All registers</option><option value="it">IT assets</option><option value="classroom">Classroom assets</option></select></div>
            <div><label className="label" htmlFor="report-type">Asset type</label><select id="report-type" className="input" value={type} onChange={event => setType(event.target.value)}><option value="">All types</option>{types.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
            <div><label className="label" htmlFor="report-status">Status</label><select id="report-status" className="input" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="available">Available</option><option value="allocated">Allocated</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option></select></div>
            <div><label className="label" htmlFor="report-condition">Condition</label><select id="report-condition" className="input" value={condition} onChange={event => setCondition(event.target.value)}><option value="all">All conditions</option><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option><option value="missing">Missing</option></select></div>
            <div><label className="label" htmlFor="report-location">Location</label><select id="report-location" className="input" value={locationId} onChange={event => setLocationId(event.target.value)}><option value="">All locations</option><optgroup label="Classrooms">{locations.filter(item => item.type === 'classroom').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup><optgroup label="Other locations">{locations.filter(item => item.type !== 'classroom').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup></select></div>
            <div><label className="label" htmlFor="report-teacher">Current holder</label><select id="report-teacher" className="input" value={teacher} onChange={event => setTeacher(event.target.value)}><option value="">All holders</option>{holders.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
            <div><label className="label" htmlFor="report-from">Activity from</label><input id="report-from" className="input" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /></div>
            <div><label className="label" htmlFor="report-to">Activity to</label><input id="report-to" className="input" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} /></div>
            <div><label className="label" htmlFor="report-warranty">Warranty horizon</label><select id="report-warranty" className="input" value={warrantyDays} onChange={event => setWarrantyDays(event.target.value)}><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option><option value="180">6 months</option><option value="365">12 months</option></select></div>
            <div><label className="label" htmlFor="report-lifecycle">Planning lifecycle</label><select id="report-lifecycle" className="input" value={lifecycleYears} onChange={event => setLifecycleYears(event.target.value)}><option value="3">3 years</option><option value="4">4 years</option><option value="5">5 years</option><option value="7">7 years</option><option value="10">10 years</option></select></div>
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 sm:col-span-2"><input type="checkbox" checked={includeRetired} onChange={event => setIncludeRetired(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-emerald-700" /><span><span className="block font-medium">Include retired assets</span><span className="block text-xs text-gray-500">Retired assets are excluded by default.</span></span></label>
          </div>
        </div>
      </details>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1" aria-label="Report categories">
              {categories.map(item => <button key={item} type="button" onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${category === item ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{item}</button>)}
            </div>
            <label className="relative block w-full min-w-0 shrink-0 sm:w-64"><span className="sr-only">Search reports</span><svg className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><input className="input min-w-0 pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search reports" /></label>
          </div>

          {visibleReports.length === 0 ? (
            <div className="card px-6 py-14 text-center text-sm text-gray-500">No reports match this search.</div>
          ) : (
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {visibleReports.map(report => {
                const active = selectedId === report.id
                return (
                  <button key={report.id} type="button" aria-pressed={active} onClick={() => selectReport(report.id)} className={`card relative min-w-0 overflow-hidden p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-emerald-500 ring-2 ring-emerald-500/15' : 'hover:border-gray-300'}`}>
                    {active && <span className="absolute right-0 top-0 h-12 w-12 bg-[linear-gradient(225deg,#10b981_50%,transparent_50%)]" aria-hidden="true" />}
                    <div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${CATEGORY_STYLES[report.category] ?? 'bg-gray-100 text-gray-700'}`}>{report.category}</span>{'badge' in report && <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white">{report.badge}</span>}</div>
                    <h2 className="mt-3 font-bold text-gray-900">{report.title}</h2>
                    <p className="mt-1.5 text-sm leading-5 text-gray-500">{report.description}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <div className="card overflow-hidden">
            <div className="border-b border-gray-100 bg-gradient-to-br from-emerald-50 to-teal-50 px-5 py-5">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${CATEGORY_STYLES[selected.category] ?? 'bg-gray-100 text-gray-700'}`}>{selected.category}</span>
              <h2 className="mt-3 text-xl font-bold text-gray-900">{selected.title}</h2>
              <p className="mt-2 text-sm leading-5 text-gray-600">{selected.description}</p>
            </div>
            <div className="space-y-5 p-5">
              <div>
                <p className="label">Export format</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={format === 'xlsx'} onClick={() => setFormat('xlsx')} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${format === 'xlsx' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600'}`}>Excel workbook</button>
                  <button type="button" aria-pressed={format === 'csv'} disabled={multiSheet} onClick={() => setFormat('csv')} className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${format === 'csv' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600'}`}>CSV data</button>
                </div>
                {multiSheet && <p className="mt-2 text-xs text-gray-500">This report contains multiple sheets and exports as Excel.</p>}
              </div>

              <div className="rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-600">
                <p className="font-semibold text-gray-800">Export safeguards</p>
                <p>Filters are recorded in the workbook. User-entered values are neutralized before spreadsheet export. Files are not cached.</p>
              </div>

              {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

              <button type="button" onClick={downloadReport} disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60">
                <DownloadIcon />
                {loading ? 'Generating report...' : `Download ${multiSheet || format === 'xlsx' ? 'Excel' : 'CSV'}`}
              </button>
              <p className="text-center text-[11px] text-gray-400">The export is recorded in the activity log.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
