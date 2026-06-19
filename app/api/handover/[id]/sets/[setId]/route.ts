import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

export async function DELETE(_req: Request, { params }: { params: { id: string; setId: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sessionId = Number(params.id)
  const setId = Number(params.setId)
  if (isNaN(sessionId) || isNaN(setId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const session = await db.getHandoverSessionById(sessionId)
  if (!session) return NextResponse.json({ error: 'Handover session not found' }, { status: 404 })

  await db.deleteHandoverItemsForSet(sessionId, setId)
  return NextResponse.json({ ok: true })
}
