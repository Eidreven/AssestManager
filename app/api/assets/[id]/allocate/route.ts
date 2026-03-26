import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const assetId = Number(params.id)
  const asset = await db.getAssetById(assetId)
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  const body = await req.json()
  const { allocated_to, allocated_to_role, location_id, purpose, is_temporary, expected_return, notes } = body

  if (!allocated_to) return NextResponse.json({ error: 'allocated_to is required' }, { status: 400 })

  // Return current allocation if exists
  if (asset.current_allocation) {
    await db.returnAllocation(asset.current_allocation.id, assetId)
  }

  const id = await db.createAllocation({
    asset_id: assetId,
    allocated_to,
    allocated_to_role,
    allocated_by_id: auth.userId,
    location_id: location_id ? Number(location_id) : undefined,
    purpose,
    is_temporary: Boolean(is_temporary),
    expected_return,
    notes,
  })

  return NextResponse.json({ id }, { status: 201 })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const assetId = Number(params.id)
  const asset = await db.getAssetById(assetId)
  if (!asset?.current_allocation) {
    return NextResponse.json({ error: 'No active allocation' }, { status: 400 })
  }

  await db.returnAllocation(asset.current_allocation.id, assetId)
  return NextResponse.json({ ok: true })
}
