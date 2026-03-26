'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Request {
  id: number
  asset_id: number
  asset_tag: string | null
  asset_name: string | null
  asset_type: string | null
  request_type: string
  priority: string
  requester_name: string
  requester_email: string | null
  requester_phone: string | null
  requester_class: string | null
  from_location_name: string | null
  to_location_name: string | null
  reason: string | null
  duration: string | null
  status: string
  handler_notes: string | null
  handled_by_name: string | null
  handled_at: string | null
  created_at: string
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700 font-bold',
}

const TYPE_STYLES: Record<string, { badge: string; label: string }> = {
  borrow: { badge: 'bg-amber-100 text-amber-800', label: '⏱ Borrow' },
  relocate: { badge: 'bg-purple-100 text-purple-800', label: '📍 Relocate' },
  issue: { badge: 'bg-red-100 text-red-800', label: '⚠️ Issue' },
}

const STATUS_TABS = ['all', 'pending', 'approved', 'rejected', 'completed']

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [tab, setTab] = useState<string>('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [handlerNotes, setHandlerNotes] = useState<Record<number, string>>({})

  useEffect(() => {
    fetch('/api/requests')
      .then(r => r.json())
      .then(data => { setRequests(data); setLoading(false) })
  }, [])

  async function handle(id: number, status: string) {
    setActionLoading(id)
    try {
      await fetch(`/api/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, handler_notes: handlerNotes[id] ?? '' }),
      })
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    } finally {
      setActionLoading(null)
    }
  }

  function formatDate(s: string) {
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const filtered = tab === 'all' ? requests : requests.filter(r => r.status === tab)
  const counts: Record<string, number> = {}
  STATUS_TABS.forEach(s => { counts[s] = s === 'all' ? requests.length : requests.filter(r => r.status === s).length })

  return (
    <div>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Requests</h1>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map(s => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                tab === s ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {counts[s] > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-xs ${
                  tab === s ? 'bg-blue-600 text-white' : s === 'pending' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
                }`}>{counts[s]}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-12">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">No requests found.</div>
        ) : (
          <div className="space-y-4">
            {filtered.map(r => (
              <div key={r.id} className="card p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`badge ${(TYPE_STYLES[r.request_type] ?? TYPE_STYLES.borrow).badge}`}>
                        {(TYPE_STYLES[r.request_type] ?? TYPE_STYLES.borrow).label}
                      </span>
                      <span className={`badge ${PRIORITY_STYLES[r.priority] ?? PRIORITY_STYLES.medium}`}>
                        {r.priority?.toUpperCase() ?? 'MEDIUM'}
                      </span>
                      <span className={`badge-${r.status}`}>{r.status}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/asset/${r.asset_id}`} className="font-mono font-medium text-blue-700 hover:underline text-sm">
                        {r.asset_tag}
                      </Link>
                      <span className="text-gray-500 text-sm">— {r.asset_name} ({r.asset_type})</span>
                    </div>

                    <div className="mt-2 text-sm text-gray-700 space-y-1">
                      <p><span className="text-gray-400">From:</span> {r.requester_name}{r.requester_class ? ` · ${r.requester_class}` : ''}{r.requester_email ? ` · ${r.requester_email}` : ''}{r.requester_phone ? ` · 📞 ${r.requester_phone}` : ''}</p>
                      {r.to_location_name && <p><span className="text-gray-400">To:</span> {r.to_location_name}</p>}
                      {r.duration && <p><span className="text-gray-400">Duration:</span> {r.duration}</p>}
                      {r.reason && <p><span className="text-gray-400">Reason:</span> {r.reason}</p>}
                      <p className="text-gray-400 text-xs">{formatDate(r.created_at)}</p>
                    </div>

                    {r.handler_notes && (
                      <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                        <span className="font-medium">Admin note:</span> {r.handler_notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {r.status === 'pending' && (
                    <div className="flex flex-col gap-2 min-w-48">
                      <textarea
                        placeholder="Optional note…"
                        value={handlerNotes[r.id] ?? ''}
                        onChange={e => setHandlerNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                        className="input resize-none text-xs"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handle(r.id, 'approved')}
                          disabled={actionLoading === r.id}
                          className="btn-success flex-1 text-xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handle(r.id, 'rejected')}
                          disabled={actionLoading === r.id}
                          className="btn-danger flex-1 text-xs"
                        >
                          Reject
                        </button>
                      </div>
                      <button
                        onClick={() => handle(r.id, 'completed')}
                        disabled={actionLoading === r.id}
                        className="btn-secondary text-xs"
                      >
                        Mark Completed
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
