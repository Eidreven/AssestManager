import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

const STATUSES = ['pending', 'collected', 'missing', 'damaged'] as const

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.itemId)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const item = await db.getHandoverItemById(id)
  if (!item) return NextResponse.json({ error: 'Handover item not found' }, { status: 404 })

  const { status, admin_notes } = await req.json()
  if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  await db.updateHandoverItem(id, {
    status,
    admin_notes: admin_notes?.trim() || null,
  })

  const updated = await db.getHandoverItemById(id)
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.itemId)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const item = await db.getHandoverItemById(id)
  if (!item) return NextResponse.json({ error: 'Handover item not found' }, { status: 404 })

  await db.deleteHandoverItem(id)
  return NextResponse.json({ ok: true })
}
