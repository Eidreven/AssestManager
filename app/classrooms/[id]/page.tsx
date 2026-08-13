export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'
import { getEffectiveLocationId } from '@/lib/asset-location'
import { getAuthFromCookies } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ClassroomAssetSections from './ClassroomAssetSections'

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

        <ClassroomAssetSections itAssets={itAssets} classroomAssets={classroomAssets} />
      </div>
    </AppShell>
  )
}
