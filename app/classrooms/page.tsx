export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'
import { getEffectiveLocationId } from '@/lib/asset-location'
import { getAuthFromCookies } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'

export default async function ClassroomsPage() {
  const auth = getAuthFromCookies()!
  const [classrooms, assets] = await Promise.all([db.getClassrooms(), db.getAllAssets()])

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-950 via-blue-900 to-cyan-800 px-6 py-7 text-white shadow-sm sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Room directory</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Classrooms</h1>
              <p className="mt-1 max-w-2xl text-sm text-blue-100">Open a room to see its IT equipment and classroom assets in separate lists.</p>
            </div>
            {(auth.role === 'admin' || auth.role === 'superadmin') && <Link href="/admin" className="btn bg-white text-blue-900 hover:bg-blue-50">Manage classrooms</Link>}
          </div>
        </header>

        {classrooms.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M9 8h6m-6 4h6m-6 4h6" /></svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">No classrooms marked yet</h2>
            <p className="mt-1 text-sm text-gray-500">Existing locations are preserved. An admin can mark the relevant rooms as classrooms.</p>
            {(auth.role === 'admin' || auth.role === 'superadmin') && <Link href="/admin" className="btn-primary mt-5">Open location settings</Link>}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {classrooms.map(classroom => {
              const roomAssets = assets.filter(asset => getEffectiveLocationId(asset) === classroom.id)
              const itAssets = roomAssets.filter(asset => asset.asset_class === 'it')
              const classroomAssets = roomAssets.filter(asset => asset.asset_class === 'classroom')
              const itemCount = roomAssets.reduce((sum, asset) => sum + asset.quantity_total, 0)
              const issueCount = roomAssets.reduce((sum, asset) => sum + asset.quantity_damaged + asset.quantity_missing, 0)
              return (
                <Link key={classroom.id} href={`/classrooms/${classroom.id}`} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
                  <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900 group-hover:text-blue-800">{classroom.name}</h2>
                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{classroom.description ?? 'Classroom asset overview'}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-800 shadow-sm">{itemCount} items</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-gray-100 px-2 py-5 text-center">
                    <div><p className="text-xl font-bold text-blue-800">{itAssets.length}</p><p className="text-xs text-gray-500">IT records</p></div>
                    <div><p className="text-xl font-bold text-amber-700">{classroomAssets.length}</p><p className="text-xs text-gray-500">Room records</p></div>
                    <div><p className={`text-xl font-bold ${issueCount ? 'text-red-700' : 'text-green-700'}`}>{issueCount}</p><p className="text-xs text-gray-500">Issues</p></div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
