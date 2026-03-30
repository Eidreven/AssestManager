'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface AssetSet {
  id: number
  name: string
  description: string | null
  responsible_teacher: string | null
  location_id: number | null
  location_name: string | null
  asset_count: number
}

interface Location { id: number; name: string }

interface Props {
  initialSets: AssetSet[]
  locations: Location[]
  teachers: string[]
  isAdmin: boolean
}

export default function SetsClient({ initialSets, locations, teachers, isAdmin }: Props) {
  const router = useRouter()
  const [sets, setSets] = useState(initialSets)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', responsible_teacher: '', location_id: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function createSet(e: FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        responsible_teacher: form.responsible_teacher || null,
        location_id: form.location_id ? Number(form.location_id) : null,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setForm({ name: '', description: '', responsible_teacher: '', location_id: '' })
      setShowForm(false)
      router.refresh()
      setSets(prev => [...prev, {
        id: data.id,
        name: form.name,
        description: form.description || null,
        responsible_teacher: form.responsible_teacher || null,
        location_id: form.location_id ? Number(form.location_id) : null,
        location_name: locations.find(l => l.id === Number(form.location_id))?.name ?? null,
        asset_count: 0,
      }])
    } else {
      setError(data.error ?? 'Failed to create set')
    }
    setLoading(false)
  }

  async function deleteSet(id: number, name: string) {
    if (!confirm(`Delete set "${name}"?\n\nThe devices in this set will NOT be deleted, they'll just be unlinked from the set.`)) return
    const res = await fetch(`/api/sets/${id}`, { method: 'DELETE' })
    if (res.ok) setSets(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Sets</h1>
          <p className="text-sm text-gray-500 mt-0.5">Group devices into classroom sets and allocate them all at once.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Set
          </button>
        )}
      </div>

      {/* Create form — admin only */}
      {isAdmin && showForm && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Create New Set</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <form onSubmit={createSet} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Set Name *</label>
              <input className="input" placeholder="e.g. Room 5 iPad Trolley"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Responsible Teacher</label>
              <select className="input" value={form.responsible_teacher} onChange={e => setForm(f => ({ ...f, responsible_teacher: e.target.value }))}>
                <option value="">— Select teacher —</option>
                {teachers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Location</label>
              <select className="input" value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}>
                <option value="">— Select location —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" placeholder="Optional notes"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Creating…' : 'Create Set'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sets grid */}
      {sets.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-5xl mb-3">📦</div>
          <p className="font-medium text-gray-500">No sets yet</p>
          <p className="text-sm mt-1">Create a set to group classroom iPads together.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map(set => (
            <div key={set.id} className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{set.name}</h3>
                  {set.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{set.description}</p>}
                </div>
                <span className="flex-shrink-0 text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                  {set.asset_count} device{set.asset_count !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-1 text-sm text-gray-500">
                {set.responsible_teacher && (
                  <p className="flex items-center gap-1.5">
                    <span>👩‍🏫</span> {set.responsible_teacher}
                  </p>
                )}
                {set.location_name && (
                  <p className="flex items-center gap-1.5">
                    <span>📍</span> {set.location_name}
                  </p>
                )}
              </div>

              <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100">
                <Link href={`/sets/${set.id}`} className="flex-1 text-center btn-primary text-sm py-1.5">
                  View
                </Link>
                {isAdmin && (
                  <button onClick={() => deleteSet(set.id, set.name)}
                    className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
