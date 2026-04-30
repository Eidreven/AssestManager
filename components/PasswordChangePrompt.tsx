'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PasswordChangePrompt({ userId, userName }: { userId: number; userName: string }) {
  const router = useRouter()
  const skipKey = `password-change-skipped-${userId}`
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return sessionStorage.getItem(skipKey) !== '1'
  })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not update password')
        return
      }
      sessionStorage.removeItem(skipKey)
      setOpen(false)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900">Change temporary password</h2>
          <p className="text-sm text-gray-500 mt-1">
            Hi {userName}, your password was reset by an admin. You can skip for now, but this will appear each time you sign in until you choose your own password.
          </p>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{error}</div>}
          <div>
            <label className="label" htmlFor="prompt-password">New password</label>
            <input
              id="prompt-password"
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label" htmlFor="prompt-confirm">Confirm password</label>
            <input
              id="prompt-confirm"
              type="password"
              className="input"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              autoComplete="new-password"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Saving...' : 'Save New Password'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                sessionStorage.setItem(skipKey, '1')
                setOpen(false)
              }}
            >
              Skip Now
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
