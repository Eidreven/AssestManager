import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import ScanForm from './ScanForm'

export default function ScanPage({ params }: { params: { id: string } }) {
  const asset = db.getAssetById(Number(params.id))
  if (!asset) notFound()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-4 pt-8">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-blue-900 rounded-xl flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">MPS Asset Manager</h1>
          <p className="text-sm text-gray-500">Submit a request for this device</p>
        </div>

        {/* Asset info */}
        <div className="bg-blue-900 text-white rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">
              {asset.type.toLowerCase().includes('ipad') ? '📱'
                : asset.type.toLowerCase().includes('laptop') ? '💻'
                : asset.type.toLowerCase().includes('chromebook') ? '💻'
                : asset.type.toLowerCase().includes('projector') ? '📽'
                : asset.type.toLowerCase().includes('camera') ? '📷'
                : '🖥'}
            </div>
            <div>
              <p className="font-mono font-bold text-blue-200 text-sm">{asset.asset_tag}</p>
              <p className="font-semibold text-lg leading-tight">{asset.name}</p>
              <p className="text-blue-300 text-sm">{asset.type}{asset.model ? ` · ${asset.model}` : ''}</p>
            </div>
          </div>
          {asset.location_name && (
            <p className="mt-2 text-blue-200 text-sm">📍 {asset.location_name}</p>
          )}
        </div>

        <ScanForm assetId={asset.id} />
      </div>
    </div>
  )
}
