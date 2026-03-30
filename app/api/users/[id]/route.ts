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

  // Fetch target user to check their current role
  const target = await db.getUserById(id)
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Admin cannot edit superadmin accounts
  if (target.role === 'superadmin' && !isSuperAdmin(auth)) {
    return NextResponse.json({ error: 'Only Super Admin can edit Super Admin accounts' }, { status: 403 })
  }

  // Admin cannot assign admin/superadmin roles
  if ((role === 'admin' || role === 'superadmin') && !isSuperAdmin(auth)) {
    return NextResponse.json({ error: 'Only Super Admin can assign Admin roles' }, { status: 403 })
  }

  // Check email uniqueness (excluding current user)
  const existing = await db.getUserByEmail(email.toLowerCase().trim())
  if (existing && existing.id !== id) {
    return NextResponse.json({ error: 'Email already in use by another account' }, { status: 400 })
  }

  await db.updateUser(id, name.trim(), email.toLowerCase().trim(), role)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  // Prevent deleting yourself
  if (auth.userId === id) return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })

  // Admin cannot delete superadmin accounts
  const target = await db.getUserById(id)
  if (target?.role === 'superadmin' && !isSuperAdmin(auth)) {
    return NextResponse.json({ error: 'Only Super Admin can delete Super Admin accounts' }, { status: 403 })
  }

  await db.deleteUser(id)
  return NextResponse.json({ ok: true })
}
