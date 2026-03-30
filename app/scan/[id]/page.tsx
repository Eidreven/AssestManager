export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'
import { notFound } from 'next/navigation'
import ScanForm from './ScanForm'

export default async function ScanPage({ params }: { params: { id: string } }) {
  const asset = await db.getAssetById(Number(params.id))
  if (!asset) notFound()

  const auth = getAuthFromCookies()
  const loggedInUser = auth ? { name: auth.name, email: auth.email } : null

  const emoji =
    asset.type.toLowerCase().includes('ipad') ? '📱'
    : asset.type.toLowerCase().includes('laptop') ? '💻'
    : asset.type.toLowerCase().includes('chromebook') ? '💻'
    : asset.type.toLowerCase().includes('projector') ? '📽'
    : asset.type.toLowerCase().includes('camera') ? '📷'
    : '🖥'

  return (
    <div className="light-mode-island min-h-screen bg-gray-100 flex flex-col items-center justify-start px-3 py-5 pb-16 sm:px-4 sm:py-6">
      <div className="w-full max-w-sm space-y-3">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Macfarlane Primary School</p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">Report a Problem</h1>
        </div>

        {/* Asset info card */}
        <div className="bg-blue-900 text-white rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="text-4xl leading-none shrink-0">{emoji}</div>
            <div className="min-w-0">
              <p className="font-mono text-blue-300 text-xs">{asset.asset_tag}</p>
              <p className="font-bold text-lg leading-tight truncate">{asset.name}</p>
              <p className="text-blue-300 text-xs mt-0.5 truncate">{asset.type}{asset.model ? ` · ${asset.model}` : ''}</p>
              {asset.location_name && (
                <p className="text-blue-300 text-xs mt-0.5">📍 {asset.location_name}</p>
              )}
            </div>
          </div>
        </div>

        <ScanForm assetId={asset.id} loggedInUser={loggedInUser} />
      </div>
    </div>
  )
}
