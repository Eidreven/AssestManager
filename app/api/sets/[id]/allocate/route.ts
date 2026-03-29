import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

// POST — allocate all devices in set to the set's responsible teacher
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const setId = Number(params.id)
  const set = await db.getSetById(setId)
  if (!set) return NextResponse.json({ error: 'Set not found' }, { status: 404 })

  const { responsible_teacher, notes } = await req.json()
  const teacher = responsible_teacher?.trim() || set.responsible_teacher
  if (!teacher) return NextResponse.json({ error: 'No responsible teacher set' }, { status: 400 })

  const assets = await db.getAssetsInSet(setId)

  await Promise.all(assets.map(async asset => {
    // Close existing allocation first
    if (asset.current_allocation) {
      await db.returnAllocation(asset.current_allocation.id, asset.id)
    }
    await db.createAllocation({
      asset_id: asset.id,
      allocated_to: teacher,
      allocated_to_role: 'Teacher',
      allocated_by_id: auth.userId,
      location_id: set.location_id ?? undefined,
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
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const setId = Number(params.id)
  const assets = await db.getAssetsInSet(setId)

  await Promise.all(assets.map(async asset => {
    if (asset.current_allocation) {
      await db.returnAllocation(asset.current_allocation.id, asset.id)
    }
  }))

  return NextResponse.json({ ok: true, count: assets.length })
}
