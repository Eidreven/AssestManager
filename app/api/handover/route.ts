import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

export async function GET() {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(await db.getAllHandoverSessions())
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, notes } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const [allocations, assets] = await Promise.all([
    db.getAllAllocations(),
    db.getAllAssets(),
  ])
  const assetMap = new Map(assets.map(a => [a.id, a]))
  const activeAllocations = allocations.filter(a => !a.returned_at)

  const id = await db.createHandoverSession(title.trim(), notes?.trim() || null, auth.userId)

  for (const allocation of activeAllocations) {
    const asset = assetMap.get(allocation.asset_id)
    const user = await db.getUserByName(allocation.allocated_to)
    await db.createHandoverItem({
      session_id: id,
      asset_id: allocation.asset_id,
      allocation_id: allocation.id,
      set_id: asset?.set_id ?? null,
      holder_name: allocation.allocated_to,
      holder_email: user?.email ?? null,
    })
  }

  return NextResponse.json({ id }, { status: 201 })
}
