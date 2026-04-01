import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { sendAllocationNotification, sendReturnNotification } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const assetId = Number(params.id)
  const asset = await db.getAssetById(assetId)
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  const body = await req.json()
  const { allocated_to, allocated_to_role, location_id, set_id, purpose, is_temporary, expected_return, notes } = body

  if (!allocated_to) return NextResponse.json({ error: 'allocated_to is required' }, { status: 400 })

  if (asset.current_allocation) {
    await db.returnAllocation(asset.current_allocation.id, assetId)
  }

  if (set_id) await db.addAssetToSet(assetId, Number(set_id))

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

  // Email notification (best-effort, after response-critical work)
  const locations = location_id ? await db.getAllLocations() : []
  const locationName = locations.find(l => l.id === Number(location_id))?.name ?? null
  try {
    await sendAllocationNotification({
      assetTag: asset.asset_tag,
      assetName: asset.name,
      assetType: asset.type,
      allocatedTo: allocated_to,
      allocatedToRole: allocated_to_role ?? null,
      locationName,
      purpose: purpose ?? null,
      isTemporary: Boolean(is_temporary),
      expectedReturn: expected_return ?? null,
      allocatedByName: auth.name,
      notes: notes ?? null,
    })
  } catch (err) { console.error('Allocation email error:', err) }

  return NextResponse.json({ id }, { status: 201 })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const assetId = Number(params.id)
  const asset = await db.getAssetById(assetId)
  if (!asset?.current_allocation) {
    return NextResponse.json({ error: 'No active allocation' }, { status: 400 })
  }

  const returnedFrom = asset.current_allocation.allocated_to

  await db.returnAllocation(asset.current_allocation.id, assetId)
  if (asset.set_id) await db.removeAssetFromSet(assetId)

  try {
    await sendReturnNotification({
      assetTag: asset.asset_tag,
      assetName: asset.name,
      returnedFrom,
      returnedByName: auth.name,
    })
  } catch (err) { console.error('Return email error:', err) }

  return NextResponse.json({ ok: true })
}
