'use client'

import { useState } from 'react'

const REQUEST_TYPES = [
  { value: 'issue', label: 'Report Issue', desc: 'Device is broken, not working, or needs repair', icon: '⚠️', color: 'border-red-300 bg-red-50 text-red-800' },
  { value: 'relocate', label: 'Request Relocation', desc: 'Move this device to a different location', icon: '📍', color: 'border-purple-300 bg-purple-50 text-purple-800' },
  { value: 'borrow', label: 'Request Borrow', desc: 'Temporarily use this device', icon: '⏱', color: 'border-amber-300 bg-amber-50 text-amber-800' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'border-gray-300 bg-gray-50 text-gray-700' },
  { value: 'medium', label: 'Medium', color: 'border-blue-300 bg-blue-50 text-blue-700' },
  { value: 'high', label: 'High', color: 'border-orange-300 bg-orange-50 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'border-red-400 bg-red-100 text-red-800' },
]

export default function ScanForm({ assetId }: { assetId: number }) {
  const [requestType, setRequestType] = useState('')
  const [priority, setPriority] = useState('medium')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!requestType) { setError('Please select a request type'); return }
    if (!name.trim()) { setError('Please enter your name'); return }
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
          onClick={() => { setSubmitted(false); setRequestType(''); setName(''); setEmail(''); setComment(''); setPriority('medium') }}
          className="btn-secondary text-sm mt-2"
        >
          Submit Another Request
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-5">
      {/* Request type */}
      <div className="space-y-2">
        <label className="label">What do you need? *</label>
        <div className="space-y-2">
          {REQUEST_TYPES.map(t => (
            <label key={t.value} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
              requestType === t.value ? t.color + ' border-2' : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="requestType"
                value={t.value}
                checked={requestType === t.value}
                onChange={() => setRequestType(t.value)}
                className="mt-0.5 accent-blue-700"
              />
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

      {/* Name */}
      <div>
        <label className="label">Your Name *</label>
        <input
          className="input"
          placeholder="e.g. Miss Smith"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </div>

      {/* Email */}
      <div>
        <label className="label">Your Email <span className="text-gray-400 font-normal">(optional)</span></label>
        <input
          type="email"
          className="input"
          placeholder="you@school.sch"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>

      {/* Comment */}
      <div>
        <label className="label">Description *</label>
        <textarea
          className="input resize-none"
          rows={4}
          placeholder={
            requestType === 'issue' ? "Describe the problem — e.g. screen cracked, won't turn on, battery drains fast…"
            : requestType === 'relocate' ? "Where do you need it moved and why?"
            : "How long do you need it and why?"
          }
          value={comment}
          onChange={e => setComment(e.target.value)}
          required
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Submitting…' : 'Submit Request'}
      </button>
    </form>
  )
}
