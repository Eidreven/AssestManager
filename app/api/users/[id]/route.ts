import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin, isSuperAdmin } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const { name, email, role } = await req.json()
  if (!name || !email || !role) return NextResponse.json({ error: 'Name, email and role are required' }, { status: 400 })

  const target = await db.getUserById(id)
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (target.role === 'superadmin' && !isSuperAdmin(auth)) {
    return NextResponse.json({ error: 'Only Super Admin can edit Super Admin accounts' }, { status: 403 })
  }
  if ((role === 'admin' || role === 'superadmin') && !isSuperAdmin(auth)) {
    return NextResponse.json({ error: 'Only Super Admin can assign Admin roles' }, { status: 403 })
  }

  const existing = await db.getUserByEmail(email.toLowerCase().trim())
  if (existing && existing.id !== id) {
    return NextResponse.json({ error: 'Email already in use by another account' }, { status: 400 })
  }

  await db.updateUser(id, name.trim(), email.toLowerCase().trim(), role)

  // Build change description for audit log
  const changes: string[] = []
  if (target.name !== name.trim()) changes.push(`name: "${target.name}" → "${name.trim()}"`)
  if (target.email !== email.toLowerCase().trim()) changes.push(`email: ${target.email} → ${email.toLowerCase().trim()}`)
  if (target.role !== role) changes.push(`role: ${target.role} → ${role}`)
  const detail = changes.length > 0 ? `Updated ${target.name} (${target.email}): ${changes.join(', ')}` : `Updated ${target.name} (no changes)`

  try { await db.logActivity(auth.userId, auth.name, 'user_updated', detail) } catch {}

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  if (auth.userId === id) return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })

  const target = await db.getUserById(id)
  if (target?.role === 'superadmin' && !isSuperAdmin(auth)) {
    return NextResponse.json({ error: 'Only Super Admin can delete Super Admin accounts' }, { status: 403 })
  }

  await db.deleteUser(id)
  try { await db.logActivity(auth.userId, auth.name, 'user_deleted', `Deleted account: ${target?.name} (${target?.email}) [${target?.role}]`) } catch {}

  return NextResponse.json({ ok: true })
}
