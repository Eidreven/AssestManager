import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, setAuthCookie, signToken } from '@/lib/auth'

export async function POST() {
  const auth = getAuthFromCookies()
  if (!auth?.impersonatedBy) return NextResponse.json({ error: 'Not impersonating' }, { status: 400 })

  const original = await db.getUserById(auth.impersonatedBy)
  if (!original) return NextResponse.json({ error: 'Original user not found' }, { status: 404 })

  const token = signToken({
    userId: original.id,
    email: original.email,
    name: original.name,
    role: original.role,
    mustChangePassword: Boolean(original.must_change_password),
  })
  setAuthCookie(token)

  return NextResponse.json({ ok: true })
}
