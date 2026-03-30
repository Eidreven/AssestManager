import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

// POST — allocate all devices in set to the set's responsible teacher
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const setId = Number(params.id)
  const set = await db.getSetById(setId)
  if (!set) return NextResponse.json({ error: 'Set not found' }, { status: 404 })

  const { responsible_teacher, location_id: bodyLocationId, notes } = await req.json()
  const teacher = (responsible_teacher?.trim()) || set.responsible_teacher || null
  const locationId: number | null = bodyLocationId ?? set.location_id ?? null

  if (!teacher && !locationId) {
    return NextResponse.json({ error: 'Select a person or location to allocate to' }, { status: 400 })
  }

  const assets = await db.getAssetsInSet(setId)

  await Promise.all(assets.map(async asset => {
    if (asset.current_allocation) {
      await db.returnAllocation(asset.current_allocation.id, asset.id)
    }
    await db.createAllocation({
      asset_id: asset.id,
      allocated_to: teacher ?? 'Class Set',
      allocated_to_role: teacher ? 'Teacher' : 'Location',
      allocated_by_id: auth.userId,
      location_id: locationId ?? undefined,
      purpose: `Class set: ${set.name}`,
      is_temporary: false,
      notes: notes || null,
    })
  }))

  return NextResponse.json({ ok: true, count: assets.length })
}

// DELETE — return all devices in set
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const setId = Number(params.id)
  const assets = await db.getAssetsInSet(setId)

  await Promise.all(assets.map(async asset => {
    if (asset.current_allocation) {
      await db.returnAllocation(asset.current_allocation.id, asset.id)
    }
  }))

  return NextResponse.json({ ok: true, count: assets.length })
}
