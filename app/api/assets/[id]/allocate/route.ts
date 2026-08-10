import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { sendAllocationNotification, sendReturnNotification, sendDeviceAllocatedToTeacher } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const assetId = Number(params.id)
  const asset = await db.getAssetById(assetId)
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  if (asset.tracking_mode === 'quantity') {
    return NextResponse.json({ error: 'Quantity-tracked classroom records cannot be allocated to an individual' }, { status: 400 })
  }

  const body = await req.json()
  const { allocated_to, allocated_to_role, location_id, set_id, purpose, is_temporary, expected_return, notes } = body

  if (!allocated_to) return NextResponse.json({ error: 'allocated_to is required' }, { status: 400 })

  const previousAllocation = asset.current_allocation
  if (previousAllocation) await db.returnAllocation(previousAllocation.id, assetId)

  let id: number
  try {
    if (set_id) await db.addAssetToSet(assetId, Number(set_id))
    id = await db.createAllocation({
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
  } catch (error) {
    if (previousAllocation) {
      await db.restoreAllocation(previousAllocation.id, assetId)
    }
    throw error
  }

  // Email notifications (best-effort)
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
  } catch (err) { console.error('Allocation admin email error:', err) }

  // Email the teacher/person if they have an account
  try {
    const teacher = await db.getUserByName(allocated_to)
    if (teacher?.email) {
      await sendDeviceAllocatedToTeacher({
        teacherEmail: teacher.email,
        teacherName: teacher.name,
        assetTag: asset.asset_tag,
        assetName: asset.name,
        assetType: asset.type,
        locationName,
        purpose: purpose ?? null,
        isTemporary: Boolean(is_temporary),
        expectedReturn: expected_return ?? null,
        allocatedByName: auth.name,
        notes: notes ?? null,
      })
    }
  } catch (err) { console.error('Allocation teacher email error:', err) }

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
