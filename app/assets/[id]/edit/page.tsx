'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Location { id: number; name: string }
interface Asset {
  id: number; asset_tag: string; name: string; type: string; model?: string
  serial_number?: string; location_id?: number; status: string; notes?: string
  purchase_date?: string; warranty_expiry?: string
  asset_class: 'it' | 'classroom'; tracking_mode: 'individual' | 'quantity'
  quantity_total: number; condition: string; quantity_good: number; quantity_fair: number
  quantity_damaged: number; quantity_missing: number; purchase_cost?: number; supplier?: string
}

const IT_TYPES = ['iPad', 'Laptop', 'Chromebook', 'Desktop', 'Printer', 'Projector', 'Smartboard', 'Camera', 'Monitor', 'Tablet', 'Other']
const CLASSROOM_TYPES = ['Chair', 'Table', 'Desk', 'Cupboard', 'Bookshelf', 'Fridge', 'Whiteboard', 'Storage', 'Appliance', 'Other']
const STATUSES = ['available', 'allocated', 'maintenance', 'retired']

function tagPrefix(type: string) { return type.substring(0, 3).toUpperCase() }
function tagMatchesType(tag: string, type: string) { return tag.startsWith(`MPS-${tagPrefix(type)}-`) }

export default function EditAssetPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [asset, setAsset] = useState<Asset | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [tagLoading, setTagLoading] = useState(false)
  const [tagChanged, setTagChanged] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    asset_tag: '', name: '', type: 'iPad', model: '', serial_number: '',
    location_id: '', status: 'available', notes: '', purchase_date: '', warranty_expiry: '',
    asset_class: 'it' as 'it' | 'classroom', tracking_mode: 'individual' as 'individual' | 'quantity',
    quantity_total: '1', condition: 'good', quantity_good: '1', quantity_fair: '0',
    quantity_damaged: '0', quantity_missing: '0', purchase_cost: '', supplier: '',
  })

  useEffect(() => {
    Promise.all([
      fetch(`/api/assets/${id}`).then(r => r.json()),
      fetch('/api/locations').then(r => r.json()),
    ]).then(([a, locs]) => {
      setAsset(a)
      setLocations(locs)
      setForm({
        asset_tag: a.asset_tag ?? '',
        name: a.name ?? '',
        type: a.type ?? 'iPad',
        model: a.model ?? '',
        serial_number: a.serial_number ?? '',
        location_id: a.location_id ? String(a.location_id) : '',
        status: a.status ?? 'available',
        notes: a.notes ?? '',
        purchase_date: a.purchase_date ?? '',
        warranty_expiry: a.warranty_expiry ?? '',
        asset_class: a.asset_class ?? 'it',
        tracking_mode: a.tracking_mode ?? 'individual',
        quantity_total: String(a.quantity_total ?? 1),
        condition: a.condition ?? 'good',
        quantity_good: String(a.quantity_good ?? 1),
        quantity_fair: String(a.quantity_fair ?? 0),
        quantity_damaged: String(a.quantity_damaged ?? 0),
        quantity_missing: String(a.quantity_missing ?? 0),
        purchase_cost: a.purchase_cost != null ? String(a.purchase_cost) : '',
        supplier: a.supplier ?? '',
      })
    })
  }, [id])

  async function handleTypeChange(newType: string) {
    const oldType = form.type
    setForm(f => ({ ...f, type: newType }))

    // Auto-update tag if it was generated for the old type
    if (tagMatchesType(form.asset_tag, oldType)) {
      setTagLoading(true)
      try {
        const res = await fetch(`/api/assets/next-tag?type=${encodeURIComponent(newType)}`)
        if (res.ok) {
          const { tag } = await res.json()
          setForm(f => ({ ...f, type: newType, asset_tag: tag }))
          setTagChanged(true)
        }
      } catch {}
      setTagLoading(false)
    }
  }

  function update(key: string, value: string) { setForm(f => ({ ...f, [key]: value })) }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/assets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          location_id: form.location_id ? Number(form.location_id) : null,
          quantity_total: Number(form.quantity_total),
          quantity_good: Number(form.quantity_good),
          quantity_fair: Number(form.quantity_fair),
          quantity_damaged: Number(form.quantity_damaged),
          quantity_missing: Number(form.quantity_missing),
          purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      router.push(`/asset/${id}`)
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${asset?.asset_tag}? This cannot be undone.`)) return
    await fetch(`/api/assets/${id}`, { method: 'DELETE' })
      router.push(`/assets?class=${form.asset_class}`)
  }

  if (!asset) return <div className="p-8 text-gray-400">Loading…</div>

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-60 pt-14 lg:pt-0">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/asset/${id}`} className="p-1.5 hover:bg-gray-200 rounded-lg">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Asset</h1>
            <p className="text-gray-500 text-sm">{asset.asset_tag}</p>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Asset Tag — readonly, auto-updates with type */}
            <div>
              <label className="label">Asset Tag</label>
              <div className="relative">
                <input
                  className="input font-mono pr-8"
                  value={tagLoading ? 'Generating…' : form.asset_tag}
                  onChange={e => { update('asset_tag', e.target.value); setTagChanged(false) }}
                  readOnly={tagLoading}
                />
                {tagChanged && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-amber-600 font-medium">updated</span>
                )}
              </div>
              {tagChanged && (
                <p className="text-xs text-amber-600 mt-1">Tag updated to match new device type.</p>
              )}
            </div>

            <div className="sm:col-span-2 sm:hidden" />

            <div className="sm:col-span-2">
              <label className="label">Device Name *</label>
              <input className="input" value={form.name} onChange={e => update('name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Type *</label>
              <select className="input" value={form.type} onChange={e => handleTypeChange(e.target.value)}>
                {(form.asset_class === 'it' ? IT_TYPES : CLASSROOM_TYPES).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Asset Register</label>
              <select className="input" value={form.asset_class} onChange={e => update('asset_class', e.target.value)}>
                <option value="it">IT Assets</option>
                <option value="classroom">Classroom Assets</option>
              </select>
            </div>
            {form.asset_class === 'classroom' && (
              <div>
                <label className="label">Tracking Mode</label>
                <select className="input" value={form.tracking_mode} onChange={e => update('tracking_mode', e.target.value)}>
                  <option value="individual">Individual item</option>
                  <option value="quantity">Quantity group</option>
                </select>
              </div>
            )}
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => update('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Model</label>
              <input className="input" value={form.model} onChange={e => update('model', e.target.value)} />
            </div>
            <div>
              <label className="label">Serial Number</label>
              <input className="input" value={form.serial_number} onChange={e => update('serial_number', e.target.value)} disabled={form.tracking_mode === 'quantity'} />
            </div>
            {form.tracking_mode === 'quantity' ? (
              <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-xl bg-gray-50 border border-gray-200 p-4">
                {([['quantity_total', 'Total'], ['quantity_good', 'Good'], ['quantity_fair', 'Fair'], ['quantity_damaged', 'Damaged'], ['quantity_missing', 'Missing']] as const).map(([key, label]) => (
                  <div key={key}><label className="label">{label}</label><input type="number" min={key === 'quantity_total' ? 1 : 0} className="input" value={form[key]} onChange={e => update(key, e.target.value)} /></div>
                ))}
              </div>
            ) : (
              <div>
                <label className="label">Condition</label>
                <select className="input" value={form.condition} onChange={e => update('condition', e.target.value)}>
                  <option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option><option value="missing">Missing</option>
                </select>
              </div>
            )}
            <div>
              <label className="label">Location</label>
              <select className="input" value={form.location_id} onChange={e => update('location_id', e.target.value)}>
                <option value="">— None —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Purchase Date</label>
              <input type="date" className="input" value={form.purchase_date} onChange={e => update('purchase_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Warranty Expiry</label>
              <input type="date" className="input" value={form.warranty_expiry} onChange={e => update('warranty_expiry', e.target.value)} />
            </div>
            <div><label className="label">Purchase Cost</label><input type="number" min="0" step="0.01" className="input" value={form.purchase_cost} onChange={e => update('purchase_cost', e.target.value)} /></div>
            <div><label className="label">Supplier</label><input className="input" value={form.supplier} onChange={e => update('supplier', e.target.value)} /></div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={3} value={form.notes} onChange={e => update('notes', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={handleDelete} className="btn-danger">Delete Asset</button>
            <div className="flex gap-3">
              <Link href={`/asset/${id}`} className="btn-secondary">Cancel</Link>
              <button type="submit" className="btn-primary" disabled={loading || tagLoading}>{loading ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
