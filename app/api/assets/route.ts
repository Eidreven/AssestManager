import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { normalizeInventory } from '@/lib/asset-validation'

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
  const {
    name, type, model, serial_number, location_id, notes, purchase_date, warranty_expiry,
    asset_class = 'it', tracking_mode = 'individual', quantity_total = 1,
    condition = 'good', quantity_good, quantity_fair = 0, quantity_damaged = 0,
    quantity_missing = 0, purchase_cost, supplier,
  } = body

  if (!name || !type) {
    return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
  }
  let inventory
  try {
    inventory = normalizeInventory({ asset_class, tracking_mode, condition, quantity_total, quantity_good, quantity_fair, quantity_damaged, quantity_missing })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid inventory values' }, { status: 400 })
  }

  // Enforce serial number uniqueness
  if (serial_number?.trim()) {
    const existing = await db.getAssetBySerial(serial_number.trim())
    if (existing) {
      return NextResponse.json(
        { error: `Serial number already registered to asset ${existing.asset_tag}` },
        { status: 409 }
      )
    }
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
    ...inventory,
    purchase_cost: purchase_cost ? Number(purchase_cost) : undefined,
    supplier,
  })

  const asset = await db.getAssetById(id)
  return NextResponse.json(asset, { status: 201 })
}
