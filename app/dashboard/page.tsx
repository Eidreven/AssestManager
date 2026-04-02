export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'
import Link from 'next/link'

function StatCard({ label, value, color, href }: { label: string; value: number; color: string; href?: string }) {
  const content = (
    <div className={`card p-5 ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
  if (href) return <Link href={href}>{content}</Link>
  return content
}

export default async function DashboardPage() {
  const auth = getAuthFromCookies()!
  const [stats, allAllocations, pendingRequests, assets] = await Promise.all([
    db.getStats(),
    db.getAllAllocations(),
    db.getPendingRequests(),
    db.getAllAssets(),
  ])
  const recentAllocations = allAllocations.slice(0, 5)
  const recentPending = pendingRequests.slice(0, 5)

  // Group assets by type
  const byType: Record<string, number> = {}
  assets.forEach(a => { byType[a.type] = (byType[a.type] ?? 0) + 1 })

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">Welcome back, {auth.name}</p>
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

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Assets" value={stats.total} color="text-gray-900" href="/assets" />
          <StatCard label="Available" value={stats.available} color="text-green-600" href="/assets?status=available" />
          <StatCard label="Allocated" value={stats.allocated} color="text-blue-600" href="/assets?status=allocated" />
          <StatCard label="Maintenance" value={stats.maintenance} color="text-amber-600" href="/assets?status=maintenance" />
          <StatCard label="Pending Requests" value={stats.pendingRequests} color="text-red-600" href="/requests" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* By Type */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Assets by Type</h2>
            {Object.entries(byType).length === 0 ? (
              <p className="text-gray-400 text-sm">No assets registered yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{type}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.round((count / stats.total) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Requests */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Pending Requests</h2>
              <Link href="/requests" className="text-sm text-blue-600 hover:text-blue-700">View all</Link>
            </div>
            {recentPending.length === 0 ? (
              <p className="text-gray-400 text-sm">No pending requests.</p>
            ) : (
              <div className="space-y-3">
                {recentPending.map(r => (
                  <div key={r.id} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {r.asset_tag} – {r.asset_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.request_type === 'borrow' ? 'Borrow' : 'Relocation'} by {r.requester_name}
                      </p>
                    </div>
                    <span className="badge-pending">{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Allocations</h2>
            <Link href="/logs" className="text-sm text-blue-600 hover:text-blue-700">View all logs</Link>
          </div>
          {recentAllocations.length === 0 ? (
            <p className="text-gray-400 text-sm">No allocation history yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium pr-4">Asset</th>
                    <th className="pb-2 font-medium pr-4">Allocated To</th>
                    <th className="pb-2 font-medium pr-4">Date</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentAllocations.map(a => (
                    <tr key={a.id}>
                      <td className="py-2.5 pr-4">
                        <Link href={`/asset/${a.asset_id}`} className="font-medium text-blue-600 hover:underline">
                          {a.asset_tag}
                        </Link>
                        <span className="text-gray-500 ml-1">– {a.asset_name}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700">{a.allocated_to}</td>
                      <td className="py-2.5 pr-4 text-gray-500">
                        {new Date(a.allocated_at).toLocaleDateString('en-GB', { timeZone: 'Australia/Darwin' })}
                      </td>
                      <td className="py-2.5">
                        {a.returned_at
                          ? <span className="badge bg-gray-100 text-gray-500">Returned</span>
                          : <span className="badge-allocated">Active</span>}
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
