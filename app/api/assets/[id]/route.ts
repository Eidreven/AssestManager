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

  const allowed = ['asset_tag', 'name', 'type', 'model', 'serial_number', 'status', 'location_id', 'notes', 'purchase_date', 'warranty_expiry']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key] === '' ? null : body[key]
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
        const oldVal = (before as Record<string, unknown>)[key] ?? null
        const newVal = (asset as Record<string, unknown>)[key] ?? null
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
