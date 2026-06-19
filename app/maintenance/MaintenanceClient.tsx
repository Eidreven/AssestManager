'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

interface Job {
  id: number
  asset_id: number
  request_id: number | null
  reported_by_name: string | null
  reported_by_email: string | null
  fault_description: string | null
  priority: string
  status: 'approved' | 'in_progress' | 'on_hold' | 'completed'
  started_at: string | null
  held_at: string | null
  completed_at: string | null
  latest_note: string | null
  resolution_note: string | null
  asset_name: string | null
  asset_tag: string | null
  asset_type: string | null
  location_name: string | null
  set_name: string | null
  assigned_to_id: number | null
  assigned_to_name: string | null
  assigned_to_email: string | null
  approved_by_name: string | null
  return_location_name: string | null
  return_set_name: string | null
  previous_state_json: string | null
  created_at: string
  updated_at: string
}

interface User { id: number; name: string; email: string; role: string }
interface Location { id: number; name: string }
interface AssetSet { id: number; name: string; responsible_teacher: string | null; location_id: number | null }

const STATUS_TABS = ['all', 'approved', 'in_progress', 'on_hold', 'completed']
const STATUS_LABELS: Record<string, string> = {
  approved: 'Approved',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
}
const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700 font-bold',
}

export default function MaintenanceClient({
  initialJobs,
  users,
  locations,
  sets,
  canManage,
}: {
  initialJobs: Job[]
  users: User[]
  locations: Location[]
  sets: AssetSet[]
  canManage: boolean
}) {
  const [jobs, setJobs] = useState(initialJobs)
  const [tab, setTab] = useState('all')
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [assignees, setAssignees] = useState<Record<number, string>>({})
  const [completeOptions, setCompleteOptions] = useState<Record<number, { mode: 'previous' | 'location' | 'set'; locationId: string; setId: string }>>({})
  const [error, setError] = useState('')

  const filtered = tab === 'all' ? jobs : jobs.filter(j => j.status === tab)
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    STATUS_TABS.forEach(s => { map[s] = s === 'all' ? jobs.length : jobs.filter(j => j.status === s).length })
    return map
  }, [jobs])

  function optionFor(id: number) {
    const job = jobs.find(j => j.id === id)
    return completeOptions[id] ?? { mode: job?.previous_state_json ? 'previous' as const : 'location' as const, locationId: '', setId: '' }
  }

  function setOption(id: number, patch: Partial<{ mode: 'previous' | 'location' | 'set'; locationId: string; setId: string }>) {
    setCompleteOptions(prev => ({ ...prev, [id]: { ...optionFor(id), ...patch } }))
  }

  function formatDate(value: string | null) {
    if (!value) return 'Not yet'
    return new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'Australia/Darwin',
    })
  }

  async function refresh() {
    const res = await fetch('/api/maintenance')
    if (!res.ok) throw new Error('Failed to reload maintenance jobs')
    setJobs(await res.json())
  }

  async function runAction(job: Job, action: string) {
    setLoadingId(job.id); setError('')
    try {
      const option = optionFor(job.id)
      const body: Record<string, unknown> = {
        action,
        note: notes[job.id] ?? '',
      }
      const assignedTo = assignees[job.id]
      if (assignedTo) body.assigned_to_id = Number(assignedTo)
      if (action === 'complete') {
        body.return_mode = option.mode
        if (option.mode === 'location') body.location_id = Number(option.locationId)
        if (option.mode === 'set') body.set_id = Number(option.setId)
      }
      const res = await fetch(`/api/maintenance/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Action failed')
        return
      }
      await refresh()
      setNotes(prev => ({ ...prev, [job.id]: '' }))
    } catch {
      setError('Could not update maintenance job. Please try again.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {canManage ? 'Track approved fault reports through repair and return.' : 'View maintenance status for devices assigned to you or reported by you.'}
          </p>
        </div>
        <Link href="/requests" className="btn-secondary text-sm">View Requests</Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(s => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              tab === s ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
            {counts[s] > 0 && (
              <span className={`ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-xs ${
                tab === s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>{counts[s]}</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">No maintenance jobs found.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map(job => {
            const option = optionFor(job.id)
            return (
              <div key={job.id} className="card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`badge-${job.status}`}>{STATUS_LABELS[job.status]}</span>
                      <span className={`badge ${PRIORITY_STYLES[job.priority] ?? PRIORITY_STYLES.medium}`}>
                        {job.priority.toUpperCase()}
                      </span>
                      {job.assigned_to_name && <span className="badge bg-gray-100 text-gray-700">Assigned: {job.assigned_to_name}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/asset/${job.asset_id}`} className="font-mono font-medium text-blue-700 hover:underline text-sm">
                        {job.asset_tag}
                      </Link>
                      <span className="text-gray-500 text-sm">- {job.asset_name} ({job.asset_type})</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-700 space-y-1">
                      <p><span className="text-gray-400">Reported by:</span> {job.reported_by_name ?? 'Unknown'}{job.reported_by_email ? ` · ${job.reported_by_email}` : ''}</p>
                      <p><span className="text-gray-400">Current place:</span> {job.set_name ? `${job.set_name}` : job.location_name ?? 'Not set'}</p>
                      {job.fault_description && <p><span className="text-gray-400">Fault:</span> {job.fault_description}</p>}
                      {job.latest_note && <p className="bg-gray-50 rounded-lg p-2 text-xs"><span className="font-medium">Latest note:</span> {job.latest_note}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-2 text-xs text-gray-500 lg:min-w-44">
                    <p><span className="block text-gray-400">Approved</span>{formatDate(job.created_at)}</p>
                    <p><span className="block text-gray-400">Started</span>{formatDate(job.started_at)}</p>
                    <p><span className="block text-gray-400">Held</span>{formatDate(job.held_at)}</p>
                    <p><span className="block text-gray-400">Completed</span>{formatDate(job.completed_at)}</p>
                  </div>
                </div>

                {canManage && job.status !== 'completed' && (
                  <div className="border-t border-gray-100 pt-4 grid lg:grid-cols-[1fr_260px] gap-4">
                    <div className="space-y-3">
                      <textarea
                        placeholder={job.status === 'on_hold' ? 'Add a note before resuming or completing...' : 'Maintenance note...'}
                        value={notes[job.id] ?? ''}
                        onChange={e => setNotes(prev => ({ ...prev, [job.id]: e.target.value }))}
                        className="input resize-none"
                        rows={2}
                      />
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="label">Assign to</label>
                          <select
                            className="input"
                            value={assignees[job.id] ?? String(job.assigned_to_id ?? '')}
                            onChange={e => setAssignees(prev => ({ ...prev, [job.id]: e.target.value }))}
                          >
                            <option value="">Keep current</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label">Complete back to</label>
                          <select className="input" value={option.mode} onChange={e => setOption(job.id, { mode: e.target.value as 'previous' | 'location' | 'set' })}>
                            {job.previous_state_json && <option value="previous">Previous Assignment</option>}
                            <option value="location">Location</option>
                            <option value="set">Class Set</option>
                          </select>
                        </div>
                        {option.mode === 'previous' ? (
                          <div className="sm:col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                            Device will be returned to the teacher, class set, or location it had before maintenance.
                          </div>
                        ) : option.mode === 'location' ? (
                          <div className="sm:col-span-2">
                            <label className="label">Return location</label>
                            <select className="input" value={option.locationId} onChange={e => setOption(job.id, { locationId: e.target.value })}>
                              <option value="">Select location</option>
                              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div className="sm:col-span-2">
                            <label className="label">Return class set</label>
                            <select className="input" value={option.setId} onChange={e => setOption(job.id, { setId: e.target.value })}>
                              <option value="">Select class set</option>
                              {sets.map(s => <option key={s.id} value={s.id}>{s.name}{s.responsible_teacher ? ` - ${s.responsible_teacher}` : ''}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {(job.status === 'approved' || job.status === 'on_hold') && (
                        <button
                          onClick={() => runAction(job, job.status === 'on_hold' ? 'resume' : 'start')}
                          disabled={loadingId === job.id}
                          className="btn-primary text-sm"
                        >
                          {job.status === 'on_hold' ? 'Start Again' : 'Start Maintenance'}
                        </button>
                      )}
                      {job.status === 'in_progress' && (
                        <button onClick={() => runAction(job, 'hold')} disabled={loadingId === job.id} className="btn-warning text-sm">
                          Put On Hold
                        </button>
                      )}
                      <button onClick={() => runAction(job, 'assign')} disabled={loadingId === job.id} className="btn-secondary text-sm">
                        Save Assignment
                      </button>
                      <button onClick={() => runAction(job, 'complete')} disabled={loadingId === job.id} className="btn-success text-sm">
                        Complete and Return
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
