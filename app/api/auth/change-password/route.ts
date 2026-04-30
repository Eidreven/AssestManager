import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getAuthFromCookies, setAuthCookie, signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { password } = await req.json()
  if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  if (password === 'mc2026') return NextResponse.json({ error: 'Choose a password different from the temporary password' }, { status: 400 })

  const user = await db.getUserById(auth.userId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const hash = await bcrypt.hash(password, 12)
  await db.updateUserPassword(user.id, hash, false)

  const token = signToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: false,
    impersonatedBy: auth.impersonatedBy,
    impersonatedByName: auth.impersonatedByName,
  })
  setAuthCookie(token)

  return NextResponse.json({ ok: true })
}
