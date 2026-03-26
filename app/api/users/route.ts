import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function GET() {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(await db.getAllUsers())
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password, role } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
  }

  const existing = await db.getUserByEmail(email.toLowerCase().trim())
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
  }

  const hash = await bcrypt.hash(password, 12)
  const id = await db.createUser(name, email.toLowerCase().trim(), hash, role ?? 'staff')

  return NextResponse.json({ id, name, email, role: role ?? 'staff' }, { status: 201 })
}
