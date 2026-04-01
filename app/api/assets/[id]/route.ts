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

  const before = await db.getAssetById(id)
  await db.updateAsset(id, update as Parameters<typeof db.updateAsset>[1])
  const asset = await db.getAssetById(id)

  // Log status change if the status field was updated
  if ('status' in update && before && before.status !== update.status) {
    db.logAssetEvent(id, 'status_changed', auth.name, auth.userId,
      `Status changed from ${before.status} to ${update.status}`).catch(() => {})
    db.logActivity(auth.userId, auth.name, 'status_changed',
      `${asset?.asset_tag} status: ${before.status} → ${update.status}`).catch(() => {})
  } else if (Object.keys(update).length > 0) {
    db.logAssetEvent(id, 'edited', auth.name, auth.userId,
      `Asset details updated`).catch(() => {})
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
