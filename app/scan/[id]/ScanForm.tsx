'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

interface Props {
  assetId: number
  loggedInUser: { name: string; email: string } | null
}

type Step = 'who' | 'what' | 'how-urgent' | 'your-details' | 'description' | 'done'

const WHAT_OPTIONS = [
  {
    value: 'issue',
    icon: '🔧',
    label: "It's broken or not working",
    color: 'border-red-300 bg-red-50 active:bg-red-100',
    selectedColor: 'border-red-500 bg-red-100 ring-2 ring-red-400',
  },
  {
    value: 'relocate',
    icon: '🚚',
    label: 'I need to move it to another room',
    color: 'border-purple-300 bg-purple-50 active:bg-purple-100',
    selectedColor: 'border-purple-500 bg-purple-100 ring-2 ring-purple-400',
  },
  {
    value: 'borrow',
    icon: '✋',
    label: "I'd like to borrow it",
    color: 'border-amber-300 bg-amber-50 active:bg-amber-100',
    selectedColor: 'border-amber-500 bg-amber-100 ring-2 ring-amber-400',
  },
]

const URGENCY_OPTIONS = [
  { value: 'low',    icon: '🟢', label: 'Not urgent',       sub: 'When you get a chance' },
  { value: 'medium', icon: '🟡', label: 'Fairly soon',      sub: 'Within a day or two' },
  { value: 'high',   icon: '🟠', label: 'Quite urgent',     sub: 'Today if possible' },
  { value: 'urgent', icon: '🔴', label: 'Very urgent',      sub: 'Needs attention now' },
]

export default function ScanForm({ assetId, loggedInUser }: Props) {
  const pathname = usePathname()

  const [step, setStep] = useState<Step>(loggedInUser ? 'what' : 'who')
  const [isGuest, setIsGuest] = useState(false)

  const [what, setWhat] = useState('')
  const [urgency, setUrgency] = useState('')
  const [name, setName] = useState(loggedInUser?.name ?? '')
  const [email, setEmail] = useState(loggedInUser?.email ?? '')
  const [phone, setPhone] = useState('')
  const [description, setDescription] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const STEPS: Step[] = ['who', 'what', 'how-urgent', 'your-details', 'description']
  const currentStepIndex = STEPS.indexOf(step)
  const totalSteps = loggedInUser ? 4 : 5

  async function submit() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: assetId,
          request_type: what,
          priority: urgency,
          requester_name: name.trim(),
          requester_email: email.trim() || undefined,
          requester_phone: isGuest ? phone.trim() || undefined : undefined,
          reason: description.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setStep('done')
    } catch {
      setError('Could not send your request. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-5">
        <div className="text-7xl">✅</div>
        <h2 className="text-2xl font-bold text-gray-900">Request Sent!</h2>
        <p className="text-gray-500 text-base leading-relaxed">
          The IT team has been notified and will look into it soon.
        </p>
        <button
          onClick={() => {
            setStep(loggedInUser ? 'what' : 'who')
            setWhat(''); setUrgency(''); setDescription('')
            setPhone(''); setError('')
            if (!loggedInUser) { setName(''); setEmail('') }
          }}
          className="w-full py-4 text-base font-medium rounded-xl border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          Report Another Problem
        </button>
      </div>
    )
  }

  // ── Progress bar (skip 'who' step if logged in) ───────────────────────────
  const stepNum = loggedInUser
    ? ['what', 'how-urgent', 'your-details', 'description'].indexOf(step) + 1
    : ['who', 'what', 'how-urgent', 'your-details', 'description'].indexOf(step) + 1

  const progressBar = step !== 'who' || loggedInUser ? (
    <div className="space-y-1 mb-2">
      <div className="flex justify-between text-xs text-gray-400">
        <span>Step {stepNum} of {totalSteps}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(stepNum / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  ) : null

  // ── Who are you? ─────────────────────────────────────────────────────────────
  if (step === 'who') {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-xl font-bold text-gray-900 text-center">Who are you?</h2>

          <button
            onClick={() => { window.location.href = `/login?returnUrl=${encodeURIComponent(pathname)}` }}
            className="w-full flex items-center gap-4 p-5 border-2 border-blue-200 bg-blue-50 rounded-2xl active:bg-blue-100 transition-colors text-left"
          >
            <span className="text-4xl">👩‍🏫</span>
            <div>
              <p className="text-lg font-bold text-gray-900">I work at this school</p>
              <p className="text-sm text-gray-500 mt-0.5">Sign in with your school email</p>
            </div>
          </button>

          <button
            onClick={() => { setIsGuest(true); setStep('what') }}
            className="w-full flex items-center gap-4 p-5 border-2 border-gray-200 bg-white rounded-2xl active:bg-gray-50 transition-colors text-left"
          >
            <span className="text-4xl">🙋</span>
            <div>
              <p className="text-lg font-bold text-gray-900">I&apos;m a visitor</p>
              <p className="text-sm text-gray-500 mt-0.5">Continue without an account</p>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ── What is the problem? ──────────────────────────────────────────────────────
  if (step === 'what') {
    return (
      <div className="space-y-4">
        {progressBar}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          {loggedInUser && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2 font-medium">
              👋 Hello, {loggedInUser.name}
            </p>
          )}
          <h2 className="text-xl font-bold text-gray-900">What do you need?</h2>
          <div className="space-y-3">
            {WHAT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setWhat(opt.value); setStep('how-urgent') }}
                className={`w-full flex items-center gap-4 p-5 border-2 rounded-2xl text-left transition-all ${
                  what === opt.value ? opt.selectedColor : opt.color
                }`}
              >
                <span className="text-4xl">{opt.icon}</span>
                <span className="text-lg font-semibold text-gray-900">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── How urgent? ───────────────────────────────────────────────────────────────
  if (step === 'how-urgent') {
    return (
      <div className="space-y-4">
        {progressBar}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">How urgent is it?</h2>
          <div className="space-y-3">
            {URGENCY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setUrgency(opt.value); setStep('your-details') }}
                className={`w-full flex items-center gap-4 p-5 border-2 rounded-2xl text-left transition-all ${
                  urgency === opt.value
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-400'
                    : 'border-gray-200 bg-white active:bg-gray-50'
                }`}
              >
                <span className="text-3xl">{opt.icon}</span>
                <div>
                  <p className="text-lg font-semibold text-gray-900">{opt.label}</p>
                  <p className="text-sm text-gray-500">{opt.sub}</p>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setStep('what')} className="w-full text-gray-400 text-sm py-2">← Go back</button>
        </div>
      </div>
    )
  }

  // ── Your details ──────────────────────────────────────────────────────────────
  if (step === 'your-details') {
    const canContinue = name.trim().length > 0

    return (
      <div className="space-y-4">
        {progressBar}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-xl font-bold text-gray-900">Your details</h2>

          <div>
            <label className="block text-base font-semibold text-gray-700 mb-2">Your name *</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-base focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="e.g. Miss Smith"
              value={name}
              onChange={e => setName(e.target.value)}
              readOnly={!!loggedInUser}
              autoComplete="name"
            />
          </div>

          {isGuest && (
            <>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  Phone number <span className="text-gray-400 font-normal text-sm">(optional)</span>
                </label>
                <input
                  type="tel"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-base focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="e.g. 07700 900000"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  Email <span className="text-gray-400 font-normal text-sm">(optional)</span>
                </label>
                <input
                  type="email"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-base focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </>
          )}

          <button
            onClick={() => canContinue && setStep('description')}
            disabled={!canContinue}
            className="w-full py-5 text-lg font-bold rounded-2xl bg-blue-700 text-white disabled:opacity-40 active:bg-blue-800 transition-colors"
          >
            Continue →
          </button>
          <button onClick={() => setStep('how-urgent')} className="w-full text-gray-400 text-sm py-2">← Go back</button>
        </div>
      </div>
    )
  }

  // ── Description ───────────────────────────────────────────────────────────────
  if (step === 'description') {
    const placeholder =
      what === 'issue' ? "Tell us what's wrong — e.g. the screen is cracked, it won't turn on, the battery dies quickly…"
      : what === 'relocate' ? "Where do you need it moved, and why?"
      : "How long do you need it for, and what will you use it for?"

    const canSubmit = description.trim().length > 0

    return (
      <div className="space-y-4">
        {progressBar}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-xl font-bold text-gray-900">
            {what === 'issue' ? "What's the problem?" : what === 'relocate' ? 'Where and why?' : 'Tell us more'}
          </h2>

          <textarea
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-base focus:outline-none focus:border-blue-500 transition-colors resize-none"
            rows={5}
            placeholder={placeholder}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}

          <button
            onClick={submit}
            disabled={loading || !canSubmit}
            className="w-full py-5 text-lg font-bold rounded-2xl bg-blue-700 text-white disabled:opacity-40 active:bg-blue-800 transition-colors"
          >
            {loading ? 'Sending…' : 'Send Request ✓'}
          </button>
          <button onClick={() => setStep('your-details')} className="w-full text-gray-400 text-sm py-2">← Go back</button>
        </div>
      </div>
    )
  }

  return null
}
