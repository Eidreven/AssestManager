'use client'

import { useState, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'

interface AssetRow {
  id: number
  asset_tag: string
  name: string
  type: string
  model: string | null
  status: string
  allocated_to: string | null
  allocated_to_role: string | null
}

interface Props {
  assets: AssetRow[]
  teachers: string[]
}

export default function BulkQrClient({ assets, teachers }: Props) {
  const [typeFilter, setTypeFilter] = useState('all')
  const [allocationFilter, setAllocationFilter] = useState('all')
  const [qrUrls, setQrUrls] = useState<Record<number, string>>({})
  const [generating, setGenerating] = useState(false)

  // Unique sorted types
  const types = Array.from(new Set(assets.map(a => a.type))).sort()

  // Apply filters
  const filtered = assets.filter(a => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false
    if (allocationFilter === 'available') return a.status === 'available'
    if (allocationFilter.startsWith('teacher:')) {
      return a.allocated_to === allocationFilter.slice(8)
    }
    return true
  })

  const filteredIds = filtered.map(a => a.id).join(',')

  const generateQrs = useCallback(async () => {
    if (filtered.length === 0) { setQrUrls({}); return }
    setGenerating(true)
    const origin = window.location.origin
    const results = await Promise.all(
      filtered.map(async a => {
        const url = `${origin}/scan/${a.id}`
        const dataUrl = await QRCode.toDataURL(url, {
          width: 200,
          margin: 1,
          color: { dark: '#1e3a8a', light: '#ffffff' },
        })
        return [a.id, dataUrl] as [number, string]
      })
    )
    setQrUrls(Object.fromEntries(results))
    setGenerating(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredIds])

  useEffect(() => { generateQrs() }, [generateQrs])

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .print-area { padding: 0.2in; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .label-grid {
          display: grid;
          grid-template-columns: repeat(3, 1in);
          gap: 0.12in;
        }
        .qr-label {
          width: 1in;
          height: 1in;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 0.5pt solid #d1d5db;
          box-sizing: border-box;
          padding: 2pt;
          background: white;
          overflow: hidden;
        }
        .qr-label img {
          width: 0.70in;
          height: 0.70in;
          flex-shrink: 0;
          display: block;
        }
        .qr-tag {
          font-size: 5.5pt;
          font-weight: 700;
          font-family: ui-monospace, monospace;
          color: #1e3a8a;
          text-align: center;
          line-height: 1.2;
          margin-top: 1pt;
        }
        .qr-name {
          font-size: 4.5pt;
          color: #6b7280;
          text-align: center;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 0.92in;
        }
      `}</style>

      {/* Controls */}
      <div className="no-print mb-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bulk QR Labels</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {generating ? 'Generating…' : `${filtered.length} labels · 3 per row · 1″ × 1″`}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            disabled={generating || filtered.length === 0}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Save PDF
          </button>
        </div>

        <div className="card p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="label">Device Type</label>
            <select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Filter By</label>
            <select className="input" value={allocationFilter} onChange={e => setAllocationFilter(e.target.value)}>
              <option value="all">All Assets</option>
              <option value="available">Available Only</option>
              <optgroup label="Allocated to Teacher">
                {teachers.map(t => (
                  <option key={t} value={`teacher:${t}`}>{t}</option>
                ))}
              </optgroup>
            </select>
          </div>
          {(typeFilter !== 'all' || allocationFilter !== 'all') && (
            <button
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              onClick={() => { setTypeFilter('all'); setAllocationFilter('all') }}
            >
              Clear filters
            </button>
          )}
        </div>

        {filtered.length === 0 && !generating && (
          <div className="text-center py-12 text-gray-400">No assets match the selected filters.</div>
        )}
      </div>

      {/* Label grid — visible on screen + print */}
      {filtered.length > 0 && (
        <div className="print-area">
          {generating ? (
            <div className="no-print flex items-center justify-center py-16 text-gray-400 gap-3">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Generating QR codes…
            </div>
          ) : (
            <div className="label-grid">
              {filtered.map(asset => (
                <div key={asset.id} className="qr-label">
                  {qrUrls[asset.id] && (
                    <img src={qrUrls[asset.id]} alt={asset.asset_tag} />
                  )}
                  <div className="qr-tag">{asset.asset_tag}</div>
                  <div className="qr-name">{asset.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
