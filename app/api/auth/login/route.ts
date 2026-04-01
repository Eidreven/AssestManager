import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { signToken, setAuthCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const user = await db.getUserByEmail(email.toLowerCase().trim())
  if (!user) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as 'superadmin' | 'admin' | 'teacher',
  })

  setAuthCookie(token)

  // Log login (fire-and-forget — don't block response)
  db.logActivity(user.id, user.name, 'login', `Signed in as ${user.role}`).catch(() => {})

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Server error: ' + String(err) }, { status: 500 })
  }
}
