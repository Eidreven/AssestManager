/**
 * Seed script — creates initial admin account, locations, and sample assets.
 * Run with: npm run seed
 *
 * Requires env vars: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 * For local dev, these can be set in .env.local or omitted (defaults to file:data/assets.db)
 */

import pkg from '@libsql/client'
const { createClient } = pkg
import bcrypt from 'bcryptjs'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'file:data/assets.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// ── Schema ────────────────────────────────────────────────────────────────────
await client.execute(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    created_at TEXT DEFAULT (datetime('now'))
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_tag TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    model TEXT,
    serial_number TEXT,
    status TEXT NOT NULL DEFAULT 'available',
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    notes TEXT,
    purchase_date TEXT,
    warranty_expiry TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    allocated_to TEXT NOT NULL,
    allocated_to_role TEXT,
    allocated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    purpose TEXT,
    is_temporary INTEGER NOT NULL DEFAULT 0,
    allocated_at TEXT DEFAULT (datetime('now')),
    expected_return TEXT,
    returned_at TEXT,
    notes TEXT
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    requester_name TEXT NOT NULL,
    requester_email TEXT,
    requester_phone TEXT,
    requester_class TEXT,
    from_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    to_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    reason TEXT,
    duration TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    handled_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    handled_at TEXT,
    handler_notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

// ── Users ─────────────────────────────────────────────────────────────────────
const existingAdminResult = await client.execute({
  sql: "SELECT id FROM users WHERE email = ?",
  args: ['admin@macfarlane.sch'],
})
if (existingAdminResult.rows.length === 0) {
  const hash = await bcrypt.hash('admin1234', 12)
  await client.execute({
    sql: "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
    args: ['IT Admin', 'admin@macfarlane.sch', hash, 'admin'],
  })
  console.log('Admin user created: admin@macfarlane.sch / admin1234')
} else {
  console.log('Admin user already exists')
}

const existingStaffResult = await client.execute({
  sql: "SELECT id FROM users WHERE email = ?",
  args: ['teacher@macfarlane.sch'],
})
if (existingStaffResult.rows.length === 0) {
  const hash = await bcrypt.hash('teacher1234', 12)
  await client.execute({
    sql: "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
    args: ['Sarah Johnson', 'teacher@macfarlane.sch', hash, 'staff'],
  })
  console.log('Staff user created: teacher@macfarlane.sch / teacher1234')
}

// ── Locations ─────────────────────────────────────────────────────────────────
const locationList = [
  { name: 'ICT Suite', description: 'Main computer room' },
  { name: 'Library', description: 'School library' },
  { name: 'Year 3 Classroom', description: "Mrs Brown's class" },
  { name: 'Year 4 Classroom', description: "Mr Smith's class" },
  { name: 'Year 5 Classroom', description: "Miss Davis's class" },
  { name: 'Year 6 Classroom', description: "Mr Wilson's class" },
  { name: 'Staff Room', description: 'Staff resource room' },
  { name: 'Storage', description: 'Tech storage cupboard' },
]

const locIds = {}
for (const loc of locationList) {
  const existing = await client.execute({
    sql: "SELECT id FROM locations WHERE name = ?",
    args: [loc.name],
  })
  if (existing.rows.length === 0) {
    const result = await client.execute({
      sql: "INSERT INTO locations (name, description) VALUES (?, ?)",
      args: [loc.name, loc.description],
    })
    locIds[loc.name] = Number(result.lastInsertRowid)
    console.log(`Location: ${loc.name}`)
  } else {
    locIds[loc.name] = Number(existing.rows[0].id)
  }
}

// ── Assets ────────────────────────────────────────────────────────────────────
const sampleAssets = [
  { tag: 'MPS-IPA-001', name: 'Class 3 iPad #1', type: 'iPad', model: 'iPad 9th Gen, 64GB Wi-Fi', serial: 'DMQXY9ABA1', location: 'ICT Suite', purchase: '2022-09-01', warranty: '2025-09-01' },
  { tag: 'MPS-IPA-002', name: 'Class 3 iPad #2', type: 'iPad', model: 'iPad 9th Gen, 64GB Wi-Fi', serial: 'DMQXY9ABA2', location: 'ICT Suite', purchase: '2022-09-01', warranty: '2025-09-01' },
  { tag: 'MPS-IPA-003', name: 'Class 4 iPad #1', type: 'iPad', model: 'iPad 9th Gen, 64GB Wi-Fi', serial: 'DMQXY9ABA3', location: 'Year 4 Classroom', purchase: '2022-09-01', warranty: '2025-09-01' },
  { tag: 'MPS-IPA-004', name: 'Library iPad', type: 'iPad', model: 'iPad Air 5th Gen', serial: 'H7KXM2ACD4', location: 'Library', purchase: '2023-01-15', warranty: '2026-01-15' },
  { tag: 'MPS-LAP-001', name: 'Teacher Laptop #1', type: 'Laptop', model: 'MacBook Air M1', serial: 'C02Y1KGJMD6N', location: 'Staff Room', purchase: '2021-06-01', warranty: '2024-06-01' },
  { tag: 'MPS-LAP-002', name: 'Teacher Laptop #2', type: 'Laptop', model: 'Dell Latitude 5420', serial: 'ABC123DEF456', location: 'Year 6 Classroom', purchase: '2021-09-01', warranty: '2024-09-01' },
  { tag: 'MPS-CHR-001', name: 'Student Chromebook #1', type: 'Chromebook', model: 'Lenovo 300e', serial: 'CB001LEN', location: 'ICT Suite', purchase: '2023-03-01', warranty: '2026-03-01' },
  { tag: 'MPS-CHR-002', name: 'Student Chromebook #2', type: 'Chromebook', model: 'Lenovo 300e', serial: 'CB002LEN', location: 'ICT Suite', purchase: '2023-03-01', warranty: '2026-03-01' },
  { tag: 'MPS-PRJ-001', name: 'Hall Projector', type: 'Projector', model: 'Epson EB-E01', serial: 'PROJ001EPS', location: 'ICT Suite', purchase: '2020-01-01', warranty: '2023-01-01', notes: 'Lamp replaced Oct 2022' },
  { tag: 'MPS-CAM-001', name: 'Digital Camera', type: 'Camera', model: 'Canon EOS M50', serial: 'CAM001CANON', location: 'Storage', purchase: '2021-09-01', warranty: '2024-09-01' },
]

const adminRow = await client.execute({
  sql: "SELECT id FROM users WHERE email = ?",
  args: ['admin@macfarlane.sch'],
})
const adminId = Number(adminRow.rows[0].id)

for (const a of sampleAssets) {
  const existing = await client.execute({
    sql: "SELECT id FROM assets WHERE asset_tag = ?",
    args: [a.tag],
  })
  if (existing.rows.length === 0) {
    await client.execute({
      sql: `INSERT INTO assets (asset_tag, name, type, model, serial_number, location_id, notes, purchase_date, warranty_expiry)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [a.tag, a.name, a.type, a.model, a.serial, locIds[a.location] ?? null, a.notes ?? null, a.purchase, a.warranty],
    })
    console.log(`Asset: ${a.tag} — ${a.name}`)
  }
}

// ── Sample Allocations ────────────────────────────────────────────────────────
const ipad1Row = await client.execute({ sql: "SELECT id FROM assets WHERE asset_tag = 'MPS-IPA-001'", args: [] })
const ipad3Row = await client.execute({ sql: "SELECT id FROM assets WHERE asset_tag = 'MPS-IPA-003'", args: [] })
const lap2Row  = await client.execute({ sql: "SELECT id FROM assets WHERE asset_tag = 'MPS-LAP-002'", args: [] })

const ipad1 = ipad1Row.rows[0]
const ipad3 = ipad3Row.rows[0]
const lap2  = lap2Row.rows[0]

if (ipad1) {
  const existing = await client.execute({
    sql: "SELECT id FROM allocations WHERE asset_id = ? AND returned_at IS NULL",
    args: [Number(ipad1.id)],
  })
  if (existing.rows.length === 0) {
    await client.execute({
      sql: `INSERT INTO allocations (asset_id, allocated_to, allocated_to_role, allocated_by_id, location_id, purpose, is_temporary, allocated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [Number(ipad1.id), 'Miss Emma Carter', 'Teacher', adminId, locIds['Year 3 Classroom'], 'Daily classroom use', 0, '2024-09-02T08:00:00'],
    })
    await client.execute({ sql: "UPDATE assets SET status = 'allocated' WHERE id = ?", args: [Number(ipad1.id)] })
    console.log('Allocated MPS-IPA-001 to Miss Emma Carter')
  }
}

if (ipad3) {
  const existing = await client.execute({
    sql: "SELECT id FROM allocations WHERE asset_id = ? AND returned_at IS NULL",
    args: [Number(ipad3.id)],
  })
  if (existing.rows.length === 0) {
    await client.execute({
      sql: `INSERT INTO allocations (asset_id, allocated_to, allocated_to_role, allocated_by_id, location_id, purpose, is_temporary, allocated_at, expected_return)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [Number(ipad3.id), 'Mr James Harper', 'Teacher', adminId, locIds['Year 4 Classroom'], 'Topic project work', 1, '2024-11-01T09:00:00', '2025-01-15'],
    })
    await client.execute({ sql: "UPDATE assets SET status = 'allocated' WHERE id = ?", args: [Number(ipad3.id)] })
    console.log('Allocated MPS-IPA-003 to Mr James Harper (temporary)')
  }
}

if (lap2) {
  const existing = await client.execute({
    sql: "SELECT id FROM allocations WHERE asset_id = ? AND returned_at IS NULL",
    args: [Number(lap2.id)],
  })
  if (existing.rows.length === 0) {
    await client.execute({
      sql: `INSERT INTO allocations (asset_id, allocated_to, allocated_to_role, allocated_by_id, location_id, purpose, is_temporary, allocated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [Number(lap2.id), 'Ms Olivia Price', 'Teacher', adminId, locIds['Year 6 Classroom'], 'Interactive whiteboard teaching', 0, '2023-09-04T08:30:00'],
    })
    await client.execute({ sql: "UPDATE assets SET status = 'allocated' WHERE id = ?", args: [Number(lap2.id)] })
    console.log('Allocated MPS-LAP-002 to Ms Olivia Price')
  }
}

// ── Sample pending request ─────────────────────────────────────────────────────
const chr1Row = await client.execute({ sql: "SELECT id FROM assets WHERE asset_tag = 'MPS-CHR-001'", args: [] })
const chr1 = chr1Row.rows[0]
if (chr1) {
  const existingReq = await client.execute({
    sql: "SELECT id FROM requests WHERE asset_id = ? AND status = 'pending'",
    args: [Number(chr1.id)],
  })
  if (existingReq.rows.length === 0) {
    await client.execute({
      sql: `INSERT INTO requests (asset_id, request_type, requester_name, requester_email, requester_class, reason, duration, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [Number(chr1.id), 'borrow', 'Mrs Sarah Thompson', 'sthompson@macfarlane.sch', 'Year 5', 'Need it for computing project next week', '5 days', new Date().toISOString()],
    })
    console.log('Sample pending request created')
  }
}

console.log('\nSeed complete!')
console.log('-'.repeat(40))
console.log('Login credentials:')
console.log('  Admin:   admin@macfarlane.sch / admin1234')
console.log('  Staff:   teacher@macfarlane.sch / teacher1234')
console.log('-'.repeat(40))
