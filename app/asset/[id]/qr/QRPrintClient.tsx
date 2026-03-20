'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

interface Asset {
  id: number
  asset_tag: string
  name: string
  type: string
  model: string | null
}

export default function QRPrintClient({ asset }: { asset: Asset }) {
  const imgRef = useRef<HTMLImageElement>(null)

  const qrUrl = `/api/assets/${asset.id}/qr?format=svg`

  useEffect(() => {
    // Pre-fetch the QR SVG
  }, [])

  return (
    <div className="min-h-screen bg-white print:bg-white">
      {/* Controls — hidden when printing */}
      <div className="print:hidden bg-blue-900 text-white px-6 py-4 flex items-center justify-between">
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
            className="btn-secondary text-sm px-4 py-2 rounded-lg bg-white text-blue-900 hover:bg-blue-50"
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

      {/* Print area */}
      <div className="flex items-center justify-center p-8 print:p-0">
        <div className="print:shadow-none shadow-lg rounded-2xl overflow-hidden border border-gray-200 print:border-0"
          style={{ width: '280px' }}>
          {/* Label header */}
          <div className="bg-blue-900 text-white text-center py-3 px-4">
            <p className="text-xs text-blue-200 font-medium tracking-widest uppercase">Macfarlane Primary School</p>
            <p className="font-bold text-sm mt-0.5">Asset Management</p>
          </div>

          {/* QR Code */}
          <div className="bg-white flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={qrUrl}
              alt={`QR code for ${asset.asset_tag}`}
              width={220}
              height={220}
              className="block"
            />
          </div>

          {/* Asset details */}
          <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 text-center">
            <p className="font-mono font-bold text-blue-900 text-lg tracking-wide">{asset.asset_tag}</p>
            <p className="font-semibold text-gray-800 text-sm mt-0.5">{asset.name}</p>
            <p className="text-gray-500 text-xs mt-0.5">{asset.type}{asset.model ? ` · ${asset.model}` : ''}</p>
            <p className="text-gray-400 text-xs mt-2">Scan to view details & submit requests</p>
          </div>
        </div>
      </div>

      {/* Tip */}
      <div className="print:hidden text-center mt-2 text-sm text-gray-400 pb-8">
        Print this label and stick it onto the device. Anyone who scans it will be taken to this device&apos;s page.
      </div>
    </div>
  )
}
