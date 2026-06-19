import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const [session, items] = await Promise.all([
    db.getHandoverSessionById(id),
    db.getHandoverItems(id),
  ])
  if (!session) return NextResponse.json({ error: 'Handover session not found' }, { status: 404 })

  return NextResponse.json({ session, items })
}
