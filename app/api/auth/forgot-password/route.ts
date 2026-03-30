import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const user = await db.getUserByEmail(email.toLowerCase().trim())

    // Always return success to prevent email enumeration
    // Allow password reset for all account types (admin, superadmin, teacher)
    if (!user) {
      return NextResponse.json({ ok: true })
    }

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

    await db.createPasswordResetToken(user.id, token, expiresAt)

    const host = req.headers.get('host') ?? 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const resetUrl = `${protocol}://${host}/reset-password?token=${token}`

    await sendPasswordResetEmail({
      toEmail: user.email,
      toName: user.name,
      resetUrl,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Forgot password error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
