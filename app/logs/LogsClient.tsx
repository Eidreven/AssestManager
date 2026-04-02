'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AllocationWithDetails, RequestWithDetails } from '@/lib/db'

interface Props {
  allocations: AllocationWithDetails[]
  requests: RequestWithDetails[]
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Darwin' })
}
function formatDateTime(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Darwin',
  })
}

export default function LogsClient({ allocations, requests }: Props) {
  const [tab, setTab] = useState<'allocations' | 'requests'>('allocations')

  const active = allocations.filter(a => !a.returned_at)
  const returned = allocations.filter(a => a.returned_at)

  function downloadLog() {
    const lines: string[] = [
      'MPS Asset Manager — Full Log Export',
      `Exported: ${new Date().toLocaleString('en-GB', { timeZone: 'Australia/Darwin' })}`,
      '='.repeat(70),
      '',
      '── ALLOCATIONS ─────────────────────────────────────────────────────────',
      '',
      ...allocations.map(a =>
        `[${formatDateTime(a.allocated_at)}] ALLOCATED  ${a.asset_tag} → ${a.allocated_to}${a.allocated_to_role ? ` (${a.allocated_to_role})` : ''}` +
        `${a.allocated_by_name ? `  by ${a.allocated_by_name}` : ''}` +
        `${a.returned_at ? `\n  Returned: ${formatDateTime(a.returned_at)}` : '  [Active]'}` +
        `${a.purpose ? `\n  Purpose: ${a.purpose}` : ''}`
      ),
      '',
      '── REQUESTS ────────────────────────────────────────────────────────────',
      '',
      ...requests.map(r =>
        `[${formatDateTime(r.created_at)}] REQUEST    #${r.id} ${r.request_type.toUpperCase()}  ${r.asset_tag ?? ''} — ${r.asset_name ?? ''}` +
        `\n  Requested by: ${r.requester_name}${r.requester_class ? ` (${r.requester_class})` : ''}` +
        `${r.reason ? `\n  Reason: ${r.reason}` : ''}` +
        `\n  Status: ${r.status.toUpperCase()}` +
        `${r.handled_by_name ? `  handled by ${r.handled_by_name} on ${formatDateTime(r.handled_at)}` : ''}` +
        `${r.handler_notes ? `\n  Notes: ${r.handler_notes}` : ''}`
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mps-log-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {active.length} active allocations · {returned.length} returned · {requests.length} requests
          </p>
        </div>
        <button onClick={downloadLog} className="btn-secondary flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Full Log
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([['allocations', `Allocations (${allocations.length})`], ['requests', `Requests (${requests.length})`]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'allocations' && (
        <div className="space-y-6">
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
                        <th className="px-4 py-3 font-medium hidden md:table-cell">Allocated By</th>
                        <th className="px-4 py-3 font-medium">Since</th>
                        <th className="px-4 py-3 font-medium hidden md:table-cell">Expected Return</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {active.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link href={`/asset/${a.asset_id}`} className="font-mono font-medium text-blue-700 hover:underline">{a.asset_tag}</Link>
                            <p className="text-gray-500 text-xs">{a.asset_name}</p>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {a.allocated_to}
                            {a.allocated_to_role && <span className="text-xs text-gray-400 ml-1">({a.allocated_to_role})</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{a.allocated_by_name ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(a.allocated_at)}</td>
                          <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{formatDate(a.expected_return)}</td>
                          <td className="px-4 py-3">
                            {a.is_temporary
                              ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Temporary</span>
                              : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Permanent</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

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
                        <th className="px-4 py-3 font-medium hidden md:table-cell">Allocated By</th>
                        <th className="px-4 py-3 font-medium">From</th>
                        <th className="px-4 py-3 font-medium">Returned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {returned.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50 opacity-80">
                          <td className="px-4 py-3">
                            <Link href={`/asset/${a.asset_id}`} className="font-mono font-medium text-blue-700 hover:underline">{a.asset_tag}</Link>
                            <p className="text-gray-500 text-xs">{a.asset_name}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{a.allocated_to}</td>
                          <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{a.allocated_by_name ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(a.allocated_at)}</td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(a.returned_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="card overflow-hidden">
          {requests.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No requests yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Asset</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Requested By</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Handled By</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map(r => {
                    const statusBadge: Record<string, string> = {
                      pending: 'bg-yellow-100 text-yellow-700',
                      approved: 'bg-green-100 text-green-700',
                      rejected: 'bg-red-100 text-red-700',
                      completed: 'bg-teal-100 text-teal-700',
                    }
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400 text-xs">{r.id}</td>
                        <td className="px-4 py-3">
                          <Link href={`/asset/${r.asset_id}`} className="font-mono font-medium text-blue-700 hover:underline">{r.asset_tag}</Link>
                          <p className="text-gray-400 text-xs">{r.asset_name}</p>
                        </td>
                        <td className="px-4 py-3 capitalize text-gray-700">{r.request_type}</td>
                        <td className="px-4 py-3 text-gray-900">
                          {r.requester_name}
                          {r.requester_class && <span className="text-gray-400 text-xs ml-1">({r.requester_class})</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{r.handled_by_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(r.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
