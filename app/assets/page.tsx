export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'
import Link from 'next/link'
import TeacherFilter from './TeacherFilter'
import TypeFilter from './TypeFilter'

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  allocated: 'Allocated',
  maintenance: 'Maintenance',
  retired: 'Retired',
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams?: { class?: string; status?: string; q?: string; teacher?: string; type?: string }
}) {
  const auth = getAuthFromCookies()!
  const [allAssets, teachers] = await Promise.all([
    db.getAllAssets(),
    db.getTeachers(),
  ])

  const assetClass = searchParams?.class === 'classroom' ? 'classroom' : 'it'
  const classLabel = assetClass === 'it' ? 'IT Assets' : 'Classroom Assets'
  const q = searchParams?.q?.toLowerCase()
  const classAssets = allAssets.filter(asset => asset.asset_class === assetClass)
  const deviceTypes = Array.from(new Set(classAssets.map(a => a.type))).sort()
  const assets = classAssets.filter(a => {
    if (searchParams?.status && a.status !== searchParams.status) return false
    if (searchParams?.type && a.type !== searchParams.type) return false
    if (searchParams?.teacher && (
      a.current_allocation?.allocated_to !== searchParams.teacher ||
      a.current_allocation?.allocated_to_role !== 'Teacher'
    )) return false
    if (q && !(
      a.asset_tag.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) ||
      a.model?.toLowerCase().includes(q) ||
      a.serial_number?.toLowerCase().includes(q)
    )) return false
    return true
  })

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">School Asset Register</p>
            <h1 className="text-2xl font-bold text-gray-900">{classLabel}</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {assets.reduce((total, asset) => total + asset.quantity_total, 0)} items across {assets.length} records
            </p>
          </div>
          {(auth.role === 'admin' || auth.role === 'superadmin') && (
            <Link href={`/assets/new?class=${assetClass}`} className="btn-primary">
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
            <input type="hidden" name="class" value={assetClass} />
            <input
              type="search"
              name="q"
              defaultValue={searchParams?.q}
              placeholder="Search by tag, name, category, model or serial"
              className="input"
            />
          </form>

          {/* Type filter */}
          {deviceTypes.length > 0 && (
            <TypeFilter types={deviceTypes} current={searchParams?.type ?? ''} />
          )}

          {/* Teacher filter */}
          {assetClass === 'it' && teachers.length > 0 && (
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
                href={`/assets?class=${assetClass}${s ? `&status=${s}` : ''}${searchParams?.teacher ? `&teacher=${encodeURIComponent(searchParams.teacher)}` : ''}`}
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
            <span>Showing devices allocated to <strong>{searchParams.teacher}</strong></span>
            <Link href={`/assets?class=${assetClass}`} className="ml-auto text-green-600 hover:text-green-800 font-medium">Clear</Link>
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
              {(auth.role === 'admin' || auth.role === 'superadmin') && !searchParams?.teacher && (
                <Link href={`/assets/new?class=${assetClass}`} className="btn-primary mt-4 inline-flex">Register first asset</Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Tag</th>
                    <th className="px-4 py-3 font-medium">Name / Model</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    {assetClass === 'classroom' && <th className="px-4 py-3 font-medium">Quantity / condition</th>}
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
                      {assetClass === 'classroom' && (
                        <td className="px-4 py-3 text-gray-600">
                          {asset.tracking_mode === 'quantity' ? (
                            <div>
                              <p className="font-semibold text-gray-900">{asset.quantity_total} items</p>
                              <p className="text-xs text-gray-400">{asset.quantity_good} good, {asset.quantity_fair} fair, {asset.quantity_damaged} damaged, {asset.quantity_missing} missing</p>
                            </div>
                          ) : <span className="capitalize">{asset.condition}</span>}
                        </td>
                      )}
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
