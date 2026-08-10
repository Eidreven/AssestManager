import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description, location_type = 'other' } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!['classroom', 'other'].includes(location_type)) return NextResponse.json({ error: 'Invalid location type' }, { status: 400 })

  await db.updateLocation(Number(params.id), name.trim(), description?.trim() || null, location_type)

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.deleteLocation(Number(params.id))
  return NextResponse.json({ ok: true })
}
