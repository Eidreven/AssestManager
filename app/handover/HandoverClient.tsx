'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'

interface Session {
  id: number
  title: string
  notes: string | null
  status: 'draft' | 'sent' | 'closed'
  created_by_name: string | null
  created_at: string
  sent_at: string | null
  closed_at: string | null
  total_items: number
  pending_items: number
  collected_items: number
  missing_items: number
  damaged_items: number
}

interface Item {
  id: number
  session_id: number
  asset_id: number
  set_id: number | null
  holder_name: string
  holder_email: string | null
  status: 'pending' | 'collected' | 'missing' | 'damaged'
  admin_notes: string | null
  asset_tag: string | null
  asset_name: string | null
  asset_type: string | null
  set_name: string | null
  location_name: string | null
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  closed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-800',
  collected: 'bg-green-100 text-green-800',
  missing: 'bg-red-100 text-red-800',
  damaged: 'bg-amber-100 text-amber-800',
}

const REVISION_STATUSES = ['pending', 'missing', 'damaged'] as const

export default function HandoverClient({ initialSessions }: { initialSessions: Session[] }) {
  const [sessions, setSessions] = useState(initialSessions)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({})
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const groupedItems = useMemo(() => {
    const groups = new Map<string, Item[]>()
    for (const item of items) {
      const label = item.set_name ? `${item.holder_name} - ${item.set_name}` : item.holder_name
      groups.set(label, [...(groups.get(label) ?? []), item])
    }
    return Array.from(groups.entries())
  }, [items])

  function formatDate(value: string | null) {
    if (!value) return '-'
    return new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Australia/Darwin',
    })
  }

  async function refreshSessions() {
    const res = await fetch('/api/handover')
    if (res.ok) setSessions(await res.json())
  }

  async function openSession(session: Session) {
    setLoading(true); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/handover/${session.id}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not load handover session'); return }
      setSelectedSession(data.session)
      setItems(data.items)
      setItemNotes(Object.fromEntries((data.items as Item[]).map(item => [item.id, item.admin_notes ?? ''])))
      setSelectedItems({})
    } finally {
      setLoading(false)
    }
  }

  async function createSession(e: FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')
    try {
      const res = await fetch('/api/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, notes }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not create handover'); return }
      setTitle(''); setNotes('')
      await refreshSessions()
      setMessage('Handover session created from current allocations.')
    } finally {
      setLoading(false)
    }
  }

  async function sessionAction(action: 'send' | 'remind' | 'close') {
    if (!selectedSession) return
    setLoading(true); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/handover/${selectedSession.id}/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Action failed'); return }
      await refreshSessions()
      await openSession(selectedSession)
      if (action === 'send') setMessage(`Handover emails sent to ${data.emailsSent ?? 0} holder(s).`)
      if (action === 'remind') setMessage(`Reminder sent for ${data.outstanding ?? 0} outstanding item(s).`)
      if (action === 'close') setMessage('Handover session closed.')
    } finally {
      setLoading(false)
    }
  }

  async function updateItem(item: Item, status: Item['status']) {
    setLoading(true); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/handover/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: itemNotes[item.id] ?? '' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not update item'); return }
      setItems(prev => prev.map(row => row.id === item.id ? data : row))
      setSelectedItems(prev => ({ ...prev, [item.id]: false }))
      await refreshSessions()
      if (selectedSession) await openSession(selectedSession)
      setMessage(status === 'pending' ? 'Collection revised. Device is pending again.' : `Device marked as ${status}.`)
    } finally {
      setLoading(false)
    }
  }

  function selectableItemsFor(groupItems: Item[]) {
    return groupItems.filter(item => item.status !== 'collected')
  }

  function selectedIdsFor(groupItems: Item[]) {
    return selectableItemsFor(groupItems)
      .filter(item => selectedItems[item.id])
      .map(item => item.id)
  }

  function setGroupSelection(groupItems: Item[], checked: boolean) {
    const selectable = selectableItemsFor(groupItems)
    setSelectedItems(prev => {
      const next = { ...prev }
      for (const item of selectable) next[item.id] = checked
      return next
    })
  }

  async function collectSelected(groupItems: Item[]) {
    if (!selectedSession) return
    const itemIds = selectedIdsFor(groupItems)
    if (itemIds.length === 0) return

    setLoading(true); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/handover/${selectedSession.id}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: itemIds }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not collect selected devices'); return }
      await refreshSessions()
      await openSession(selectedSession)
      setSelectedItems(prev => {
        const next = { ...prev }
        for (const id of itemIds) delete next[id]
        return next
      })
      setMessage(`Collected ${data.collected ?? itemIds.length} device(s) and sent one summary email.`)
    } finally {
      setLoading(false)
    }
  }

  async function removeItem(item: Item) {
    if (!selectedSession) return
    if (!confirm(`Remove ${item.asset_tag} from this handover session?`)) return
    setLoading(true); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/handover/items/${item.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not remove item'); return }
      setItems(prev => prev.filter(row => row.id !== item.id))
      await refreshSessions()
      setMessage('Device removed from handover session.')
    } finally {
      setLoading(false)
    }
  }

  async function removeSet(groupItems: Item[]) {
    if (!selectedSession) return
    const setId = groupItems[0]?.set_id
    const setName = groupItems[0]?.set_name
    if (!setId || !setName) return
    if (!confirm(`Remove the full set "${setName}" from this handover session?`)) return
    setLoading(true); setError(''); setMessage('')
    try {
      const res = await fetch(`/api/handover/${selectedSession.id}/sets/${setId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not remove set'); return }
      setItems(prev => prev.filter(row => row.set_id !== setId))
      await refreshSessions()
      setMessage(`${setName} removed from handover session.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">End of Term Handover</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manual collection checklist and email reminders for allocated devices.</p>
        </div>
        <Link href="/assets?status=allocated" className="btn-secondary text-sm">Allocated Assets</Link>
      </div>

      {message && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{message}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Create Handover</h2>
            <form onSubmit={createSession} className="space-y-3">
              <div>
                <label className="label">Title</label>
                <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Term 2 2026 Collection" required />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <button className="btn-primary w-full" disabled={loading}>{loading ? 'Creating...' : 'Create From Current Allocations'}</button>
            </form>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Sessions</h2>
            </div>
            {sessions.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">No handover sessions yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => openSession(session)}
                    className={`w-full text-left p-4 hover:bg-gray-50 ${selectedSession?.id === session.id ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-gray-900 truncate">{session.title}</p>
                      <span className={`badge ${STATUS_STYLES[session.status]}`}>{session.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{session.total_items} item(s) · {formatDate(session.created_at)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {!selectedSession ? (
            <div className="card p-12 text-center text-gray-400">Select a handover session.</div>
          ) : (
            <>
              <div className="card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-gray-900 text-lg">{selectedSession.title}</h2>
                    <p className="text-sm text-gray-500">{selectedSession.notes || 'No notes.'}</p>
                    <div className="flex flex-wrap gap-2 mt-3 text-xs">
                      <span className="badge bg-gray-100 text-gray-700">Total {selectedSession.total_items}</span>
                      <span className="badge bg-green-100 text-green-700">Collected {selectedSession.collected_items}</span>
                      <span className="badge bg-yellow-100 text-yellow-800">Pending {selectedSession.pending_items}</span>
                      <span className="badge bg-red-100 text-red-800">Missing {selectedSession.missing_items}</span>
                      <span className="badge bg-amber-100 text-amber-800">Damaged {selectedSession.damaged_items}</span>
                    </div>
                  </div>
                  <span className={`badge ${STATUS_STYLES[selectedSession.status]}`}>{selectedSession.status}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => sessionAction('send')} className="btn-primary text-sm" disabled={loading || selectedSession.status === 'closed'}>Send Handover Emails</button>
                  <button onClick={() => sessionAction('remind')} className="btn-warning text-sm" disabled={loading || selectedSession.status === 'closed'}>Send Missing Reminders</button>
                  <button onClick={() => sessionAction('close')} className="btn-secondary text-sm" disabled={loading || selectedSession.status === 'closed'}>Close Session</button>
                </div>
              </div>

              {groupedItems.map(([group, groupItems]) => (
                <div key={group} className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{group}</h3>
                      <p className="text-xs text-gray-500">{groupItems[0]?.holder_email || 'No email on account'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setGroupSelection(groupItems, true)}
                        disabled={loading || selectedSession.status === 'closed' || selectableItemsFor(groupItems).length === 0}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        Select Open
                      </button>
                      <button
                        type="button"
                        onClick={() => setGroupSelection(groupItems, false)}
                        disabled={loading || selectedSession.status === 'closed' || selectedIdsFor(groupItems).length === 0}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => collectSelected(groupItems)}
                        disabled={loading || selectedSession.status === 'closed' || selectedIdsFor(groupItems).length === 0}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        Collect Selected ({selectedIdsFor(groupItems).length})
                      </button>
                      {groupItems[0]?.set_id && (
                        <button
                          type="button"
                          onClick={() => removeSet(groupItems)}
                          disabled={loading || selectedSession.status === 'closed'}
                          className="btn-secondary text-xs px-3 py-1.5"
                        >
                          Remove Set
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-white border-b border-gray-100 text-xs text-gray-500">
                    Tick the devices being handed over, then collect them together. Use Pending, Missing, or Damaged below to revise a wrong selection.
                  </div>
                  <div className="divide-y divide-gray-100">
                    {groupItems.map(item => (
                      <div key={item.id} className="p-4 grid lg:grid-cols-[1fr_210px] gap-4">
                        <div className="min-w-0">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-600 disabled:opacity-50"
                              checked={Boolean(selectedItems[item.id])}
                              disabled={loading || selectedSession.status === 'closed' || item.status === 'collected'}
                              onChange={e => setSelectedItems(prev => ({ ...prev, [item.id]: e.target.checked }))}
                              aria-label={`Select ${item.asset_tag ?? item.asset_name}`}
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-blue-700 text-sm">{item.asset_tag}</span>
                                <span className={`badge ${STATUS_STYLES[item.status]}`}>{item.status}</span>
                              </div>
                              <p className="font-medium text-gray-900 mt-1">{item.asset_name}</p>
                              <p className="text-xs text-gray-500">{item.asset_type}{item.set_name ? ` · ${item.set_name}` : ''}{item.location_name ? ` · ${item.location_name}` : ''}</p>
                            </div>
                          </div>
                          <textarea
                            className="input resize-none mt-3"
                            rows={2}
                            placeholder="Collection note..."
                            value={itemNotes[item.id] ?? ''}
                            onChange={e => setItemNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2 content-start">
                          {REVISION_STATUSES.map(status => (
                            <button
                              key={status}
                              onClick={() => updateItem(item, status)}
                              disabled={loading || selectedSession.status === 'closed'}
                              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                                item.status === status
                                  ? 'bg-blue-700 text-white border-blue-700'
                                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => removeItem(item)}
                            disabled={loading || selectedSession.status === 'closed'}
                            className="col-span-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            Remove Device
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
