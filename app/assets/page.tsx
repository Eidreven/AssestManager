export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'
import Link from 'next/link'
import TeacherFilter from './TeacherFilter'

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  allocated: 'Allocated',
  maintenance: 'Maintenance',
  retired: 'Retired',
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams?: { status?: string; q?: string; teacher?: string }
}) {
  const auth = getAuthFromCookies()!
  const [allAssets, teachers] = await Promise.all([
    db.getAllAssets(),
    db.getTeachers(),
  ])

  let assets = allAssets

  if (searchParams?.status) {
    assets = assets.filter(a => a.status === searchParams.status)
  }
  if (searchParams?.teacher) {
    assets = assets.filter(a =>
      a.current_allocation?.allocated_to === searchParams.teacher &&
      a.current_allocation?.allocated_to_role === 'Teacher'
    )
  }
  if (searchParams?.q) {
    const q = searchParams.q.toLowerCase()
    assets = assets.filter(a =>
      a.asset_tag.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) ||
      (a.model?.toLowerCase().includes(q)) ||
      (a.serial_number?.toLowerCase().includes(q))
    )
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Assets</h1>
            <p className="text-gray-500 text-sm mt-0.5">{assets.length} device{assets.length !== 1 ? 's' : ''}</p>
          </div>
          {auth.role === 'admin' && (
            <Link href="/assets/new" className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Register Asset
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="card p-4 flex flex-wrap gap-3">
          <form method="GET" action="/assets" className="flex-1 min-w-48">
            <input
              type="search"
              name="q"
              defaultValue={searchParams?.q}
              placeholder="Search by tag, name, model, serial…"
              className="input"
            />
          </form>

          {/* Teacher filter */}
          {teachers.length > 0 && (
            <TeacherFilter
              teachers={teachers.map(t => t.name)}
              current={searchParams?.teacher ?? ''}
            />
          )}

          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {['', 'available', 'allocated', 'maintenance', 'retired'].map(s => (
              <Link
                key={s}
                href={s
                  ? `/assets?status=${s}${searchParams?.teacher ? `&teacher=${encodeURIComponent(searchParams.teacher)}` : ''}`
                  : `/assets${searchParams?.teacher ? `?teacher=${encodeURIComponent(searchParams.teacher)}` : ''}`
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  (searchParams?.status ?? '') === s
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {s === '' ? 'All' : STATUS_LABELS[s]}
              </Link>
            ))}
          </div>
        </div>

        {/* Active teacher filter banner */}
        {searchParams?.teacher && (
          <div className="flex items-center gap-3 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <span>👩‍🏫 Showing devices allocated to <strong>{searchParams.teacher}</strong></span>
            <Link href="/assets" className="ml-auto text-green-600 hover:text-green-800 font-medium">Clear ×</Link>
          </div>
        )}

        {/* Table */}
        <div className="card overflow-hidden">
          {assets.length === 0 ? (
            <div className="py-16 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
              <p className="text-gray-500">No assets found</p>
              {auth.role === 'admin' && !searchParams?.teacher && (
                <Link href="/assets/new" className="btn-primary mt-4 inline-flex">Register first asset</Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Tag</th>
                    <th className="px-4 py-3 font-medium">Name / Model</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Allocated To</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assets.map(asset => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-blue-700">{asset.asset_tag}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{asset.name}</p>
                        {asset.model && <p className="text-gray-400 text-xs">{asset.model}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{asset.type}</td>
                      <td className="px-4 py-3">
                        <span className={`badge-${asset.status}`}>{STATUS_LABELS[asset.status] ?? asset.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{asset.location_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {asset.current_allocation
                          ? <span>{asset.current_allocation.allocated_to}
                              {asset.current_allocation.allocated_to_role
                                ? <span className="text-gray-400 text-xs ml-1">({asset.current_allocation.allocated_to_role})</span>
                                : null}
                            </span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/asset/${asset.id}`} className="btn-secondary text-xs px-3 py-1">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

