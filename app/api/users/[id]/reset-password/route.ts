import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin, isSuperAdmin } from '@/lib/auth'
import { sendTemporaryPasswordEmail } from '@/lib/email'
import { randomBytes } from 'crypto'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const target = await db.getUserById(id)
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.role === 'superadmin' && !isSuperAdmin(auth)) {
    return NextResponse.json({ error: 'Only Super Admin can reset Super Admin accounts' }, { status: 403 })
  }

  const temporaryPassword = `${randomBytes(9).toString('base64url')}!7a`
  const hash = await bcrypt.hash(temporaryPassword, 12)
  await db.updateUserPassword(target.id, hash, true)

  try {
    await sendTemporaryPasswordEmail({
      toEmail: target.email,
      toName: target.name,
      temporaryPassword,
      resetByName: auth.name,
    })
  } catch (err) {
    console.error('Temporary password email error:', err)
    await db.updateUserPassword(target.id, target.password_hash, Boolean(target.must_change_password))
    return NextResponse.json({ error: 'Email could not be sent, so the password was not changed' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, emailSent: true })
}
