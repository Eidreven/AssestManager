'use client'

import { useState, useEffect, FormEvent, useRef } from 'react'

interface Location { id: number; name: string; description: string | null }
interface User { id: number; name: string; email: string; role: string; must_change_password?: number; created_at: string }

interface Props { isSuperAdmin: boolean }

function roleLabel(role: string) {
  if (role === 'superadmin') return 'Super Admin'
  if (role === 'admin') return 'Admin'
  return 'Teacher'
}

function roleBadge(role: string) {
  if (role === 'superadmin') return 'bg-purple-100 text-purple-700'
  if (role === 'admin') return 'bg-blue-100 text-blue-700'
  return 'bg-green-100 text-green-700'
}

function actionButtonClass(color: 'blue' | 'amber' | 'purple' | 'red' | 'green' | 'gray') {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
    purple: 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300',
    red: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
    green: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-300',
    gray: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
  }
  return `inline-flex items-center justify-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${colors[color]}`
}

export default function AdminPage({ isSuperAdmin }: Props) {
  const [locations, setLocations] = useState<Location[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [locForm, setLocForm] = useState({ name: '', description: '' })
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'teacher' })
  const [editingLoc, setEditingLoc] = useState<{ id: number; name: string; description: string } | null>(null)
  const [editingUser, setEditingUser] = useState<{ id: number; name: string; email: string; role: string } | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userEditLoading, setUserEditLoading] = useState(false)
  const [userActionLoading, setUserActionLoading] = useState<number | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [userLoading, setUserLoading] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restartLoading, setRestartLoading] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const restoreInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(setLocations)
    fetch('/api/users').then(r => r.json()).then(d => { if (Array.isArray(d)) setUsers(d) })
  }, [])

  async function addLocation(e: FormEvent) {
    e.preventDefault()
    setLocLoading(true); setError(''); setSuccess('')
    const res = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(locForm),
    })
    const data = await res.json()
    if (res.ok) {
      setLocations(prev => [...prev, { id: data.id, name: locForm.name, description: locForm.description || null }])
      setLocForm({ name: '', description: '' })
      setSuccess('Location added.')
    } else {
      setError(data.error ?? 'Failed')
    }
    setLocLoading(false)
  }

  async function deleteLocation(id: number) {
    if (!confirm('Delete this location?')) return
    await fetch(`/api/locations/${id}`, { method: 'DELETE' })
    setLocations(prev => prev.filter(l => l.id !== id))
  }

  async function saveEditLocation() {
    if (!editingLoc) return
    setError(''); setSuccess('')
    const res = await fetch(`/api/locations/${editingLoc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingLoc.name, description: editingLoc.description }),
    })
    if (res.ok) {
      setLocations(prev => prev.map(l => l.id === editingLoc.id
        ? { ...l, name: editingLoc.name, description: editingLoc.description || null }
        : l
      ))
      setSuccess('Location updated.')
      setEditingLoc(null)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to update')
    }
  }

  async function handleRestart() {
    if (!confirm('Restart the server? The app will be unavailable for a few seconds.')) return
    setRestartLoading(true)
    try {
      await fetch('/api/restart', { method: 'POST' })
      setSuccess('Server reloaded. Data is refreshed.')
    } catch {
      setSuccess('Server reloaded. Data is refreshed.')
    } finally {
      setRestartLoading(false)
    }
  }

  async function handleBackup() {
    setBackupLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/backup')
      if (!res.ok) { setError('Backup failed'); return }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="(.+)"/)
      a.download = match ? match[1] : 'assets-backup.json'
      a.click()
      window.URL.revokeObjectURL(url)
      setSuccess('Backup downloaded.')
    } catch {
      setError('Backup failed.')
    } finally {
      setBackupLoading(false)
    }
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm(`Restore database from "${file.name}"? This will replace all current data.`)) {
      if (restoreInputRef.current) restoreInputRef.current.value = ''
      return
    }
    setRestoreLoading(true); setError(''); setSuccess('')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/backup', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setSuccess(data.message)
      } else {
        setError(data.error ?? 'Restore failed')
      }
    } catch {
      setError('Restore failed.')
    } finally {
      setRestoreLoading(false)
      if (restoreInputRef.current) restoreInputRef.current.value = ''
    }
  }

  async function saveEditUser() {
    if (!editingUser) return
    setUserEditLoading(true); setError(''); setSuccess('')
    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingUser.name, email: editingUser.email, role: editingUser.role }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === editingUser.id
        ? { ...u, name: editingUser.name, email: editingUser.email, role: editingUser.role }
        : u
      ))
      setSelectedUser(prev => prev?.id === editingUser.id
        ? { ...prev, name: editingUser.name, email: editingUser.email, role: editingUser.role }
        : prev
      )
      setSuccess('User updated.')
      setEditingUser(null)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to update user')
    }
    setUserEditLoading(false)
  }

  async function deleteUser(id: number, name: string) {
    if (!confirm(`Delete account for "${name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== id))
      setSelectedUser(prev => prev?.id === id ? null : prev)
      setSuccess('User deleted.')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to delete user')
    }
  }

  async function resetUserPassword(user: User) {
    if (!confirm(`Generate a secure temporary password for "${user.name}" and email it to them?`)) return
    setUserActionLoading(user.id); setError(''); setSuccess('')
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, must_change_password: 1 } : u))
        setSelectedUser(prev => prev?.id === user.id ? { ...prev, must_change_password: 1 } : prev)
        setSuccess(`Temporary password sent to ${user.email}.`)
      } else {
        setError(data.error ?? 'Failed to reset password')
      }
    } catch {
      setError('Failed to reset password')
    } finally {
      setUserActionLoading(null)
    }
  }

  async function impersonateUser(user: User) {
    if (!confirm(`Login as "${user.name}"? You will switch into their account.`)) return
    setUserActionLoading(user.id); setError(''); setSuccess('')
    try {
      const res = await fetch(`/api/users/${user.id}/impersonate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to login as user')
        return
      }
      window.location.href = '/dashboard'
    } catch {
      setError('Failed to login as user')
    } finally {
      setUserActionLoading(null)
    }
  }

  async function addUser(e: FormEvent) {
    e.preventDefault()
    setUserLoading(true); setError(''); setSuccess('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userForm),
    })
    const data = await res.json()
    if (res.ok) {
      setUsers(prev => [...prev, { id: data.id, name: userForm.name, email: userForm.email, role: userForm.role, must_change_password: 0, created_at: new Date().toISOString() }])
      setUserForm({ name: '', email: '', password: '', role: 'teacher' })
      setSuccess('User created.')
    } else {
      setError(data.error ?? 'Failed')
    }
    setUserLoading(false)
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>

        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

        {/* Locations */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-lg">Locations</h2>
          <p className="text-sm text-gray-500">Manage rooms and areas for your school.</p>

          <form onSubmit={addLocation} className="flex flex-wrap gap-3">
            <input
              className="input flex-1 min-w-48"
              placeholder="Location name (e.g. Library)"
              value={locForm.name}
              onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))}
              required
            />
            <input
              className="input flex-1 min-w-48"
              placeholder="Description (optional)"
              value={locForm.description}
              onChange={e => setLocForm(f => ({ ...f, description: e.target.value }))}
            />
            <button type="submit" className="btn-primary" disabled={locLoading}>
              {locLoading ? 'Adding…' : 'Add Location'}
            </button>
          </form>

          {locations.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {locations.map(l => (
                    <tr key={l.id}>
                      {editingLoc?.id === l.id ? (
                        <>
                          <td className="px-4 py-2">
                            <input className="input py-1 text-sm" value={editingLoc.name}
                              onChange={e => setEditingLoc(f => f ? { ...f, name: e.target.value } : f)} />
                          </td>
                          <td className="px-4 py-2">
                            <input className="input py-1 text-sm" value={editingLoc.description}
                              onChange={e => setEditingLoc(f => f ? { ...f, description: e.target.value } : f)} />
                          </td>
                          <td className="px-4 py-2 flex gap-2">
                            <button onClick={saveEditLocation} className="text-green-600 hover:text-green-800 text-xs font-medium">Save</button>
                            <button onClick={() => setEditingLoc(null)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2 font-medium">{l.name}</td>
                          <td className="px-4 py-2 text-gray-500">{l.description ?? '—'}</td>
                          <td className="px-4 py-2 flex gap-3">
                            <button onClick={() => setEditingLoc({ id: l.id, name: l.name, description: l.description ?? '' })} className="text-blue-500 hover:text-blue-700 text-xs">Edit</button>
                            <button onClick={() => deleteLocation(l.id)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Users */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-lg">User Accounts</h2>
          <p className="text-sm text-gray-500">
            {isSuperAdmin
              ? 'Create and manage all user accounts including Admin and Super Admin.'
              : 'Create Teacher accounts. Contact a Super Admin to add Admin accounts.'}
          </p>

          <form onSubmit={addUser} className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Password *</label>
              <input type="password" className="input" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
                <option value="teacher">Teacher</option>
                {isSuperAdmin && <option value="admin">Admin</option>}
                {isSuperAdmin && <option value="superadmin">Super Admin</option>}
              </select>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" className="btn-primary" disabled={userLoading}>
                {userLoading ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </form>

          {users.length > 0 && (
            <>
            <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium w-[24%]">Name</th>
                    <th className="px-4 py-3 font-medium w-[32%]">Email</th>
                    <th className="px-4 py-3 font-medium w-[20%]">Role</th>
                    <th className="px-4 py-3 font-medium w-[12%]">Since</th>
                    <th className="px-4 py-3 font-medium w-[12%] text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium truncate">{u.name}</td>
                        <td className="px-4 py-3 text-gray-500 truncate">{u.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`badge ${roleBadge(u.role)}`}>
                              {roleLabel(u.role)}
                            </span>
                            {u.must_change_password ? (
                              <span className="badge bg-amber-100 text-amber-800">Temp password</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(u.created_at).toLocaleDateString('en-GB', { timeZone: 'Australia/Darwin' })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                          <button
                            onClick={() => {
                              setSelectedUser(u)
                              setEditingUser(null)
                            }}
                            className="btn-secondary text-xs px-4 py-1.5 min-w-16"
                          >
                            View
                          </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {users.map(u => {
                return (
                  <div key={u.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:bg-gray-900 dark:border-gray-700">
                    <div className="space-y-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                        <p className="text-sm text-gray-500 truncate">{u.email}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Since {new Date(u.created_at).toLocaleDateString('en-GB', { timeZone: 'Australia/Darwin' })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`badge ${roleBadge(u.role)}`}>
                          {roleLabel(u.role)}
                        </span>
                        {u.must_change_password ? (
                          <span className="badge bg-amber-100 text-amber-800">Temp password</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedUser(u)
                        setEditingUser(null)
                      }}
                      className="btn-secondary w-full mt-4 text-sm"
                    >
                      View
                    </button>
                  </div>
                )
              })}
            </div>
            </>
          )}

          {selectedUser && (() => {
            const canEdit = isSuperAdmin || selectedUser.role !== 'superadmin'
            const canResetPassword = canEdit
            const canImpersonate = isSuperAdmin
            const isEditing = editingUser?.id === selectedUser.id
            return (
	              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/40">
	                <div className="bg-white dark:bg-gray-900 rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-lg max-h-[calc(100vh-1rem)] sm:max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
	                  <div className="flex items-start justify-between gap-4 px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{selectedUser.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{selectedUser.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedUser(null)
                        setEditingUser(null)
                      }}
                      className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

	                  <div className="p-4 sm:p-5 space-y-5">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <label className="label">Name</label>
                          <input className="input" value={editingUser.name}
                            onChange={e => setEditingUser(f => f ? { ...f, name: e.target.value } : f)} />
                        </div>
                        <div>
                          <label className="label">Email</label>
                          <input type="email" className="input" value={editingUser.email}
                            onChange={e => setEditingUser(f => f ? { ...f, email: e.target.value } : f)} />
                        </div>
                        <div>
                          <label className="label">Role</label>
                          <select className="input" value={editingUser.role}
                            onChange={e => setEditingUser(f => f ? { ...f, role: e.target.value } : f)}>
                            <option value="teacher">Teacher</option>
                            {isSuperAdmin && <option value="admin">Admin</option>}
                            {isSuperAdmin && <option value="superadmin">Super Admin</option>}
                          </select>
                        </div>
	                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
	                          <button onClick={saveEditUser} disabled={userEditLoading} className="btn-primary text-sm">
	                            {userEditLoading ? 'Saving...' : 'Save Changes'}
	                          </button>
	                          <button onClick={() => setEditingUser(null)} className="btn-secondary text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Name</p>
                          <p className="font-medium text-gray-900">{selectedUser.name}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Email</p>
                          <p className="font-medium text-gray-900 break-all">{selectedUser.email}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Role</p>
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`badge ${roleBadge(selectedUser.role)}`}>{roleLabel(selectedUser.role)}</span>
                            {selectedUser.must_change_password ? (
                              <span className="badge bg-amber-100 text-amber-800">Temp password</span>
                            ) : null}
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Created</p>
                          <p className="font-medium text-gray-900">
                            {new Date(selectedUser.created_at).toLocaleDateString('en-GB', { timeZone: 'Australia/Darwin' })}
                          </p>
                        </div>
                      </div>
                    )}

                    {!isEditing && (
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Actions</p>
	                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {canEdit && (
                            <button
                              onClick={() => setEditingUser({ id: selectedUser.id, name: selectedUser.name, email: selectedUser.email, role: selectedUser.role })}
                              className={actionButtonClass('blue')}
                            >
                              Edit
                            </button>
                          )}
                          {canResetPassword && (
                            <button
                              onClick={() => resetUserPassword(selectedUser)}
                              disabled={userActionLoading === selectedUser.id}
                              className={actionButtonClass('amber')}
                            >
                              Reset Password
                            </button>
                          )}
                          {canImpersonate && (
                            <button
                              onClick={() => impersonateUser(selectedUser)}
                              disabled={userActionLoading === selectedUser.id}
                              className={actionButtonClass('purple')}
                            >
                              Login As
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => deleteUser(selectedUser.id, selectedUser.name)}
                              className={actionButtonClass('red')}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Danger Zone — Super Admin only */}
        {isSuperAdmin && (
          <div className="card p-6 space-y-4 border-red-200">
            <h2 className="font-semibold text-red-700 text-lg">Danger Zone</h2>
            <p className="text-sm text-gray-500">Permanently delete all assets, locations, allocations and requests. Your user accounts will be kept.</p>
            <button
              onClick={async () => {
                if (!confirm('DELETE ALL DATA?\n\nThis will permanently remove all assets, locations, allocations and requests.\n\nYour user accounts will be kept.\n\nThis cannot be undone.')) return
                if (!confirm('Are you absolutely sure? Type OK to confirm.\n\nAll asset data will be gone forever.')) return
                setClearLoading(true); setError(''); setSuccess('')
                try {
                  const res = await fetch('/api/admin/clear', { method: 'DELETE' })
                  if (res.ok) {
                    setSuccess('All data cleared. You can now start adding real assets.')
                  } else {
                    const d = await res.json()
                    setError(d.error ?? 'Failed to clear data')
                  }
                } catch {
                  setError('Failed to clear data')
                } finally {
                  setClearLoading(false)
                }
              }}
              disabled={clearLoading}
              className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {clearLoading ? 'Clearing…' : 'Clear All Data'}
            </button>
          </div>
        )}

        {/* Database Backup & Restore */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-lg">Database Backup & Restore</h2>
          <p className="text-sm text-gray-500">
            {isSuperAdmin
              ? 'Download a JSON backup of all data or restore from a previous JSON backup file.'
              : 'Download a JSON backup of all data.'}
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleBackup}
              disabled={backupLoading}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {backupLoading ? 'Downloading…' : 'Download Backup'}
            </button>

            {isSuperAdmin && (
              <label className={`btn-secondary flex items-center gap-2 cursor-pointer ${restoreLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
                </svg>
                {restoreLoading ? 'Restoring…' : 'Restore from Backup'}
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleRestore}
                />
              </label>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Restart Server</p>
              <p className="text-xs text-gray-500">Use this if data doesn&apos;t look right after a restore.</p>
            </div>
            <button
              onClick={handleRestart}
              disabled={restartLoading}
              className="btn-warning flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {restartLoading ? 'Restarting…' : 'Restart Server'}
            </button>
          </div>

          {isSuperAdmin && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Warning: Restoring from a backup will replace all current data. Make sure to download a backup first.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
