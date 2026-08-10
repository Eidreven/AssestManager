import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isSuperAdmin, setAuthCookie, signToken } from '@/lib/auth'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(auth)) return NextResponse.json({ error: 'Super Admin only' }, { status: 403 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const target = await db.getUserById(id)
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const token = signToken({
    userId: target.id,
    email: target.email,
    name: target.name,
    role: target.role,
    authVersion: target.auth_version,
    mustChangePassword: false,
    impersonatedBy: auth.userId,
    impersonatedByName: auth.name,
  })
  setAuthCookie(token)

  return NextResponse.json({ ok: true, user: { id: target.id, name: target.name, email: target.email, role: target.role } })
}
