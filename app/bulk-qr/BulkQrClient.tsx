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

// Sticker dimensions: 99.1mm x 139mm, 3x3 = 9 QR codes per sticker
// Each cell: ~32.7mm wide x 46mm tall

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

export default function BulkQrClient({ assets, teachers }: Props) {
  const [typeFilter, setTypeFilter] = useState('all')
  const [allocationFilter, setAllocationFilter] = useState('all')
  const [qrUrls, setQrUrls] = useState<Record<number, string>>({})
  const [generating, setGenerating] = useState(false)

  const types = Array.from(new Set(assets.map(a => a.type))).sort()

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
          width: 300,
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

  const stickerPages = chunk(filtered, 9)
  const totalStickers = stickerPages.length

  return (
    <>
      <style>{`
        /* Screen preview */
        .sticker-page {
          width: 99.1mm;
          height: 139mm;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(3, 1fr);
          box-sizing: border-box;
          border: 1px dashed #cbd5e1;
          background: white;
          margin: 0 auto 24px auto;
          overflow: hidden;
        }
        .qr-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 0.3px solid #e2e8f0;
          box-sizing: border-box;
          padding: 1.5mm;
          overflow: hidden;
        }
        .qr-cell img {
          width: 26mm;
          height: 26mm;
          display: block;
          flex-shrink: 0;
        }
        .qr-tag {
          font-size: 6pt;
          font-weight: 700;
          font-family: ui-monospace, monospace;
          color: #1e3a8a;
          text-align: center;
          margin-top: 1mm;
          line-height: 1.2;
        }
        .qr-name {
          font-size: 5pt;
          color: #64748b;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 30mm;
          line-height: 1.2;
        }
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: white; }

          /* Each sticker is one page, exactly the sticker size */
          @page {
            size: 99.1mm 139mm;
            margin: 0;
          }
          .sticker-page {
            width: 99.1mm;
            height: 139mm;
            margin: 0;
            border: none;
            page-break-after: always;
            break-after: page;
          }
          .sticker-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Controls */}
      <div className="no-print mb-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bulk QR Labels</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {generating
                ? 'Generating…'
                : `${filtered.length} QR codes · ${totalStickers} sticker${totalStickers !== 1 ? 's' : ''} · 9 per sticker (3×3) · 99.1×139mm`}
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

        {!generating && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">No assets match the selected filters.</div>
        )}

        {!generating && filtered.length > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <strong>Print tip:</strong> In the print dialog, set paper size to <strong>99.1 × 139mm</strong> (or &quot;Custom&quot;), set margins to <strong>None</strong>, and disable &quot;Fit to page&quot;. Load your sticker sheets in the printer.
          </p>
        )}
      </div>

      {/* Sticker pages */}
      {generating ? (
        <div className="no-print flex items-center justify-center py-16 text-gray-400 gap-3">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Generating QR codes…
        </div>
      ) : (
        stickerPages.map((page, pi) => (
          <div key={pi} className="sticker-page">
            {page.map(asset => (
              <div key={asset.id} className="qr-cell">
                {qrUrls[asset.id] && (
                  <img src={qrUrls[asset.id]} alt={asset.asset_tag} />
                )}
                <div className="qr-tag">{asset.asset_tag}</div>
                <div className="qr-name">{asset.name}</div>
              </div>
            ))}
          </div>
        ))
      )}
    </>
  )
}
