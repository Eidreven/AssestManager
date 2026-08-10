'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function ResetForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Something went wrong'); return }
      setDone(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">❌</div>
        <h2 className="text-xl font-semibold text-gray-900">Invalid link</h2>
        <p className="text-gray-500 text-sm">This reset link is invalid or has expired.</p>
        <Link href="/forgot-password" className="btn-primary inline-flex">Request a new link</Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-semibold text-gray-900">Password updated!</h2>
        <p className="text-gray-500 text-sm">Redirecting you to sign in…</p>
      </div>
    )
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Choose a new password</h2>
      <p className="text-gray-500 text-sm mb-6">Must be at least 8 characters.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            required
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            type="password"
            className="input"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            required
            autoComplete="new-password"
          />
        </div>
        <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
          {loading ? 'Saving…' : 'Set New Password'}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <svg className="w-9 h-9 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">MPS School Asset Register</h1>
          <p className="text-blue-200 text-sm mt-1">Macfarlane Primary School</p>
        </div>
        <div className="card p-8">
          <Suspense>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
