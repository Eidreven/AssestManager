import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

export async function GET() {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assets = await db.getAllAssets()
  return NextResponse.json(assets)
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, type, model, serial_number, location_id, notes, purchase_date, warranty_expiry } = body

  if (!name || !type) {
    return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
  }

  // Auto-generate asset tag
  const asset_tag = await db.nextAssetTag(type)

  const id = await db.createAsset({
    asset_tag,
    name,
    type,
    model,
    serial_number,
    location_id: location_id ? Number(location_id) : undefined,
    notes,
    purchase_date,
    warranty_expiry,
    created_by_id: auth.userId,
  })

  const asset = await db.getAssetById(id)
  return NextResponse.json(asset, { status: 201 })
}
