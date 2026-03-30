'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Location { id: number; name: string }
interface Teacher { id: number; name: string; email: string }
interface AssetSet { id: number; name: string; responsible_teacher: string | null; location_id: number | null }

interface Props {
  assetId: number
  assetStatus: string
  allocationId: number | null
  locations: Location[]
  teachers: Teacher[]
  sets: AssetSet[]
  mode: 'allocate' | 'return' | 'request'
}

type AllocTarget = 'teacher' | 'classroom' | 'custom' | 'set'

interface AllocForm {
  target: AllocTarget
  // teacher mode
  teacher_id: string
  // classroom mode
  classroom_id: string
  // custom mode
  custom_name: string
  custom_role: string
  // set mode
  set_id: string
  // shared
  location_id: string
  purpose: string
  is_temporary: boolean
  expected_return: string
  notes: string
}

export default function AssetActions({ assetId, assetStatus, allocationId, locations, teachers, sets, mode }: Props) {
  const router = useRouter()
  const [dialog, setDialog] = useState<null | 'allocate' | 'borrow' | 'relocate'>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const defaultAllocForm: AllocForm = {
    target: sets.length > 0 ? 'set' : teachers.length > 0 ? 'teacher' : 'custom',
    teacher_id: '',
    classroom_id: '',
    custom_name: '',
    custom_role: 'Student',
    set_id: '',
    location_id: '',
    purpose: '',
    is_temporary: false,
    expected_return: '',
    notes: '',
  }
  const [allocForm, setAllocForm] = useState<AllocForm>(defaultAllocForm)

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

    let allocated_to = ''
    let allocated_to_role = ''
    let location_id: number | undefined = undefined
    let set_id: number | undefined = undefined

    if (allocForm.target === 'set') {
      const s = sets.find(s => String(s.id) === allocForm.set_id)
      if (!s) { setError('Please select a class set.'); setLoading(false); return }
      if (!s.responsible_teacher && !s.location_id) {
        setError('This set has no responsible person or location assigned. Edit the set first.')
        setLoading(false); return
      }
      // Use teacher name if set, otherwise fall back to location name
      const loc = s.location_id ? locations.find(l => l.id === s.location_id) : null
      allocated_to = s.responsible_teacher ?? loc?.name ?? 'Class Set'
      allocated_to_role = s.responsible_teacher ? 'Teacher' : 'Location'
      location_id = s.location_id ?? undefined
      set_id = s.id
    } else if (allocForm.target === 'teacher') {
      const t = teachers.find(t => String(t.id) === allocForm.teacher_id)
      if (!t) { setError('Please select a teacher.'); setLoading(false); return }
      allocated_to = t.name
      allocated_to_role = 'Teacher'
      location_id = allocForm.location_id ? Number(allocForm.location_id) : undefined
    } else if (allocForm.target === 'classroom') {
      const loc = locations.find(l => String(l.id) === allocForm.classroom_id)
      if (!loc) { setError('Please select a classroom.'); setLoading(false); return }
      allocated_to = loc.name
      allocated_to_role = 'Classroom'
      location_id = Number(allocForm.classroom_id)
    } else {
      if (!allocForm.custom_name.trim()) { setError('Please enter a name.'); setLoading(false); return }
      allocated_to = allocForm.custom_name.trim()
      allocated_to_role = allocForm.custom_role
      location_id = allocForm.location_id ? Number(allocForm.location_id) : undefined
    }

    try {
      const res = await fetch(`/api/assets/${assetId}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocated_to,
          allocated_to_role,
          location_id,
          set_id,
          purpose: allocForm.target === 'set'
            ? `Class set: ${sets.find(s => String(s.id) === allocForm.set_id)?.name}`
            : allocForm.purpose || undefined,
          is_temporary: allocForm.is_temporary,
          expected_return: allocForm.expected_return || undefined,
          notes: allocForm.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setDialog(null)
      setAllocForm(defaultAllocForm)
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

  function updateAlloc<K extends keyof AllocForm>(key: K, value: AllocForm[K]) {
    setAllocForm(f => ({ ...f, [key]: value }))
  }
  function updateReq(key: string, value: string) { setReqForm(f => ({ ...f, [key]: value })) }

  if (mode === 'return') {
    return (
      <div className="flex gap-2">
        <button onClick={() => { setDialog('allocate'); setAllocForm(defaultAllocForm) }} className="btn-primary text-xs px-3 py-1.5">
          Re-Assign
        </button>
        <button onClick={handleReturn} disabled={loading} className="btn-secondary text-xs px-3 py-1.5">
          Mark Returned
        </button>
        {dialog === 'allocate' && (
          <AllocateDialog form={allocForm} update={updateAlloc} locations={locations} teachers={teachers} sets={sets}
            onSubmit={handleAllocate} onClose={() => setDialog(null)} loading={loading} error={error} />
        )}
      </div>
    )
  }

  if (mode === 'allocate') {
    return (
      <>
        <button onClick={() => { setDialog('allocate'); setAllocForm(defaultAllocForm) }} className="btn-primary text-xs px-3 py-1.5">
          Allocate Device
        </button>
        {dialog === 'allocate' && (
          <AllocateDialog form={allocForm} update={updateAlloc} locations={locations} teachers={teachers} sets={sets}
            onSubmit={handleAllocate} onClose={() => setDialog(null)} loading={loading} error={error} />
        )}
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

      {dialog === 'borrow' && (
        <RequestDialog title="Request Temporary Borrow" form={reqForm} update={updateReq} locations={locations}
          showDuration showLocation={false} onSubmit={() => handleRequest('borrow')}
          onClose={() => setDialog(null)} loading={loading} error={error} />
      )}
      {dialog === 'relocate' && (
        <RequestDialog title="Request Relocation" form={reqForm} update={updateReq} locations={locations}
          showDuration={false} showLocation onSubmit={() => handleRequest('relocate')}
          onClose={() => setDialog(null)} loading={loading} error={error} />
      )}
    </div>
  )
}

// ── Modal shell ─────────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
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

// ── Allocate dialog ─────────────────────────────────────────────────────────────

function AllocateDialog({ form, update, locations, teachers, sets, onSubmit, onClose, loading, error }: {
  form: AllocForm
  update: <K extends keyof AllocForm>(k: K, v: AllocForm[K]) => void
  locations: Location[]
  teachers: Teacher[]
  sets: AssetSet[]
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  loading: boolean
  error: string
}) {
  return (
    <Modal title="Allocate Device" onClose={onClose}>
      <form onSubmit={onSubmit} className="p-5 space-y-5">
        {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{error}</div>}

        {/* Who to allocate to */}
        <div>
          <label className="label mb-2">Allocate to</label>
          <div className="grid grid-cols-2 gap-2">
            {sets.length > 0 && (
              <button type="button"
                onClick={() => update('target', 'set')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                  form.target === 'set' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="text-xl">📦</span>
                Class Set
              </button>
            )}
            {teachers.length > 0 && (
              <button type="button"
                onClick={() => update('target', 'teacher')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                  form.target === 'teacher' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="text-xl">👩‍🏫</span>
                Teacher
              </button>
            )}
            <button type="button"
              onClick={() => update('target', 'classroom')}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                form.target === 'classroom' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">🏫</span>
              Classroom
            </button>
            <button type="button"
              onClick={() => update('target', 'custom')}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                form.target === 'custom' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">🙋</span>
              Other
            </button>
          </div>
        </div>

        {/* Class Set picker */}
        {form.target === 'set' && (
          <div>
            <label className="label">Class Set *</label>
            <select className="input" value={form.set_id} onChange={e => update('set_id', e.target.value)} required>
              <option value="">— Select class set —</option>
              {sets.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.responsible_teacher ? ` — ${s.responsible_teacher}` : ''}
                </option>
              ))}
            </select>
            {form.set_id && (() => {
              const s = sets.find(s => String(s.id) === form.set_id)
              const label = s?.responsible_teacher
                ?? (s?.location_id ? locations.find(l => l.id === s.location_id)?.name : null)
              return label ? (
                <p className="text-xs text-gray-400 mt-1">Will be allocated to {label}</p>
              ) : null
            })()}
          </div>
        )}

        {/* Teacher picker */}
        {form.target === 'teacher' && (
          <div>
            <label className="label">Teacher *</label>
            <select className="input" value={form.teacher_id} onChange={e => update('teacher_id', e.target.value)} required>
              <option value="">— Select teacher —</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        {/* Classroom picker */}
        {form.target === 'classroom' && (
          <div>
            <label className="label">Classroom / Location *</label>
            <select className="input" value={form.classroom_id} onChange={e => update('classroom_id', e.target.value)} required>
              <option value="">— Select location —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}

        {/* Custom person */}
        {form.target === 'custom' && (
          <div className="space-y-3">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.custom_name} onChange={e => update('custom_name', e.target.value)}
                placeholder="e.g. John Smith" required />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.custom_role} onChange={e => update('custom_role', e.target.value)}>
                <option>Student</option>
                <option>Teacher</option>
                <option>Staff</option>
                <option>Visitor</option>
                <option>Other</option>
              </select>
            </div>
          </div>
        )}

        {/* Location (for teacher / custom only — set uses set's location, classroom is its own location) */}
        {(form.target === 'teacher' || form.target === 'custom') && (
          <div>
            <label className="label">Location</label>
            <select className="input" value={form.location_id} onChange={e => update('location_id', e.target.value)}>
              <option value="">— None —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="label">Purpose</label>
          <input className="input" value={form.purpose} onChange={e => update('purpose', e.target.value)}
            placeholder="e.g. Class teaching, shared pool" />
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

// ── Request dialog ──────────────────────────────────────────────────────────────

function RequestDialog({ title, form, update, locations, showDuration, showLocation, onSubmit, onClose, loading, error }: {
  title: string
  form: { requester_name: string; requester_email: string; requester_class: string; to_location_id: string; reason: string; duration: string }
  update: (k: string, v: string) => void
  locations: Location[]
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
          <button className="btn-primary flex-1" disabled={loading || !form.requester_name} onClick={onSubmit}>
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  )
}
