'use client'

import Link from 'next/link'

interface Asset {
  id: number
  asset_tag: string
  name: string
  type: string
  model: string | null
}

export default function QRPrintClient({ asset }: { asset: Asset }) {
  const qrUrl = `/api/assets/${asset.id}/qr?format=svg`

  return (
    <>
      {/* Force browser not to add its own header/footer or margin that overlaps the label */}
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { margin: 0 !important; }
          .print-hide { display: none !important; }
          .label-card { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-100 print:bg-white">
        {/* Controls — hidden when printing */}
        <div className="print-hide bg-blue-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/asset/${asset.id}`} className="text-blue-200 hover:text-white text-sm">
              ← Back
            </Link>
            <span className="text-white font-medium">QR Code — {asset.asset_tag}</span>
          </div>
          <div className="flex gap-3">
            <a
              href={`/api/assets/${asset.id}/qr`}
              download={`${asset.asset_tag}-qr.png`}
              className="bg-white text-blue-900 text-sm px-4 py-2 rounded-lg hover:bg-blue-50 font-medium"
            >
              Download PNG
            </a>
            <button
              onClick={() => window.print()}
              className="bg-white text-blue-900 text-sm px-4 py-2 rounded-lg hover:bg-blue-50 font-medium"
            >
              Print Label
            </button>
          </div>
        </div>

        {/* Label — the only thing that prints */}
        <div className="flex items-center justify-center p-8 print:p-0 print:block">
          <div
            className="label-card shadow-lg rounded-2xl overflow-hidden border border-gray-200"
            style={{ width: '260px', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as React.CSSProperties}
          >
            {/* Header band */}
            <div style={{ background: '#1e3a8a', color: '#fff', textAlign: 'center', padding: '10px 16px', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as React.CSSProperties}>
              <p style={{ margin: 0, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: '#93c5fd' }}>Macfarlane Primary School</p>
              <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: '13px' }}>Asset Management</p>
            </div>

            {/* QR Code */}
            <div style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt={`QR code for ${asset.asset_tag}`}
                width={210}
                height={210}
                style={{ display: 'block' }}
              />
            </div>

            {/* Asset details */}
            <div style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '10px 16px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 700, color: '#1e3a8a', fontSize: '17px', letterSpacing: '1px' }}>{asset.asset_tag}</p>
              <p style={{ margin: '3px 0 0', fontWeight: 600, color: '#1f2937', fontSize: '13px' }}>{asset.name}</p>
              <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '11px' }}>{asset.type}{asset.model ? ` · ${asset.model}` : ''}</p>
              <p style={{ margin: '6px 0 0', color: '#9ca3af', fontSize: '10px' }}>Scan to view details &amp; submit requests</p>
            </div>
          </div>
        </div>

        {/* Tip */}
        <div className="print-hide text-center mt-2 text-sm text-gray-400 pb-8">
          Print this label and stick it onto the device. Anyone who scans it will be taken to this device&apos;s page.
        </div>
      </div>
    </>
  )
}
