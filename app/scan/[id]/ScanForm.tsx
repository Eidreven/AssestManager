'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

const REQUEST_TYPES = [
  { value: 'issue',    label: 'Report Issue',       desc: 'Device is broken, not working, or needs repair', icon: '⚠️', color: 'border-red-300 bg-red-50 text-red-800' },
  { value: 'relocate', label: 'Request Relocation', desc: 'Move this device to a different location',        icon: '📍', color: 'border-purple-300 bg-purple-50 text-purple-800' },
  { value: 'borrow',   label: 'Request Borrow',     desc: 'Temporarily use this device',                    icon: '⏱', color: 'border-amber-300 bg-amber-50 text-amber-800' },
]

const PRIORITIES = [
  { value: 'low',    label: 'Low',    color: 'border-gray-300 bg-gray-50 text-gray-700' },
  { value: 'medium', label: 'Medium', color: 'border-blue-300 bg-blue-50 text-blue-700' },
  { value: 'high',   label: 'High',   color: 'border-orange-300 bg-orange-50 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'border-red-400 bg-red-100 text-red-800' },
]

interface Props {
  assetId: number
  loggedInUser: { name: string; email: string } | null
}

export default function ScanForm({ assetId, loggedInUser }: Props) {
  const pathname = usePathname()

  // If staff is already logged in, skip the choice screen
  const [mode, setMode] = useState<'choose' | 'staff' | 'guest'>(
    loggedInUser ? 'staff' : 'choose'
  )

  const [requestType, setRequestType] = useState('')
  const [priority, setPriority] = useState('medium')
  const [name, setName] = useState(loggedInUser?.name ?? '')
  const [email, setEmail] = useState(loggedInUser?.email ?? '')
  const [phone, setPhone] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!requestType) { setError('Please select a request type'); return }
    if (!name.trim()) { setError('Please enter your name'); return }
    if (mode === 'guest' && !phone.trim()) { setError('Please enter your contact number'); return }
    if (!comment.trim()) { setError('Please describe the issue or reason'); return }

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: assetId,
          request_type: requestType,
          priority,
          requester_name: name.trim(),
          requester_email: email.trim() || undefined,
          requester_phone: mode === 'guest' ? phone.trim() : undefined,
          reason: comment.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to submit request')
        return
      }
      setSubmitted(true)
    } catch {
      setError('Failed to submit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="card p-8 text-center space-y-3">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-gray-900">Request Submitted!</h2>
        <p className="text-gray-500 text-sm">Your request has been sent to the admin team. They will review it shortly.</p>
        <button
          onClick={() => { setSubmitted(false); setRequestType(''); setComment(''); setPriority('medium'); setPhone('') }}
          className="btn-secondary text-sm mt-2"
        >
          Submit Another Request
        </button>
      </div>
    )
  }

  // Choose mode screen
  if (mode === 'choose') {
    return (
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-center">Who are you?</h2>
        <button
          onClick={() => window.location.href = `/login?returnUrl=${encodeURIComponent(pathname)}`}
          className="w-full flex items-center gap-4 p-4 border-2 border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors text-left"
        >
          <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900">I&apos;m a Staff Member</p>
            <p className="text-sm text-gray-500">Login with your school email and password</p>
          </div>
        </button>

        <button
          onClick={() => setMode('guest')}
          className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 bg-white rounded-xl hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900">I&apos;m a Guest</p>
            <p className="text-sm text-gray-500">Continue without an account — provide your name and contact details</p>
          </div>
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-5">
      {/* Logged in banner */}
      {loggedInUser && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Logged in as <span className="font-medium">{loggedInUser.name}</span>
        </div>
      )}

      {/* Request type */}
      <div className="space-y-2">
        <label className="label">What do you need? *</label>
        <div className="space-y-2">
          {REQUEST_TYPES.map(t => (
            <label key={t.value} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
              requestType === t.value ? t.color : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}>
              <input type="radio" name="requestType" value={t.value}
                checked={requestType === t.value} onChange={() => setRequestType(t.value)}
                className="mt-0.5 accent-blue-700" />
              <div>
                <p className="font-medium text-sm">{t.icon} {t.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <label className="label">Priority *</label>
        <div className="grid grid-cols-4 gap-2">
          {PRIORITIES.map(p => (
            <label key={p.value} className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 cursor-pointer text-center transition-all ${
              priority === p.value ? p.color : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}>
              <input type="radio" name="priority" value={p.value} checked={priority === p.value}
                onChange={() => setPriority(p.value)} className="sr-only" />
              <span className="text-xs font-semibold">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Name — read-only if staff logged in */}
      <div>
        <label className="label">Your Name *</label>
        <input className="input" placeholder="e.g. Miss Smith"
          value={name} onChange={e => setName(e.target.value)}
          readOnly={!!loggedInUser} required />
      </div>

      {/* Email — read-only if staff logged in */}
      <div>
        <label className="label">Email {mode === 'guest' && <span className="text-gray-400 font-normal">(optional)</span>}</label>
        <input type="email" className="input" placeholder="you@school.sch"
          value={email} onChange={e => setEmail(e.target.value)}
          readOnly={!!loggedInUser} />
      </div>

      {/* Phone — only for guests */}
      {mode === 'guest' && (
        <div>
          <label className="label">Contact Number *</label>
          <input type="tel" className="input" placeholder="e.g. 07700 900000"
            value={phone} onChange={e => setPhone(e.target.value)} required />
        </div>
      )}

      {/* Description */}
      <div>
        <label className="label">Description *</label>
        <textarea className="input resize-none" rows={4}
          placeholder={
            requestType === 'issue' ? "Describe the problem — e.g. screen cracked, won't turn on, battery drains fast…"
            : requestType === 'relocate' ? "Where do you need it moved and why?"
            : "How long do you need it and why?"
          }
          value={comment} onChange={e => setComment(e.target.value)} required />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Submitting…' : 'Submit Request'}
      </button>

      {!loggedInUser && (
        <button type="button" onClick={() => setMode('choose')}
          className="w-full text-sm text-gray-400 hover:text-gray-600 text-center">
          ← Back
        </button>
      )}
    </form>
  )
}
