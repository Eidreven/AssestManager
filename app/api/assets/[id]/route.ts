import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin, isSuperAdmin } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const asset = await db.getAssetById(Number(params.id))
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(asset)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.id)
  const body = await req.json()

  const allowed = [
    'asset_tag', 'name', 'type', 'model', 'serial_number', 'status', 'location_id', 'notes',
    'purchase_date', 'warranty_expiry', 'asset_class', 'tracking_mode', 'quantity_total',
    'condition', 'quantity_good', 'quantity_fair', 'quantity_damaged', 'quantity_missing',
    'purchase_cost', 'supplier',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key] === '' ? null : body[key]
  }
  const trackingMode = String(update.tracking_mode ?? body.tracking_mode ?? 'individual')
  if (trackingMode === 'individual') {
    const condition = String(update.condition ?? body.condition ?? 'good')
    update.quantity_total = 1
    update.quantity_good = condition === 'good' ? 1 : 0
    update.quantity_fair = condition === 'fair' ? 1 : 0
    update.quantity_damaged = condition === 'damaged' ? 1 : 0
    update.quantity_missing = condition === 'missing' ? 1 : 0
  }
  const total = Number(update.quantity_total ?? 1)
  const conditionCounts = ['quantity_good', 'quantity_fair', 'quantity_damaged', 'quantity_missing']
    .map(key => Number(update[key] ?? 0))
  if (!['it', 'classroom'].includes(String(update.asset_class ?? body.asset_class ?? 'it')) ||
      !['individual', 'quantity'].includes(trackingMode)) {
    return NextResponse.json({ error: 'Invalid asset classification' }, { status: 400 })
  }
  if (trackingMode === 'quantity' && (!Number.isInteger(total) || total < 1 || conditionCounts.some(value => !Number.isInteger(value) || value < 0) || conditionCounts.reduce((a, b) => a + b, 0) !== total)) {
    return NextResponse.json({ error: 'Condition quantities must be whole numbers that equal the total quantity' }, { status: 400 })
  }

  // Enforce serial number uniqueness (exclude self)
  if (update.serial_number && typeof update.serial_number === 'string' && update.serial_number.trim()) {
    const existing = await db.getAssetBySerial(update.serial_number.trim())
    if (existing && existing.id !== id) {
      return NextResponse.json(
        { error: `Serial number already registered to asset ${existing.asset_tag}` },
        { status: 409 }
      )
    }
  }

  // Fetch before state to detect what changed
  const before = await db.getAssetById(id)

  await db.updateAsset(id, update as Parameters<typeof db.updateAsset>[1])
  const asset = await db.getAssetById(id)

  // Build change log from before → after comparison
  if (before && asset) {
    const FIELD_LABELS: Record<string, string> = {
      name: 'Name', type: 'Type', model: 'Model', asset_tag: 'Asset tag',
      serial_number: 'Serial number', notes: 'Notes',
      purchase_date: 'Purchase date', warranty_expiry: 'Warranty expiry',
      asset_class: 'Asset class', tracking_mode: 'Tracking mode', quantity_total: 'Total quantity',
      condition: 'Condition', quantity_good: 'Good', quantity_fair: 'Fair',
      quantity_damaged: 'Damaged', quantity_missing: 'Missing', purchase_cost: 'Purchase cost', supplier: 'Supplier',
    }

    // Status change — separate event type
    if (update.status !== undefined && before.status !== asset.status) {
      await db.logAssetEvent(id, 'status_changed', auth.name, auth.userId,
        `Status changed from ${before.status} to ${asset.status}`)
    }

    // Location change — use resolved names
    if (update.location_id !== undefined && before.location_id !== asset.location_id) {
      const from = before.location_name ?? 'None'
      const to = asset.location_name ?? 'None'
      await db.logAssetEvent(id, 'edited', auth.name, auth.userId, `Location: ${from} → ${to}`)
    }

    // All other text/date fields
    const changes: string[] = []
    for (const [key, label] of Object.entries(FIELD_LABELS)) {
      if (key in update) {
        const oldVal = (before as unknown as Record<string, unknown>)[key] ?? null
        const newVal = (asset as unknown as Record<string, unknown>)[key] ?? null
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          changes.push(`${label}: "${oldVal ?? '—'}" → "${newVal ?? '—'}"`)
        }
      }
    }
    if (changes.length > 0) {
      await db.logAssetEvent(id, 'edited', auth.name, auth.userId, changes.join(' · '))
    }
  }

  return NextResponse.json(asset)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(auth)) return NextResponse.json({ error: 'Forbidden – Super Admin only' }, { status: 403 })

  await db.deleteAsset(Number(params.id))
  return NextResponse.json({ ok: true })
}
