'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface SetInfo {
  id: number
  name: string
  description: string | null
  responsible_teacher: string | null
  location_id: number | null
  location_name: string | null
  asset_count: number
}

interface SetAsset {
  id: number
  asset_tag: string
  name: string
  type: string
  status: string
  allocated_to: string | null
}

interface UnassignedAsset {
  id: number
  asset_tag: string
  name: string
  type: string
}

interface Location { id: number; name: string }

interface Props {
  set: SetInfo
  setAssets: SetAsset[]
  unassigned: UnassignedAsset[]
  locations: Location[]
  teachers: string[]
  isAdmin: boolean
}

export default function SetDetailClient({ set, setAssets, unassigned, locations, teachers, isAdmin }: Props) {
  const router = useRouter()

  const [assets, setAssets2] = useState(setAssets)
  const [available, setAvailable] = useState(unassigned)

  // Edit set info
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: set.name,
    description: set.description ?? '',
    responsible_teacher: set.responsible_teacher ?? '',
    location_id: set.location_id ? String(set.location_id) : '',
  })
  const [editLoading, setEditLoading] = useState(false)

  // Add device
  const [addId, setAddId] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // Allocate/return all
  const [allocateTeacher, setAllocateTeacher] = useState(set.responsible_teacher ?? '')
  const [allocateLoading, setAllocateLoading] = useState(false)
  const [returnLoading, setReturnLoading] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError('') }
    setTimeout(() => { setError(''); setSuccess('') }, 4000)
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    setEditLoading(true)
    const res = await fetch(`/api/sets/${set.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        description: editForm.description || null,
        responsible_teacher: editForm.responsible_teacher || null,
        location_id: editForm.location_id ? Number(editForm.location_id) : null,
      }),
    })
    if (res.ok) {
      flash('Set updated.')
      setEditing(false)
      router.refresh()
    } else {
      const d = await res.json()
      flash(d.error ?? 'Failed to update', true)
    }
    setEditLoading(false)
  }

  async function addDevice(e: FormEvent) {
    e.preventDefault()
    if (!addId) return
    setAddLoading(true)
    const res = await fetch(`/api/sets/${set.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: Number(addId) }),
    })
    if (res.ok) {
      const added = available.find(a => a.id === Number(addId))!
      setAssets2(prev => [...prev, { ...added, status: 'available', allocated_to: null }])
      setAvailable(prev => prev.filter(a => a.id !== Number(addId)))
      setAddId('')
      flash(`${added.asset_tag} added to set.`)
    } else {
      const d = await res.json()
      flash(d.error ?? 'Failed to add device', true)
    }
    setAddLoading(false)
  }

  async function removeDevice(assetId: number, tag: string) {
    const res = await fetch(`/api/sets/${set.id}/members?asset_id=${assetId}`, { method: 'DELETE' })
    if (res.ok) {
      const removed = assets.find(a => a.id === assetId)!
      setAvailable(prev => [...prev, { id: removed.id, asset_tag: removed.asset_tag, name: removed.name, type: removed.type }])
      setAssets2(prev => prev.filter(a => a.id !== assetId))
      flash(`${tag} removed from set.`)
    }
  }

  async function allocateAll() {
    if (!allocateTeacher) { flash('Select a teacher first.', true); return }
    if (!confirm(`Allocate all ${assets.length} devices to ${allocateTeacher}?`)) return
    setAllocateLoading(true)
    const res = await fetch(`/api/sets/${set.id}/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responsible_teacher: allocateTeacher }),
    })
    const d = await res.json()
    if (res.ok) {
      flash(`${d.count} devices allocated to ${allocateTeacher}.`)
      setAssets2(prev => prev.map(a => ({ ...a, status: 'allocated', allocated_to: allocateTeacher })))
      router.refresh()
    } else {
      flash(d.error ?? 'Failed to allocate', true)
    }
    setAllocateLoading(false)
  }

  async function returnAll() {
    if (!confirm(`Return all ${assets.length} devices from this set?`)) return
    setReturnLoading(true)
    const res = await fetch(`/api/sets/${set.id}/allocate`, { method: 'DELETE' })
    const d = await res.json()
    if (res.ok) {
      flash(`${d.count} devices returned.`)
      setAssets2(prev => prev.map(a => ({ ...a, status: 'available', allocated_to: null })))
      router.refresh()
    } else {
      flash(d.error ?? 'Failed to return', true)
    }
    setReturnLoading(false)
  }

  const allocatedCount = assets.filter(a => a.status === 'allocated').length
  const availableCount = assets.filter(a => a.status === 'available').length

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/sets" className="hover:text-blue-600">Class Sets</Link>
            <span>›</span>
            <span className="text-gray-600">{set.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{set.name}</h1>
          <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
            {set.responsible_teacher && <span>👩‍🏫 {set.responsible_teacher}</span>}
            {set.location_name && <span>📍 {set.location_name}</span>}
            <span>📱 {assets.length} device{assets.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setEditing(!editing)} className="btn-secondary text-sm">
            {editing ? 'Cancel' : 'Edit Set Info'}
          </button>
        )}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

      {/* Edit form — admin only */}
      {isAdmin && editing && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Edit Set</h2>
          <form onSubmit={saveEdit} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Set Name *</label>
              <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Responsible Teacher</label>
              <select className="input" value={editForm.responsible_teacher} onChange={e => setEditForm(f => ({ ...f, responsible_teacher: e.target.value }))}>
                <option value="">— None —</option>
                {teachers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Location</label>
              <select className="input" value={editForm.location_id} onChange={e => setEditForm(f => ({ ...f, location_id: e.target.value }))}>
                <option value="">— None —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" className="btn-primary" disabled={editLoading}>
                {editLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Allocate / Return all — admin only */}
      {isAdmin && <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Bulk Allocation</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="badge bg-green-100 text-green-700">{availableCount} available</span>
          <span className="badge bg-amber-100 text-amber-700">{allocatedCount} allocated</span>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="label">Allocate all to</label>
            <select className="input" value={allocateTeacher} onChange={e => setAllocateTeacher(e.target.value)}>
              <option value="">— Select teacher —</option>
              {teachers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button
            onClick={allocateAll}
            disabled={allocateLoading || assets.length === 0 || !allocateTeacher}
            className="btn-primary"
          >
            {allocateLoading ? 'Allocating…' : `Allocate All (${assets.length})`}
          </button>
          <button
            onClick={returnAll}
            disabled={returnLoading || allocatedCount === 0}
            className="btn-secondary"
          >
            {returnLoading ? 'Returning…' : `Return All (${allocatedCount})`}
          </button>
        </div>
      </div>}

      {/* Devices in set */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Devices in this Set</h2>
        </div>

        {/* Add device — admin only */}
        {isAdmin && available.length > 0 && (
          <form onSubmit={addDevice} className="flex gap-2">
            <select className="input flex-1" value={addId} onChange={e => setAddId(e.target.value)} required>
              <option value="">— Add a device to this set —</option>
              {available.map(a => (
                <option key={a.id} value={a.id}>{a.asset_tag} — {a.name} ({a.type})</option>
              ))}
            </select>
            <button type="submit" className="btn-primary" disabled={addLoading || !addId}>
              {addLoading ? 'Adding…' : 'Add'}
            </button>
          </form>
        )}

        {assets.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No devices in this set yet. Add some above.</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Tag</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Allocated To</th>
                  <th className="px-4 py-2 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assets.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link href={`/asset/${a.id}`} className="font-mono text-blue-600 hover:underline font-medium">
                        {a.asset_tag}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{a.name}</td>
                    <td className="px-4 py-2">
                      <span className={`badge text-xs ${
                        a.status === 'available' ? 'bg-green-100 text-green-700'
                        : a.status === 'allocated' ? 'bg-amber-100 text-amber-700'
                        : a.status === 'maintenance' ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-500'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{a.allocated_to ?? '—'}</td>
                    <td className="px-4 py-2">
                      {isAdmin && (
                        <button onClick={() => removeDevice(a.id, a.asset_tag)}
                          className="text-red-400 hover:text-red-600 text-xs font-medium">
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
