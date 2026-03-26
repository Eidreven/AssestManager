import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const token = getAuthFromRequest(req)
  if (!token || token.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const db = getDb()

  // Export all tables as JSON
  const [users, locations, assets, allocations, requests] = await Promise.all([
    db.execute('SELECT id, name, email, role, created_at FROM users ORDER BY id'),
    db.execute('SELECT * FROM locations ORDER BY id'),
    db.execute('SELECT * FROM assets ORDER BY id'),
    db.execute('SELECT * FROM allocations ORDER BY id'),
    db.execute('SELECT * FROM requests ORDER BY id'),
  ])

  const backup = {
    exported_at: new Date().toISOString(),
    version: 1,
    users: users.rows,
    locations: locations.rows,
    assets: assets.rows,
    allocations: allocations.rows,
    requests: requests.rows,
  }

  const json = JSON.stringify(backup, null, 2)
  const date = new Date().toISOString().slice(0, 10)
  const filename = `assets-backup-${date}.json`

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function POST(req: NextRequest) {
  const token = getAuthFromRequest(req)
  if (!token || token.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!file.name.endsWith('.json')) return NextResponse.json({ error: 'File must be a .json backup file' }, { status: 400 })

  let backup: {
    version: number
    users?: Record<string, unknown>[]
    locations?: Record<string, unknown>[]
    assets?: Record<string, unknown>[]
    allocations?: Record<string, unknown>[]
    requests?: Record<string, unknown>[]
  }

  try {
    backup = JSON.parse(await file.text())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 })
  }

  if (!backup.version) return NextResponse.json({ error: 'Invalid backup file format' }, { status: 400 })

  const db = getDb()

  await db.execute('DELETE FROM requests')
  await db.execute('DELETE FROM allocations')
  await db.execute('DELETE FROM assets')
  await db.execute('DELETE FROM locations')

  for (const row of backup.locations ?? []) {
    await db.execute('INSERT OR REPLACE INTO locations (id, name, description, created_at) VALUES (?, ?, ?, ?)',
      [row.id as number, row.name as string, (row.description ?? null) as string | null, row.created_at as string])
  }

  for (const row of backup.assets ?? []) {
    await db.execute(`INSERT OR REPLACE INTO assets
      (id, asset_tag, name, type, model, serial_number, status, location_id, notes, purchase_date, warranty_expiry, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id as number, row.asset_tag as string, row.name as string, row.type as string,
       (row.model ?? null) as string | null, (row.serial_number ?? null) as string | null,
       (row.status ?? 'available') as string, (row.location_id ?? null) as number | null,
       (row.notes ?? null) as string | null, (row.purchase_date ?? null) as string | null,
       (row.warranty_expiry ?? null) as string | null, row.created_at as string, row.updated_at as string])
  }

  for (const row of backup.allocations ?? []) {
    await db.execute(`INSERT OR REPLACE INTO allocations
      (id, asset_id, allocated_to, allocated_to_role, allocated_by_id, location_id, purpose,
       is_temporary, allocated_at, expected_return, returned_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id as number, row.asset_id as number, row.allocated_to as string,
       (row.allocated_to_role ?? null) as string | null, (row.allocated_by_id ?? null) as number | null,
       (row.location_id ?? null) as number | null, (row.purpose ?? null) as string | null,
       (row.is_temporary ?? 0) as number, row.allocated_at as string,
       (row.expected_return ?? null) as string | null, (row.returned_at ?? null) as string | null,
       (row.notes ?? null) as string | null])
  }

  for (const row of backup.requests ?? []) {
    await db.execute(`INSERT OR REPLACE INTO requests
      (id, asset_id, request_type, priority, requester_name, requester_email, requester_phone,
       requester_class, from_location_id, to_location_id, reason, duration, status,
       handled_by_id, handled_at, handler_notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id as number, row.asset_id as number, row.request_type as string,
       (row.priority ?? 'medium') as string, row.requester_name as string,
       (row.requester_email ?? null) as string | null, (row.requester_phone ?? null) as string | null,
       (row.requester_class ?? null) as string | null, (row.from_location_id ?? null) as number | null,
       (row.to_location_id ?? null) as number | null, (row.reason ?? null) as string | null,
       (row.duration ?? null) as string | null, (row.status ?? 'pending') as string,
       (row.handled_by_id ?? null) as number | null, (row.handled_at ?? null) as string | null,
       (row.handler_notes ?? null) as string | null, row.created_at as string])
  }

  return NextResponse.json({ message: 'Database restored successfully from JSON backup.' })
}
