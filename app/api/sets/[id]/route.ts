import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { sendSetAllocatedToTeacher } from '@/lib/email'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  const [set, assets] = await Promise.all([db.getSetById(id), db.getAssetsInSet(id)])
  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...set, assets })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.id)
  const { name, description, responsible_teacher, location_id } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const before = await db.getSetById(id)
  const newTeacher = responsible_teacher?.trim() || null
  await db.updateSet(id, name.trim(), description?.trim() || null, newTeacher, location_id ? Number(location_id) : null)

  // Email teacher when they are newly assigned as responsible teacher
  if (newTeacher && newTeacher !== before?.responsible_teacher) {
    try {
      const teacherUser = await db.getUserByName(newTeacher)
      if (teacherUser?.email) {
        const set = await db.getSetById(id)
        await sendSetAllocatedToTeacher({
          teacherEmail: teacherUser.email,
          teacherName: teacherUser.name,
          setName: name.trim(),
          deviceCount: set?.asset_count ?? 0,
          locationName: null,
          allocatedByName: auth.name,
        })
      }
    } catch (err) { console.error('Set responsible teacher email error:', err) }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.deleteSet(Number(params.id))
  return NextResponse.json({ ok: true })
}
