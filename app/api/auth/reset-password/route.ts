import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()
    if (!token || !password) return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

    const record = await db.getPasswordResetToken(token)

    if (!record) return NextResponse.json({ error: 'Invalid or expired reset code' }, { status: 400 })
    if (record.used) return NextResponse.json({ error: 'This reset code has already been used' }, { status: 400 })
    if (new Date(record.expires_at) < new Date()) return NextResponse.json({ error: 'This reset code has expired' }, { status: 400 })

    const hash = await bcrypt.hash(password, 12)
    await db.updateUserPassword(record.user_id, hash)
    await db.markTokenUsed(token)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Reset password error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
