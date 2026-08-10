export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'
import { getEffectiveLocationId } from '@/lib/asset-location'
import { getAuthFromCookies } from '@/lib/auth'
import { AssetWithDetails, db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const STATUS_LABELS: Record<string, string> = { available: 'Available', allocated: 'Allocated', maintenance: 'Maintenance', retired: 'Retired' }

function AssetList({ assets, emptyMessage, classroomAsset }: { assets: AssetWithDetails[]; emptyMessage: string; classroomAsset?: boolean }) {
  if (assets.length === 0) return <div className="px-5 py-10 text-center text-sm text-gray-500">{emptyMessage}</div>
  return (
    <div className="divide-y divide-gray-100">
      {assets.map(asset => (
        <Link key={asset.id} href={`/asset/${asset.id}`} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-gray-50 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-blue-700">{asset.asset_tag}</span>
              <span className={`badge-${asset.status}`}>{STATUS_LABELS[asset.status] ?? asset.status}</span>
            </div>
            <p className="mt-1 font-semibold text-gray-900">{asset.name}</p>
            <p className="text-xs text-gray-500">{asset.type}{asset.model ? ` | ${asset.model}` : ''}</p>
          </div>
          {classroomAsset ? (
            <div className="sm:text-right">
              <p className="font-semibold text-gray-900">{asset.quantity_total} {asset.quantity_total === 1 ? 'item' : 'items'}</p>
              <p className="text-xs text-gray-500">{asset.quantity_good} good | {asset.quantity_fair} fair | {asset.quantity_damaged} damaged | {asset.quantity_missing} missing</p>
            </div>
          ) : (
            <div className="text-xs text-gray-500 sm:text-right">
              <p>{asset.serial_number ? `Serial ${asset.serial_number}` : 'No serial number'}</p>
              <p>{asset.current_allocation ? `Allocated to ${asset.current_allocation.allocated_to}` : 'Not allocated'}</p>
            </div>
          )}
          <svg className="hidden h-5 w-5 text-gray-300 sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </Link>
      ))}
    </div>
  )
}

export default async function ClassroomDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id)) notFound()
  const [classroom, allAssets] = await Promise.all([db.getLocationById(id), db.getAllAssets()])
  if (!classroom || classroom.location_type !== 'classroom') notFound()

  const auth = getAuthFromCookies()!
  const roomAssets = allAssets.filter(asset => getEffectiveLocationId(asset) === id)
  const itAssets = roomAssets.filter(asset => asset.asset_class === 'it')
  const classroomAssets = roomAssets.filter(asset => asset.asset_class === 'classroom')
  const classroomItemCount = classroomAssets.reduce((sum, asset) => sum + asset.quantity_total, 0)
  const issueCount = roomAssets.reduce((sum, asset) => sum + asset.quantity_damaged + asset.quantity_missing, 0)
  const canManage = auth.role === 'admin' || auth.role === 'superadmin'

  return (
    <AppShell>
      <div className="space-y-6">
        <Link href="/classrooms" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900">
          <span aria-hidden="true">&lt;-</span> All classrooms
        </Link>
        <header className="card overflow-hidden">
          <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-cyan-800 px-6 py-6 text-white sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Classroom</p><h1 className="mt-1 text-3xl font-bold">{classroom.name}</h1><p className="mt-1 text-sm text-blue-100">{classroom.description ?? 'IT and classroom assets currently assigned to this room.'}</p></div>
              {canManage && <div className="flex flex-wrap gap-2"><Link href={`/assets/new?class=it&location=${id}`} className="btn bg-white text-blue-900 hover:bg-blue-50">Add IT asset</Link><Link href={`/assets/new?class=classroom&location=${id}`} className="btn bg-amber-400 text-amber-950 hover:bg-amber-300">Add classroom asset</Link></div>}
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 sm:grid-cols-4 sm:divide-y-0">
            <div className="p-4 text-center"><p className="text-2xl font-bold text-blue-800">{itAssets.length}</p><p className="text-xs text-gray-500">IT assets</p></div>
            <div className="p-4 text-center"><p className="text-2xl font-bold text-amber-700">{classroomAssets.length}</p><p className="text-xs text-gray-500">Classroom records</p></div>
            <div className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{classroomItemCount}</p><p className="text-xs text-gray-500">Classroom items</p></div>
            <div className="p-4 text-center"><p className={`text-2xl font-bold ${issueCount ? 'text-red-700' : 'text-green-700'}`}>{issueCount}</p><p className="text-xs text-gray-500">Damaged / missing</p></div>
          </div>
        </header>

        <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Technology register</p><h2 className="font-bold text-gray-900">IT Assets</h2></div><Link href={`/assets?class=it`} className="text-xs font-medium text-blue-700">Full IT register</Link></div><AssetList assets={itAssets} emptyMessage="No IT assets are assigned to this classroom." /></section>
        <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Room register</p><h2 className="font-bold text-gray-900">Classroom Assets</h2></div><Link href={`/assets?class=classroom`} className="text-xs font-medium text-amber-700">Full classroom register</Link></div><AssetList assets={classroomAssets} emptyMessage="No furniture or classroom equipment is assigned to this room." classroomAsset /></section>
      </div>
    </AppShell>
  )
}
