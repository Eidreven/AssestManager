import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

export async function GET() {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(await db.getAllLocations())
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description, location_type = 'other' } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!['classroom', 'other'].includes(location_type)) return NextResponse.json({ error: 'Invalid location type' }, { status: 400 })

  const id = await db.createLocation(name.trim(), description?.trim() || undefined, location_type)
  return NextResponse.json({ id, name: name.trim(), description: description?.trim() || null, location_type }, { status: 201 })
}
