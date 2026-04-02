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

  // Fetch current status before update so we can detect changes
  const before = 'status' in update ? await db.getAssetById(id) : null

  await db.updateAsset(id, update as Parameters<typeof db.updateAsset>[1])

  // Log status changes to asset timeline
  if (before && update.status && update.status !== before.status) {
    await db.logAssetEvent(id, 'status_changed', auth.name, auth.userId,
      `Status changed from ${before.status} to ${update.status}`)
  }

  const asset = await db.getAssetById(id)
  return NextResponse.json(asset)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(auth)) return NextResponse.json({ error: 'Forbidden – Super Admin only' }, { status: 403 })

  await db.deleteAsset(Number(params.id))
  return NextResponse.json({ ok: true })
}
