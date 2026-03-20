'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Location { id: number; name: string }

const ASSET_TYPES = ['iPad', 'Laptop', 'Chromebook', 'Desktop', 'Printer', 'Projector', 'Camera', 'Monitor', 'Tablet', 'Other']

export default function NewAssetPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    type: 'iPad',
    model: '',
    serial_number: '',
    location_id: '',
    notes: '',
    purchase_date: '',
    warranty_expiry: '',
  })

  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(setLocations)
  }, [])

  function update(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          location_id: form.location_id ? Number(form.location_id) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create asset')
        return
      }
      router.push(`/asset/${data.id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-60 pt-14 lg:pt-0">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/assets" className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Register New Asset</h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="label">Device Name *</label>
              <input className="input" value={form.name} onChange={e => update('name', e.target.value)}
                placeholder="e.g. Class 3 iPad #1" required />
            </div>

            {/* Type */}
            <div>
              <label className="label">Device Type *</label>
              <select className="input" value={form.type} onChange={e => update('type', e.target.value)} required>
                {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Model */}
            <div>
              <label className="label">Model</label>
              <input className="input" value={form.model} onChange={e => update('model', e.target.value)}
                placeholder="e.g. iPad 9th Gen, 64GB" />
            </div>

            {/* Serial */}
            <div>
              <label className="label">Serial Number</label>
              <input className="input" value={form.serial_number} onChange={e => update('serial_number', e.target.value)}
                placeholder="e.g. DMQXY9ABA1" />
            </div>

            {/* Location */}
            <div>
              <label className="label">Current Location</label>
              <select className="input" value={form.location_id} onChange={e => update('location_id', e.target.value)}>
                <option value="">— Select location —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            {/* Purchase Date */}
            <div>
              <label className="label">Purchase Date</label>
              <input type="date" className="input" value={form.purchase_date}
                onChange={e => update('purchase_date', e.target.value)} />
            </div>

            {/* Warranty */}
            <div>
              <label className="label">Warranty Expiry</label>
              <input type="date" className="input" value={form.warranty_expiry}
                onChange={e => update('warranty_expiry', e.target.value)} />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={3} value={form.notes}
                onChange={e => update('notes', e.target.value)}
                placeholder="Any additional notes about this device…" />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Registering…' : 'Register & Generate QR Code'}
            </button>
            <Link href="/assets" className="btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
