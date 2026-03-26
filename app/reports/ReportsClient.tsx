'use client'

import { useState } from 'react'

const TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'iPad', label: 'iPads' },
  { value: 'Laptop', label: 'Laptops' },
  { value: 'Chromebook', label: 'Chromebooks' },
  { value: 'Projector', label: 'Projectors' },
  { value: 'Camera', label: 'Cameras' },
  { value: 'Desktop', label: 'Desktops' },
]

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'available', label: 'Available' },
  { value: 'allocated', label: 'Allocated' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
]

export default function ReportsPage() {
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDownload() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ type, status })
      const res = await fetch(`/api/reports?${params}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to generate report')
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="(.+)"/)
      a.download = match ? match[1] : 'assets-report.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Failed to download report')
    } finally {
      setLoading(false)
    }
  }

  const typeLabel = TYPES.find(t => t.value === type)?.label ?? 'All'
  const statusLabel = STATUSES.find(s => s.value === status)?.label ?? 'All'

  return (
    <div>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500">Generate and download asset reports as Excel spreadsheets.</p>

        <div className="card p-6 space-y-6">
          <h2 className="font-semibold text-gray-900 text-lg">Asset Report</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Device Type</label>
              <select className="input" value={type} onChange={e => setType(e.target.value)}>
                {TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
                {STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-1">
            <p className="font-medium text-gray-700">Report will include:</p>
            <ul className="list-disc list-inside space-y-0.5 text-gray-500">
              <li>Asset tag, name, type, model, serial number</li>
              <li>Status and location</li>
              <li>Purchase date and warranty expiry</li>
              <li>Current allocation details (if allocated)</li>
            </ul>
            <p className="pt-2 text-gray-600">
              Filter: <span className="font-medium text-gray-800">{typeLabel}</span> &mdash; <span className="font-medium text-gray-800">{statusLabel}</span>
            </p>
          </div>

          <button
            onClick={handleDownload}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {loading ? 'Generating…' : 'Download Excel Report'}
          </button>
        </div>
      </div>
    </div>
  )
}
