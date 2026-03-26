import AppShell from '@/components/AppShell'
import { db } from '@/lib/db'
import Link from 'next/link'

export default async function LogsPage() {
  const allocations = await db.getAllAllocations()

  function formatDate(s: string | null) {
    if (!s) return '—'
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const active = allocations.filter(a => !a.returned_at)
  const returned = allocations.filter(a => a.returned_at)

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Allocation Logs</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {active.length} active · {returned.length} returned · {allocations.length} total
          </p>
        </div>

        {/* Active Allocations */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Currently Allocated ({active.length})</h2>
          {active.length === 0 ? (
            <div className="card p-6 text-center text-gray-400 text-sm">No devices currently allocated.</div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">Asset</th>
                      <th className="px-4 py-3 font-medium">Allocated To</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Since</th>
                      <th className="px-4 py-3 font-medium">Expected Return</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {active.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link href={`/asset/${a.asset_id}`} className="font-mono font-medium text-blue-700 hover:underline">
                            {a.asset_tag}
                          </Link>
                          <p className="text-gray-500 text-xs">{a.asset_name}</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{a.allocated_to}</td>
                        <td className="px-4 py-3 text-gray-500">{a.allocated_to_role ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(a.allocated_at)}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(a.expected_return)}</td>
                        <td className="px-4 py-3 text-gray-500">{a.location_name ?? '—'}</td>
                        <td className="px-4 py-3">
                          {a.is_temporary
                            ? <span className="badge bg-amber-100 text-amber-700">Temporary</span>
                            : <span className="badge bg-blue-100 text-blue-700">Permanent</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* History */}
        {returned.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-700 mb-3">Return History ({returned.length})</h2>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">Asset</th>
                      <th className="px-4 py-3 font-medium">Allocated To</th>
                      <th className="px-4 py-3 font-medium">From</th>
                      <th className="px-4 py-3 font-medium">Returned</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {returned.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50 opacity-80">
                        <td className="px-4 py-3">
                          <Link href={`/asset/${a.asset_id}`} className="font-mono font-medium text-blue-700 hover:underline">
                            {a.asset_tag}
                          </Link>
                          <p className="text-gray-500 text-xs">{a.asset_name}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{a.allocated_to}</td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(a.allocated_at)}</td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(a.returned_at)}</td>
                        <td className="px-4 py-3 text-gray-500">{a.location_name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  )
}
