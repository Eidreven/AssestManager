import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin, isSuperAdmin } from '@/lib/auth'
import { sendTemporaryPasswordEmail } from '@/lib/email'

const TEMPORARY_PASSWORD = 'mc2026'

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

  const hash = await bcrypt.hash(TEMPORARY_PASSWORD, 12)
  await db.updateUserPassword(target.id, hash, true)

  try {
    await sendTemporaryPasswordEmail({
      toEmail: target.email,
      toName: target.name,
      temporaryPassword: TEMPORARY_PASSWORD,
      resetByName: auth.name,
    })
  } catch (err) {
    console.error('Temporary password email error:', err)
    return NextResponse.json({ ok: true, emailSent: false })
  }

  return NextResponse.json({ ok: true, emailSent: true })
}
