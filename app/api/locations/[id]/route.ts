import { NextRequest, NextResponse } from 'next/server'
import { db, getDb } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  getDb().prepare('UPDATE locations SET name = ?, description = ? WHERE id = ?')
    .run(name.trim(), description?.trim() || null, Number(params.id))

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  db.deleteLocation(Number(params.id))
  return NextResponse.json({ ok: true })
}
