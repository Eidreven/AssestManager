import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'
import { notFound } from 'next/navigation'
import ScanForm from './ScanForm'

export default async function ScanPage({ params }: { params: { id: string } }) {
  const asset = await db.getAssetById(Number(params.id))
  if (!asset) notFound()

  const auth = getAuthFromCookies()
  const loggedInUser = auth ? { name: auth.name, email: auth.email } : null

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-start p-4 pb-12" style={{ paddingTop: '1.5rem' }}>
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Macfarlane Primary School</p>
          <h1 className="text-2xl font-bold text-gray-900">Report a Problem</h1>
        </div>

        {/* Asset info card */}
        <div className="bg-blue-900 text-white rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="text-5xl leading-none">
              {asset.type.toLowerCase().includes('ipad') ? '📱'
                : asset.type.toLowerCase().includes('laptop') ? '💻'
                : asset.type.toLowerCase().includes('chromebook') ? '💻'
                : asset.type.toLowerCase().includes('projector') ? '📽'
                : asset.type.toLowerCase().includes('camera') ? '📷'
                : '🖥'}
            </div>
            <div>
              <p className="font-mono text-blue-300 text-sm">{asset.asset_tag}</p>
              <p className="font-bold text-xl leading-tight">{asset.name}</p>
              <p className="text-blue-300 text-sm mt-0.5">{asset.type}{asset.model ? ` · ${asset.model}` : ''}</p>
              {asset.location_name && (
                <p className="text-blue-300 text-sm mt-1">📍 {asset.location_name}</p>
              )}
            </div>
          </div>
        </div>

        <ScanForm assetId={asset.id} loggedInUser={loggedInUser} />
      </div>
    </div>
  )
}
