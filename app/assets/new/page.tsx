'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface Location { id: number; name: string }

const IT_TYPES = ['iPad', 'Laptop', 'Chromebook', 'Desktop', 'Printer', 'Projector', 'Smartboard', 'Camera', 'Monitor', 'Tablet', 'Other']
const CLASSROOM_TYPES = ['Chair', 'Table', 'Desk', 'Cupboard', 'Bookshelf', 'Fridge', 'Whiteboard', 'Storage', 'Appliance', 'Other']

type AssetClass = 'it' | 'classroom'
type TrackingMode = 'individual' | 'quantity'

function initialForm(assetClass: AssetClass) {
  return {
    asset_class: assetClass,
    tracking_mode: 'individual' as TrackingMode,
    name: '',
    type: assetClass === 'it' ? 'iPad' : 'Chair',
    model: '',
    serial_number: '',
    location_id: '',
    notes: '',
    purchase_date: '',
    warranty_expiry: '',
    purchase_cost: '',
    supplier: '',
    condition: 'good',
    quantity_total: '1',
    quantity_good: '1',
    quantity_fair: '0',
    quantity_damaged: '0',
    quantity_missing: '0',
  }
}

export default function NewAssetPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 lg:pl-60 pt-14 lg:pt-0"><div className="p-8 text-gray-500">Loading asset form...</div></div>}>
      <NewAssetForm />
    </Suspense>
  )
}

function NewAssetForm() {
  const searchParams = useSearchParams()
  const initialClass: AssetClass = searchParams.get('class') === 'classroom' ? 'classroom' : 'it'
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdAsset, setCreatedAsset] = useState<{ id: number; asset_tag: string; name: string; asset_class: AssetClass } | null>(null)
  const [form, setForm] = useState(() => initialForm(initialClass))

  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(setLocations)
  }, [])

  const assetTypes = form.asset_class === 'it' ? IT_TYPES : CLASSROOM_TYPES
  const backHref = `/assets?class=${form.asset_class}`

  function update(key: string, value: string) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function changeClass(assetClass: AssetClass) {
    setForm(current => ({
      ...current,
      asset_class: assetClass,
      type: assetClass === 'it' ? 'iPad' : 'Chair',
      tracking_mode: 'individual',
      quantity_total: '1',
      quantity_good: '1',
      quantity_fair: '0',
      quantity_damaged: '0',
      quantity_missing: '0',
    }))
  }

  function changeTrackingMode(mode: TrackingMode) {
    setForm(current => ({
      ...current,
      tracking_mode: mode,
      quantity_total: mode === 'individual' ? '1' : current.quantity_total,
      quantity_good: mode === 'individual' ? (current.condition === 'good' ? '1' : '0') : current.quantity_good,
      quantity_fair: mode === 'individual' ? (current.condition === 'fair' ? '1' : '0') : current.quantity_fair,
      quantity_damaged: mode === 'individual' ? (current.condition === 'damaged' ? '1' : '0') : current.quantity_damaged,
      quantity_missing: mode === 'individual' ? (current.condition === 'missing' ? '1' : '0') : current.quantity_missing,
    }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          location_id: form.location_id ? Number(form.location_id) : undefined,
          purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : undefined,
          quantity_total: Number(form.quantity_total),
          quantity_good: Number(form.quantity_good),
          quantity_fair: Number(form.quantity_fair),
          quantity_damaged: Number(form.quantity_damaged),
          quantity_missing: Number(form.quantity_missing),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'Failed to create asset')
        return
      }
      setCreatedAsset({ id: data.id, asset_tag: data.asset_tag, name: data.name, asset_class: data.asset_class })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-60 pt-14 lg:pt-0">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={backHref} className="p-1.5 hover:bg-gray-200 rounded-lg" aria-label="Back to assets">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">School Asset Register</p>
            <h1 className="text-2xl font-bold text-gray-900">Register new asset</h1>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        {createdAsset ? (
          <div className="card p-8 space-y-5">
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <h2 className="font-semibold text-xl text-gray-900">Asset registered</h2>
              <p className="text-gray-600 text-sm mt-1"><span className="font-mono font-bold text-blue-800">{createdAsset.asset_tag}</span> - {createdAsset.name}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/asset/${createdAsset.id}`} className="btn-primary">View asset</Link>
              <button onClick={() => { setCreatedAsset(null); setForm(initialForm(createdAsset.asset_class)) }} className="btn-secondary">Add another</button>
              <Link href={`/assets?class=${createdAsset.asset_class}`} className="btn-secondary">Return to register</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="card p-6">
              <h2 className="font-semibold text-gray-900">1. Choose the register</h2>
              <p className="text-sm text-gray-500 mt-1 mb-4">IT and classroom assets remain separate throughout the system.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {([
                  { value: 'it', title: 'IT asset', detail: 'Devices, smartboards, printers and technology' },
                  { value: 'classroom', title: 'Classroom asset', detail: 'Furniture, appliances, storage and general equipment' },
                ] as const).map(option => (
                  <button key={option.value} type="button" onClick={() => changeClass(option.value)} className={`text-left p-4 rounded-xl border-2 transition-colors ${form.asset_class === option.value ? 'border-blue-700 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <span className="font-semibold text-gray-900">{option.title}</span>
                    <span className="block text-sm text-gray-500 mt-1">{option.detail}</span>
                  </button>
                ))}
              </div>
            </section>

            {form.asset_class === 'classroom' && (
              <section className="card p-6">
                <h2 className="font-semibold text-gray-900">2. Choose how it is counted</h2>
                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                  {([
                    { value: 'individual', title: 'Individual item', detail: 'One fridge, smart appliance or valuable item' },
                    { value: 'quantity', title: 'Quantity group', detail: 'A group such as 24 chairs in one classroom' },
                  ] as const).map(option => (
                    <button key={option.value} type="button" onClick={() => changeTrackingMode(option.value)} className={`text-left p-4 rounded-xl border-2 transition-colors ${form.tracking_mode === option.value ? 'border-amber-600 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                      <span className="font-semibold text-gray-900">{option.title}</span>
                      <span className="block text-sm text-gray-500 mt-1">{option.detail}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="card p-6 space-y-5">
              <div>
                <h2 className="font-semibold text-gray-900">{form.asset_class === 'classroom' ? '3' : '2'}. Asset details</h2>
                <p className="text-sm text-gray-500 mt-1">Fields shown below match the selected register and tracking method.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Asset name *</label>
                  <input className="input" value={form.name} onChange={e => update('name', e.target.value)} placeholder={form.asset_class === 'it' ? 'e.g. Room 4 Smartboard' : form.tracking_mode === 'quantity' ? 'e.g. Room 4 Student Chairs' : 'e.g. Staff Room Fridge'} required />
                </div>
                <div>
                  <label className="label">Category *</label>
                  <select className="input" value={form.type} onChange={e => update('type', e.target.value)} required>{assetTypes.map(type => <option key={type}>{type}</option>)}</select>
                </div>
                <div>
                  <label className="label">Current location</label>
                  <select className="input" value={form.location_id} onChange={e => update('location_id', e.target.value)}>
                    <option value="">Select location</option>
                    {locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
                  </select>
                </div>

                {form.tracking_mode === 'quantity' ? (
                  <>
                    <div>
                      <label className="label">Total quantity *</label>
                      <input type="number" min="1" step="1" className="input" value={form.quantity_total} onChange={e => update('quantity_total', e.target.value)} required />
                    </div>
                    <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-gray-50 border border-gray-200 p-4">
                      {([
                        ['quantity_good', 'Good'], ['quantity_fair', 'Fair'], ['quantity_damaged', 'Damaged'], ['quantity_missing', 'Missing'],
                      ] as const).map(([key, label]) => (
                        <div key={key}><label className="label">{label}</label><input type="number" min="0" step="1" className="input" value={form[key]} onChange={e => update(key, e.target.value)} /></div>
                      ))}
                      <p className="col-span-2 sm:col-span-4 text-xs text-gray-500">Condition quantities must add up to the total quantity.</p>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="label">Condition</label>
                    <select className="input" value={form.condition} onChange={e => update('condition', e.target.value)}>
                      <option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option><option value="missing">Missing</option>
                    </select>
                  </div>
                )}

                <div><label className="label">Model or description</label><input className="input" value={form.model} onChange={e => update('model', e.target.value)} /></div>
                <div><label className="label">Serial number</label><input className="input" value={form.serial_number} onChange={e => update('serial_number', e.target.value)} disabled={form.tracking_mode === 'quantity'} /></div>
                <div><label className="label">Purchase date</label><input type="date" className="input" value={form.purchase_date} onChange={e => update('purchase_date', e.target.value)} /></div>
                <div><label className="label">Warranty expiry</label><input type="date" className="input" value={form.warranty_expiry} onChange={e => update('warranty_expiry', e.target.value)} /></div>
                <div><label className="label">Purchase cost</label><input type="number" min="0" step="0.01" className="input" value={form.purchase_cost} onChange={e => update('purchase_cost', e.target.value)} placeholder="0.00" /></div>
                <div><label className="label">Supplier</label><input className="input" value={form.supplier} onChange={e => update('supplier', e.target.value)} /></div>
                <div className="sm:col-span-2"><label className="label">Notes</label><textarea className="input resize-none" rows={3} value={form.notes} onChange={e => update('notes', e.target.value)} /></div>
              </div>
            </section>

            <div className="flex justify-end gap-3">
              <Link href={backHref} className="btn-secondary">Cancel</Link>
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Registering...' : `Register ${form.asset_class === 'it' ? 'IT' : 'classroom'} asset`}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
