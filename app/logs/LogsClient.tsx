'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AllocationWithDetails, ActivityLog } from '@/lib/db'

interface Props {
  allocations: AllocationWithDetails[]
  activityLogs: ActivityLog[]
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatDateTime(s: string) {
  return new Date(s).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const ACTION_LABEL: Record<string, string> = {
  login: 'Login',
  create_asset: 'Asset registered',
  allocate: 'Allocated',
  return: 'Returned',
  request_approved: 'Request approved',
  request_rejected: 'Request rejected',
  request_completed: 'Request completed',
  status_changed: 'Status changed',
}
const ACTION_BADGE: Record<string, string> = {
  login: 'bg-blue-100 text-blue-700',
  create_asset: 'bg-purple-100 text-purple-700',
  allocate: 'bg-indigo-100 text-indigo-700',
  return: 'bg-green-100 text-green-700',
  request_approved: 'bg-green-100 text-green-700',
  request_rejected: 'bg-red-100 text-red-700',
  request_completed: 'bg-teal-100 text-teal-700',
  status_changed: 'bg-amber-100 text-amber-700',
}

export default function LogsClient({ allocations, activityLogs }: Props) {
  const [tab, setTab] = useState<'activity' | 'allocations'>('activity')

  const active = allocations.filter(a => !a.returned_at)
  const returned = allocations.filter(a => a.returned_at)

  function exportActivityLog() {
    const lines = [
      'MPS Asset Manager — Activity Log Export',
      `Exported: ${new Date().toLocaleString('en-GB')}`,
      `Total entries: ${activityLogs.length}`,
      '='.repeat(60),
      '',
      ...activityLogs.map(log =>
        `[${formatDateTime(log.created_at)}] ${log.user_name} — ${ACTION_LABEL[log.action] ?? log.action}${log.detail ? `: ${log.detail}` : ''}`
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {activityLogs.length} activity entries · {active.length} active allocations · {returned.length} returned
          </p>
        </div>
        {tab === 'activity' && activityLogs.length > 0 && (
          <button onClick={exportActivityLog} className="btn-secondary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export as Text
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([['activity', 'Activity Log'], ['allocations', 'Allocation Log']] as const).map(([key, label]) => (
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

      {tab === 'activity' && (
        <div className="card overflow-hidden">
          {activityLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No activity recorded yet. Logs appear here after users sign in and perform actions.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Detail</th>
                    <th className="px-4 py-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activityLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{log.user_name}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_BADGE[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                          {ACTION_LABEL[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell max-w-xs truncate">{log.detail ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            Logs older than 30 days are automatically removed. Use "Export as Text" to save a copy before they expire.
          </div>
        </div>
      )}

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
                        <th className="px-4 py-3 font-medium hidden md:table-cell">Role</th>
                        <th className="px-4 py-3 font-medium">Since</th>
                        <th className="px-4 py-3 font-medium hidden md:table-cell">Expected Return</th>
                        <th className="px-4 py-3 font-medium hidden lg:table-cell">Location</th>
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
                          <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{a.allocated_to_role ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(a.allocated_at)}</td>
                          <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{formatDate(a.expected_return)}</td>
                          <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{a.location_name ?? '—'}</td>
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
                        <th className="px-4 py-3 font-medium">From</th>
                        <th className="px-4 py-3 font-medium">Returned</th>
                        <th className="px-4 py-3 font-medium hidden md:table-cell">Location</th>
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
                          <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{a.location_name ?? '—'}</td>
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
    </div>
  )
}
