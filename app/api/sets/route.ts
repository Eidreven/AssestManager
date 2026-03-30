import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

export async function GET() {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await db.getAllSets())
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description, responsible_teacher, location_id } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const id = await db.createSet(
    name.trim(),
    description?.trim() || null,
    responsible_teacher?.trim() || null,
    location_id ? Number(location_id) : null,
  )
  return NextResponse.json({ id }, { status: 201 })
}
