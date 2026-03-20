'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Location { id: number; name: string }

interface Props {
  assetId: number
  assetStatus: string
  allocationId: number | null
  locations: Location[]
  mode: 'allocate' | 'return' | 'request'
}

export default function AssetActions({ assetId, assetStatus, allocationId, locations, mode }: Props) {
  const router = useRouter()
  const [dialog, setDialog] = useState<null | 'allocate' | 'borrow' | 'relocate'>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Allocate form
  const [allocForm, setAllocForm] = useState({
    allocated_to: '', allocated_to_role: '', location_id: '', purpose: '', expected_return: '', notes: '', is_temporary: false,
  })

  // Request form
  const [reqForm, setReqForm] = useState({
    requester_name: '', requester_email: '', requester_class: '',
    to_location_id: '', reason: '', duration: '',
  })

  async function handleReturn() {
    if (!confirm('Mark this device as returned?')) return
    setLoading(true)
    try {
      await fetch(`/api/assets/${assetId}/allocate`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleAllocate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/assets/${assetId}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...allocForm, location_id: allocForm.location_id || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setDialog(null)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleRequest(type: 'borrow' | 'relocate') {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: assetId,
          request_type: type,
          requester_name: reqForm.requester_name,
          requester_email: reqForm.requester_email || undefined,
          requester_class: reqForm.requester_class || undefined,
          to_location_id: reqForm.to_location_id ? Number(reqForm.to_location_id) : undefined,
          reason: reqForm.reason || undefined,
          duration: type === 'borrow' ? (reqForm.duration || undefined) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setSuccess('Request submitted! A staff member will review it shortly.')
      setDialog(null)
      setReqForm({ requester_name: '', requester_email: '', requester_class: '', to_location_id: '', reason: '', duration: '' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  function updateReq(key: string, value: string) { setReqForm(f => ({ ...f, [key]: value })) }
  function updateAlloc(key: string, value: string | boolean) { setAllocForm(f => ({ ...f, [key]: value })) }

  if (mode === 'return') {
    return (
      <div className="flex gap-2">
        <button onClick={() => { setDialog('allocate'); setAllocForm(f => ({ ...f, is_temporary: false })) }} className="btn-primary text-xs px-3 py-1.5">
          Re-Assign
        </button>
        <button onClick={handleReturn} disabled={loading} className="btn-secondary text-xs px-3 py-1.5">
          Mark Returned
        </button>
        {dialog === 'allocate' && <AllocateDialog form={allocForm} update={updateAlloc} locations={locations} onSubmit={handleAllocate} onClose={() => setDialog(null)} loading={loading} error={error} />}
      </div>
    )
  }

  if (mode === 'allocate') {
    return (
      <>
        <button onClick={() => setDialog('allocate')} className="btn-primary text-xs px-3 py-1.5">
          Allocate Device
        </button>
        {dialog === 'allocate' && <AllocateDialog form={allocForm} update={updateAlloc} locations={locations} onSubmit={handleAllocate} onClose={() => setDialog(null)} loading={loading} error={error} />}
      </>
    )
  }

  // mode === 'request'
  return (
    <div className="space-y-3">
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => { setDialog('borrow'); setSuccess(''); setError('') }}
          className="btn-warning flex-1 sm:flex-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Request Temporary Borrow
        </button>
        <button
          onClick={() => { setDialog('relocate'); setSuccess(''); setError('') }}
          className="btn-secondary flex-1 sm:flex-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Request Relocation
        </button>
      </div>

      {/* Borrow dialog */}
      {dialog === 'borrow' && (
        <RequestDialog
          title="Request Temporary Borrow"
          form={reqForm}
          update={updateReq}
          locations={locations}
          showDuration
          showLocation={false}
          onSubmit={() => handleRequest('borrow')}
          onClose={() => setDialog(null)}
          loading={loading}
          error={error}
        />
      )}

      {/* Relocate dialog */}
      {dialog === 'relocate' && (
        <RequestDialog
          title="Request Relocation"
          form={reqForm}
          update={updateReq}
          locations={locations}
          showDuration={false}
          showLocation
          onSubmit={() => handleRequest('relocate')}
          onClose={() => setDialog(null)}
          loading={loading}
          error={error}
        />
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AllocateDialog({ form, update, locations, onSubmit, onClose, loading, error }: {
  form: { allocated_to: string; allocated_to_role: string; location_id: string; purpose: string; expected_return: string; notes: string; is_temporary: boolean }
  update: (k: string, v: string | boolean) => void
  locations: { id: number; name: string }[]
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  loading: boolean
  error: string
}) {
  return (
    <Modal title="Allocate Device" onClose={onClose}>
      <form onSubmit={onSubmit} className="p-5 space-y-4">
        {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{error}</div>}
        <div>
          <label className="label">Allocated To *</label>
          <input className="input" value={form.allocated_to} onChange={e => update('allocated_to', e.target.value)} placeholder="Full name" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.allocated_to_role} onChange={e => update('allocated_to_role', e.target.value)}>
              <option value="">— Select —</option>
              <option>Teacher</option><option>Student</option><option>Staff</option><option>Other</option>
            </select>
          </div>
          <div>
            <label className="label">Location</label>
            <select className="input" value={form.location_id} onChange={e => update('location_id', e.target.value)}>
              <option value="">— None —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Purpose</label>
          <input className="input" value={form.purpose} onChange={e => update('purpose', e.target.value)} placeholder="e.g. Class teaching" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="tmp" checked={form.is_temporary}
            onChange={e => update('is_temporary', e.target.checked)} className="rounded text-blue-600" />
          <label htmlFor="tmp" className="text-sm text-gray-700">Temporary allocation</label>
        </div>
        {form.is_temporary && (
          <div>
            <label className="label">Expected Return Date</label>
            <input type="date" className="input" value={form.expected_return} onChange={e => update('expected_return', e.target.value)} />
          </div>
        )}
        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => update('notes', e.target.value)} />
        </div>
        <div className="flex gap-3 pt-1">
          <button type="submit" className="btn-primary flex-1" disabled={loading}>{loading ? 'Saving…' : 'Allocate'}</button>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

function RequestDialog({ title, form, update, locations, showDuration, showLocation, onSubmit, onClose, loading, error }: {
  title: string
  form: { requester_name: string; requester_email: string; requester_class: string; to_location_id: string; reason: string; duration: string }
  update: (k: string, v: string) => void
  locations: { id: number; name: string }[]
  showDuration: boolean
  showLocation: boolean
  onSubmit: () => void
  onClose: () => void
  loading: boolean
  error: string
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="p-5 space-y-4">
        {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{error}</div>}
        <div>
          <label className="label">Your Name *</label>
          <input className="input" value={form.requester_name} onChange={e => update('requester_name', e.target.value)} placeholder="Full name" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.requester_email} onChange={e => update('requester_email', e.target.value)} placeholder="you@school.sch" />
          </div>
          <div>
            <label className="label">Class / Dept</label>
            <input className="input" value={form.requester_class} onChange={e => update('requester_class', e.target.value)} placeholder="e.g. Year 3" />
          </div>
        </div>
        {showLocation && (
          <div>
            <label className="label">Move To Location</label>
            <select className="input" value={form.to_location_id} onChange={e => update('to_location_id', e.target.value)}>
              <option value="">— Select destination —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}
        {showDuration && (
          <div>
            <label className="label">Duration Needed</label>
            <input className="input" value={form.duration} onChange={e => update('duration', e.target.value)} placeholder="e.g. 2 days, 1 week" />
          </div>
        )}
        <div>
          <label className="label">Reason / Notes</label>
          <textarea className="input resize-none" rows={3} value={form.reason} onChange={e => update('reason', e.target.value)} placeholder="Please describe why you need this device…" />
        </div>
        <div className="flex gap-3 pt-1">
          <button
            className="btn-primary flex-1"
            disabled={loading || !form.requester_name}
            onClick={onSubmit}
          >
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  )
}
