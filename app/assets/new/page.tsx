'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'

interface Location { id: number; name: string }

const ASSET_TYPES = ['iPad', 'Laptop', 'Chromebook', 'Desktop', 'Printer', 'Projector', 'Camera', 'Monitor', 'Tablet', 'Other']

export default function NewAssetPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdAsset, setCreatedAsset] = useState<{ id: number; asset_tag: string; name: string; type: string; model: string } | null>(null)

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
      setCreatedAsset({ id: data.id, asset_tag: data.asset_tag, name: form.name, type: form.type, model: form.model })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-60 pt-14 lg:pt-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/assets" className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Register New Asset</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Form */}
          <div className="flex-1 w-full">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            {createdAsset ? (
              <div className="card p-6 space-y-4">
                <div className="flex items-center gap-3 text-green-700">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <h2 className="font-semibold text-lg">Asset Registered!</h2>
                </div>
                <p className="text-gray-600 text-sm">
                  <span className="font-mono font-bold text-blue-800">{createdAsset.asset_tag}</span> — {createdAsset.name} has been added. The QR code is ready on the right.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href={`/asset/${createdAsset.id}`} className="btn-primary">
                    View Asset Page
                  </Link>
                  <button
                    onClick={() => {
                      setCreatedAsset(null)
                      setForm({ name: '', type: 'iPad', model: '', serial_number: '', location_id: '', notes: '', purchase_date: '', warranty_expiry: '' })
                    }}
                    className="btn-secondary"
                  >
                    Add Another Device
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="card p-6 space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="label">Device Name *</label>
                    <input className="input" value={form.name} onChange={e => update('name', e.target.value)}
                      placeholder="e.g. Class 3 iPad #1" required />
                  </div>

                  <div>
                    <label className="label">Device Type *</label>
                    <select className="input" value={form.type} onChange={e => update('type', e.target.value)} required>
                      {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="label">Model</label>
                    <input className="input" value={form.model} onChange={e => update('model', e.target.value)}
                      placeholder="e.g. iPad 9th Gen, 64GB" />
                  </div>

                  <div>
                    <label className="label">Serial Number</label>
                    <input className="input" value={form.serial_number} onChange={e => update('serial_number', e.target.value)}
                      placeholder="e.g. DMQXY9ABA1" />
                  </div>

                  <div>
                    <label className="label">Current Location</label>
                    <select className="input" value={form.location_id} onChange={e => update('location_id', e.target.value)}>
                      <option value="">— Select location —</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="label">Purchase Date</label>
                    <input type="date" className="input" value={form.purchase_date}
                      onChange={e => update('purchase_date', e.target.value)} />
                  </div>

                  <div>
                    <label className="label">Warranty Expiry</label>
                    <input type="date" className="input" value={form.warranty_expiry}
                      onChange={e => update('warranty_expiry', e.target.value)} />
                  </div>

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
            )}
          </div>

          {/* QR Panel */}
          <div className="w-full lg:w-72 lg:sticky lg:top-6">
            {createdAsset ? (
              <div className="card overflow-hidden">
                {/* QR label preview */}
                <div className="bg-blue-900 text-white text-center py-3 px-4">
                  <p className="text-xs text-blue-200 font-medium tracking-widest uppercase">Macfarlane Primary School</p>
                  <p className="font-bold text-sm mt-0.5">Asset Management</p>
                </div>
                <div className="bg-white flex items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/assets/${createdAsset.id}/qr?format=svg`}
                    alt={`QR code for ${createdAsset.asset_tag}`}
                    width={200}
                    height={200}
                    className="block"
                  />
                </div>
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 text-center">
                  <p className="font-mono font-bold text-blue-900 text-lg tracking-wide">{createdAsset.asset_tag}</p>
                  <p className="font-semibold text-gray-800 text-sm mt-0.5">{createdAsset.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{createdAsset.type}{createdAsset.model ? ` · ${createdAsset.model}` : ''}</p>
                  <p className="text-gray-400 text-xs mt-2">Scan to view details & submit requests</p>
                </div>

                {/* Buttons */}
                <div className="p-4 border-t border-gray-100 space-y-2">
                  <a
                    href={`/api/assets/${createdAsset.id}/qr`}
                    download={`${createdAsset.asset_tag}-qr.png`}
                    className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PNG
                  </a>
                  <Link
                    href={`/asset/${createdAsset.id}/qr`}
                    target="_blank"
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print Label
                  </Link>
                </div>
              </div>
            ) : (
              <div className="card p-6 text-center text-gray-400 space-y-3">
                <div className="w-16 h-16 bg-gray-100 rounded-xl mx-auto flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <p className="text-sm">QR code will appear here after you register the device</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
