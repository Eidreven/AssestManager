import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const session = await db.getHandoverSessionById(id)
  if (!session) return NextResponse.json({ error: 'Handover session not found' }, { status: 404 })

  await db.updateHandoverSession(id, {
    status: 'closed',
    closed_at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
