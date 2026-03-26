import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'assets.db')

let _db: Database.Database | null = null

export function resetDb(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}

export function getDb(): Database.Database {
  if (_db) return _db

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  initSchema(_db)
  return _db
}

function initSchema(db: Database.Database) {
  // Migrate existing DB: add priority column if missing
  try { db.exec(`ALTER TABLE requests ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'`) } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

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
    );

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
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      request_type TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      requester_name TEXT NOT NULL,
      requester_email TEXT,
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
    );
  `)
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  name: string
  email: string
  password_hash: string
  role: 'admin' | 'staff'
  created_at: string
}

export interface Location {
  id: number
  name: string
  description: string | null
  created_at: string
}

export interface Asset {
  id: number
  asset_tag: string
  name: string
  type: string
  model: string | null
  serial_number: string | null
  status: 'available' | 'allocated' | 'maintenance' | 'retired'
  location_id: number | null
  notes: string | null
  purchase_date: string | null
  warranty_expiry: string | null
  created_at: string
  updated_at: string
}

export interface AssetWithDetails extends Asset {
  location_name: string | null
  current_allocation: AllocationWithDetails | null
}

export interface Allocation {
  id: number
  asset_id: number
  allocated_to: string
  allocated_to_role: string | null
  allocated_by_id: number | null
  location_id: number | null
  purpose: string | null
  is_temporary: number
  allocated_at: string
  expected_return: string | null
  returned_at: string | null
  notes: string | null
}

export interface AllocationWithDetails extends Allocation {
  allocated_by_name: string | null
  location_name: string | null
  asset_name: string | null
  asset_tag: string | null
  asset_type: string | null
}

export interface Request {
  id: number
  asset_id: number
  request_type: 'relocate' | 'borrow' | 'issue'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  requester_name: string
  requester_email: string | null
  requester_class: string | null
  from_location_id: number | null
  to_location_id: number | null
  reason: string | null
  duration: string | null
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  handled_by_id: number | null
  handled_at: string | null
  handler_notes: string | null
  created_at: string
}

export interface RequestWithDetails extends Request {
  asset_name: string | null
  asset_tag: string | null
  asset_type: string | null
  from_location_name: string | null
  to_location_name: string | null
  handled_by_name: string | null
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export const db = {
  // Users
  getUserByEmail(email: string): User | undefined {
    return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined
  },
  getUserById(id: number): User | undefined {
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined
  },
  createUser(name: string, email: string, passwordHash: string, role: string = 'staff'): number {
    const result = getDb().prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(name, email, passwordHash, role)
    return result.lastInsertRowid as number
  },
  getAllUsers(): Omit<User, 'password_hash'>[] {
    return getDb().prepare('SELECT id, name, email, role, created_at FROM users ORDER BY name').all() as Omit<User, 'password_hash'>[]
  },

  // Locations
  getAllLocations(): Location[] {
    return getDb().prepare('SELECT * FROM locations ORDER BY name').all() as Location[]
  },
  createLocation(name: string, description?: string): number {
    const result = getDb().prepare(
      'INSERT INTO locations (name, description) VALUES (?, ?)'
    ).run(name, description ?? null)
    return result.lastInsertRowid as number
  },
  deleteLocation(id: number): void {
    getDb().prepare('DELETE FROM locations WHERE id = ?').run(id)
  },

  // Assets
  getAllAssets(): AssetWithDetails[] {
    const rows = getDb().prepare(`
      SELECT
        a.*,
        l.name AS location_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      ORDER BY a.asset_tag ASC
    `).all() as (Asset & { location_name: string | null })[]

    return rows.map(row => ({
      ...row,
      current_allocation: db.getCurrentAllocation(row.id),
    }))
  },

  getAssetById(id: number): AssetWithDetails | undefined {
    const row = getDb().prepare(`
      SELECT a.*, l.name AS location_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.id = ?
    `).get(id) as (Asset & { location_name: string | null }) | undefined

    if (!row) return undefined
    return { ...row, current_allocation: db.getCurrentAllocation(id) }
  },

  getAssetByTag(tag: string): AssetWithDetails | undefined {
    const row = getDb().prepare(`
      SELECT a.*, l.name AS location_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.asset_tag = ?
    `).get(tag) as (Asset & { location_name: string | null }) | undefined

    if (!row) return undefined
    return { ...row, current_allocation: db.getCurrentAllocation(row.id) }
  },

  createAsset(data: {
    asset_tag: string
    name: string
    type: string
    model?: string
    serial_number?: string
    location_id?: number
    notes?: string
    purchase_date?: string
    warranty_expiry?: string
  }): number {
    const result = getDb().prepare(`
      INSERT INTO assets (asset_tag, name, type, model, serial_number, location_id, notes, purchase_date, warranty_expiry)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.asset_tag, data.name, data.type,
      data.model ?? null, data.serial_number ?? null,
      data.location_id ?? null, data.notes ?? null,
      data.purchase_date ?? null, data.warranty_expiry ?? null
    )
    return result.lastInsertRowid as number
  },

  updateAsset(id: number, data: Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at'>>): void {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
    const values = Object.values(data)
    getDb().prepare(`UPDATE assets SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...values, id)
  },

  deleteAsset(id: number): void {
    getDb().prepare('DELETE FROM assets WHERE id = ?').run(id)
  },

  nextAssetTag(type: string): string {
    const prefix = type.substring(0, 3).toUpperCase()
    const latest = getDb().prepare(
      `SELECT asset_tag FROM assets WHERE asset_tag LIKE ? ORDER BY asset_tag DESC LIMIT 1`
    ).get(`MPS-${prefix}-%`) as { asset_tag: string } | undefined

    if (!latest) return `MPS-${prefix}-001`
    const num = parseInt(latest.asset_tag.split('-').pop() ?? '0', 10)
    return `MPS-${prefix}-${String(num + 1).padStart(3, '0')}`
  },

  // Allocations
  getCurrentAllocation(assetId: number): AllocationWithDetails | null {
    const row = getDb().prepare(`
      SELECT al.*, u.name AS allocated_by_name, l.name AS location_name,
             a.name AS asset_name, a.asset_tag, a.type AS asset_type
      FROM allocations al
      LEFT JOIN users u ON al.allocated_by_id = u.id
      LEFT JOIN locations l ON al.location_id = l.id
      LEFT JOIN assets a ON al.asset_id = a.id
      WHERE al.asset_id = ? AND al.returned_at IS NULL
      ORDER BY al.allocated_at DESC LIMIT 1
    `).get(assetId) as AllocationWithDetails | null

    return row ?? null
  },

  getAllocationHistory(assetId: number): AllocationWithDetails[] {
    return getDb().prepare(`
      SELECT al.*, u.name AS allocated_by_name, l.name AS location_name,
             a.name AS asset_name, a.asset_tag, a.type AS asset_type
      FROM allocations al
      LEFT JOIN users u ON al.allocated_by_id = u.id
      LEFT JOIN locations l ON al.location_id = l.id
      LEFT JOIN assets a ON al.asset_id = a.id
      WHERE al.asset_id = ?
      ORDER BY al.allocated_at DESC
    `).all(assetId) as AllocationWithDetails[]
  },

  getAllAllocations(): AllocationWithDetails[] {
    return getDb().prepare(`
      SELECT al.*, u.name AS allocated_by_name, l.name AS location_name,
             a.name AS asset_name, a.asset_tag, a.type AS asset_type
      FROM allocations al
      LEFT JOIN users u ON al.allocated_by_id = u.id
      LEFT JOIN locations l ON al.location_id = l.id
      LEFT JOIN assets a ON al.asset_id = a.id
      ORDER BY al.allocated_at DESC
    `).all() as AllocationWithDetails[]
  },

  createAllocation(data: {
    asset_id: number
    allocated_to: string
    allocated_to_role?: string
    allocated_by_id?: number
    location_id?: number
    purpose?: string
    is_temporary?: boolean
    expected_return?: string
    notes?: string
  }): number {
    const result = getDb().prepare(`
      INSERT INTO allocations
        (asset_id, allocated_to, allocated_to_role, allocated_by_id, location_id, purpose, is_temporary, expected_return, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.asset_id, data.allocated_to,
      data.allocated_to_role ?? null,
      data.allocated_by_id ?? null,
      data.location_id ?? null,
      data.purpose ?? null,
      data.is_temporary ? 1 : 0,
      data.expected_return ?? null,
      data.notes ?? null
    )

    // Update asset status
    const status = data.is_temporary ? 'allocated' : 'allocated'
    getDb().prepare(`UPDATE assets SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, data.asset_id)

    return result.lastInsertRowid as number
  },

  returnAllocation(allocationId: number, assetId: number): void {
    getDb().prepare(`UPDATE allocations SET returned_at = datetime('now') WHERE id = ?`).run(allocationId)
    getDb().prepare(`UPDATE assets SET status = 'available', updated_at = datetime('now') WHERE id = ?`).run(assetId)
  },

  // Requests
  getAllRequests(): RequestWithDetails[] {
    return getDb().prepare(`
      SELECT r.*,
             a.name AS asset_name, a.asset_tag, a.type AS asset_type,
             fl.name AS from_location_name, tl.name AS to_location_name,
             u.name AS handled_by_name
      FROM requests r
      LEFT JOIN assets a ON r.asset_id = a.id
      LEFT JOIN locations fl ON r.from_location_id = fl.id
      LEFT JOIN locations tl ON r.to_location_id = tl.id
      LEFT JOIN users u ON r.handled_by_id = u.id
      ORDER BY r.created_at DESC
    `).all() as RequestWithDetails[]
  },

  getPendingRequests(): RequestWithDetails[] {
    return getDb().prepare(`
      SELECT r.*,
             a.name AS asset_name, a.asset_tag, a.type AS asset_type,
             fl.name AS from_location_name, tl.name AS to_location_name,
             u.name AS handled_by_name
      FROM requests r
      LEFT JOIN assets a ON r.asset_id = a.id
      LEFT JOIN locations fl ON r.from_location_id = fl.id
      LEFT JOIN locations tl ON r.to_location_id = tl.id
      LEFT JOIN users u ON r.handled_by_id = u.id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
    `).all() as RequestWithDetails[]
  },

  getRequestsByAsset(assetId: number): RequestWithDetails[] {
    return getDb().prepare(`
      SELECT r.*,
             a.name AS asset_name, a.asset_tag, a.type AS asset_type,
             fl.name AS from_location_name, tl.name AS to_location_name,
             u.name AS handled_by_name
      FROM requests r
      LEFT JOIN assets a ON r.asset_id = a.id
      LEFT JOIN locations fl ON r.from_location_id = fl.id
      LEFT JOIN locations tl ON r.to_location_id = tl.id
      LEFT JOIN users u ON r.handled_by_id = u.id
      WHERE r.asset_id = ?
      ORDER BY r.created_at DESC
    `).all(assetId) as RequestWithDetails[]
  },

  createRequest(data: {
    asset_id: number
    request_type: string
    priority?: string
    requester_name: string
    requester_email?: string
    requester_class?: string
    from_location_id?: number
    to_location_id?: number
    reason?: string
    duration?: string
  }): number {
    const result = getDb().prepare(`
      INSERT INTO requests
        (asset_id, request_type, priority, requester_name, requester_email, requester_class,
         from_location_id, to_location_id, reason, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.asset_id, data.request_type,
      data.priority ?? 'medium',
      data.requester_name,
      data.requester_email ?? null,
      data.requester_class ?? null,
      data.from_location_id ?? null,
      data.to_location_id ?? null,
      data.reason ?? null,
      data.duration ?? null
    )
    return result.lastInsertRowid as number
  },

  updateRequestStatus(id: number, status: string, handledById?: number, handlerNotes?: string): void {
    getDb().prepare(`
      UPDATE requests
      SET status = ?, handled_by_id = ?, handled_at = datetime('now'), handler_notes = ?
      WHERE id = ?
    `).run(status, handledById ?? null, handlerNotes ?? null, id)
  },

  // Stats
  getStats(): {
    total: number
    available: number
    allocated: number
    maintenance: number
    retired: number
    pendingRequests: number
  } {
    const counts = getDb().prepare(`
      SELECT status, COUNT(*) as count FROM assets GROUP BY status
    `).all() as { status: string; count: number }[]

    const map: Record<string, number> = {}
    counts.forEach(r => { map[r.status] = r.count })
    const total = counts.reduce((s, r) => s + r.count, 0)
    const pendingRequests = (getDb().prepare(`SELECT COUNT(*) as c FROM requests WHERE status = 'pending'`).get() as { c: number }).c

    return {
      total,
      available: map['available'] ?? 0,
      allocated: map['allocated'] ?? 0,
      maintenance: map['maintenance'] ?? 0,
      retired: map['retired'] ?? 0,
      pendingRequests,
    }
  },
}
