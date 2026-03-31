'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'

type Step = 'email' | 'code' | 'password'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Something went wrong')
        return
      }
      setStep('code')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setError('Please enter the 6-digit code from your email.')
      return
    }
    setStep('password')
    setError('')
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code, password }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Something went wrong'); return }
      setDone(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <svg className="w-9 h-9 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">MPS Asset Manager</h1>
          <p className="text-blue-200 text-sm mt-1">Macfarlane Primary School</p>
        </div>

        <div className="card p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <h2 className="text-xl font-semibold text-gray-900">Password updated!</h2>
              <p className="text-gray-500 text-sm">Your password has been changed. You can now sign in with your new password.</p>
              <Link href="/login" className="btn-primary inline-flex mt-2">Sign in</Link>
            </div>
          ) : step === 'email' ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Reset your password</h2>
              <p className="text-gray-500 text-sm mb-6">Enter your email and we&apos;ll send you a 6-digit reset code.</p>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="label" htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    className="input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@macfarlane.sch"
                    required
                    autoComplete="email"
                  />
                </div>
                <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Reset Code'}
                </button>
              </form>
              <p className="mt-6 text-sm text-center text-gray-400">
                <Link href="/login" className="text-blue-600 hover:text-blue-700">← Back to Sign in</Link>
              </p>
            </>
          ) : step === 'code' ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Enter your reset code</h2>
              <p className="text-gray-500 text-sm mb-6">
                We sent a 6-digit code to <strong>{email}</strong>. Check your inbox and enter the code below.
              </p>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div>
                  <label className="label" htmlFor="code">6-digit code</label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    className="input text-center text-2xl tracking-widest font-mono"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    required
                    autoComplete="one-time-code"
                  />
                </div>
                <button type="submit" className="btn-primary w-full py-2.5">
                  Continue
                </button>
              </form>
              <p className="mt-4 text-sm text-center text-gray-400">
                <button onClick={() => { setStep('email'); setError('') }} className="text-blue-600 hover:text-blue-700">
                  ← Try a different email
                </button>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Set a new password</h2>
              <p className="text-gray-500 text-sm mb-6">Choose a strong password for your account.</p>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="label" htmlFor="password">New password</label>
                  <input
                    id="password"
                    type="password"
                    className="input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
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
                    placeholder="Repeat password"
                    required
                    autoComplete="new-password"
                  />
                </div>
                <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
                  {loading ? 'Saving…' : 'Set New Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
