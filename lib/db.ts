// Minimal Turso HTTP client using native fetch — no @libsql/client needed
type SqlValue = string | number | null
interface Row { [col: string]: SqlValue }

async function sql(query: string, args: SqlValue[] = []): Promise<{ rows: Row[]; lastInsertRowid: number | null }> {
  const baseUrl = (process.env.TURSO_DATABASE_URL ?? '')
    .replace('libsql://', 'https://')
  const token = process.env.TURSO_AUTH_TOKEN ?? ''

  const body = {
    requests: [{
      type: 'execute',
      stmt: {
        sql: query,
        args: args.map(a => {
          if (a === null) return { type: 'null' }
          if (typeof a === 'number') return Number.isInteger(a)
            ? { type: 'integer', value: String(a) }
            : { type: 'float', value: a }
          return { type: 'text', value: a }
        }),
      },
    }],
  }

  const res = await fetch(`${baseUrl}/v2/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`Turso HTTP ${res.status}: ${await res.text()}`)
  const data = await res.json() as { results: { type: string; error?: { message: string }; response?: { result: { cols: { name: string }[]; rows: SqlValue[][]; last_insert_rowid: string | null } } }[] }
  const result = data.results[0]
  if (result.type === 'error') throw new Error(result.error!.message)

  const { cols, rows, last_insert_rowid } = result.response!.result
  return {
    rows: rows.map(r => Object.fromEntries(cols.map((c, i) => {
      const cell = r[i] as { type: string; value: unknown } | null
      if (!cell || cell.type === 'null') return [c.name, null]
      if (cell.type === 'integer') return [c.name, Number(cell.value)]
      if (cell.type === 'float') return [c.name, Number(cell.value)]
      return [c.name, cell.value as SqlValue]
    }))),
    lastInsertRowid: last_insert_rowid ? Number(last_insert_rowid) : null,
  }
}

export function resetDb(): void { /* no-op for Turso */ }
export function getDb() { return { execute: sql } }

async function initSchema() {
  await sql(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    created_at TEXT DEFAULT (datetime('now'))
  )`)
  await sql(`CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`)
  await sql(`CREATE TABLE IF NOT EXISTS assets (
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
  )`)
  await sql(`CREATE TABLE IF NOT EXISTS allocations (
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
  )`)
  await sql(`CREATE TABLE IF NOT EXISTS requests (
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
  )`)
  try { await sql(`ALTER TABLE requests ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'`) } catch {}
  try { await sql(`ALTER TABLE requests ADD COLUMN requester_phone TEXT`) } catch {}
}

// Run schema init silently — errors are non-fatal (tables may already exist)
initSchema().catch(err => console.error('Schema init error:', err))

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  name: string
  email: string
  password_hash: string
  role: 'admin' | 'staff' | 'teacher'
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
  requester_phone: string | null
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
  async getUserByEmail(email: string): Promise<User | undefined> {
    const r = await sql('SELECT * FROM users WHERE email = ?', [email])
    return r.rows[0] as unknown as User | undefined
  },
  async getUserById(id: number): Promise<User | undefined> {
    const r = await sql('SELECT * FROM users WHERE id = ?', [id])
    return r.rows[0] as unknown as User | undefined
  },
  async createUser(name: string, email: string, passwordHash: string, role = 'staff'): Promise<number> {
    const r = await sql('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, passwordHash, role])
    return r.lastInsertRowid!
  },
  async getAllUsers(): Promise<Omit<User, 'password_hash'>[]> {
    const r = await sql('SELECT id, name, email, role, created_at FROM users ORDER BY name')
    return r.rows as unknown as Omit<User, 'password_hash'>[]
  },
  async getTeachers(): Promise<Omit<User, 'password_hash'>[]> {
    const r = await sql("SELECT id, name, email, role, created_at FROM users WHERE role = 'teacher' ORDER BY name")
    return r.rows as unknown as Omit<User, 'password_hash'>[]
  },

  // Locations
  async getAllLocations(): Promise<Location[]> {
    const r = await sql('SELECT * FROM locations ORDER BY name')
    return r.rows as unknown as Location[]
  },
  async createLocation(name: string, description?: string): Promise<number> {
    const r = await sql('INSERT INTO locations (name, description) VALUES (?, ?)', [name, description ?? null])
    return r.lastInsertRowid!
  },
  async updateLocation(id: number, name: string, description: string | null): Promise<void> {
    await sql('UPDATE locations SET name = ?, description = ? WHERE id = ?', [name, description, id])
  },
  async deleteLocation(id: number): Promise<void> {
    await sql('DELETE FROM locations WHERE id = ?', [id])
  },

  // Assets
  async getAllAssets(): Promise<AssetWithDetails[]> {
    const r = await sql(`
      SELECT a.*, l.name AS location_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      ORDER BY a.asset_tag ASC
    `)
    const rows = r.rows as unknown as (Asset & { location_name: string | null })[]
    return Promise.all(rows.map(async row => ({
      ...row,
      current_allocation: await db.getCurrentAllocation(row.id),
    })))
  },

  async getAssetById(id: number): Promise<AssetWithDetails | undefined> {
    const r = await sql(`
      SELECT a.*, l.name AS location_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.id = ?
    `, [id])
    const row = r.rows[0] as unknown as (Asset & { location_name: string | null }) | undefined
    if (!row) return undefined
    return { ...row, current_allocation: await db.getCurrentAllocation(id) }
  },

  async getAssetByTag(tag: string): Promise<AssetWithDetails | undefined> {
    const r = await sql(`
      SELECT a.*, l.name AS location_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.asset_tag = ?
    `, [tag])
    const row = r.rows[0] as unknown as (Asset & { location_name: string | null }) | undefined
    if (!row) return undefined
    return { ...row, current_allocation: await db.getCurrentAllocation(row.id) }
  },

  async createAsset(data: {
    asset_tag: string; name: string; type: string; model?: string
    serial_number?: string; location_id?: number; notes?: string
    purchase_date?: string; warranty_expiry?: string
  }): Promise<number> {
    const r = await sql(`
      INSERT INTO assets (asset_tag, name, type, model, serial_number, location_id, notes, purchase_date, warranty_expiry)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [data.asset_tag, data.name, data.type, data.model ?? null, data.serial_number ?? null,
        data.location_id ?? null, data.notes ?? null, data.purchase_date ?? null, data.warranty_expiry ?? null])
    return r.lastInsertRowid!
  },

  async updateAsset(id: number, data: Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
    const values = Object.values(data) as SqlValue[]
    await sql(`UPDATE assets SET ${fields}, updated_at = datetime('now') WHERE id = ?`, [...values, id])
  },

  async deleteAsset(id: number): Promise<void> {
    await sql('DELETE FROM assets WHERE id = ?', [id])
  },

  async nextAssetTag(type: string): Promise<string> {
    const prefix = type.substring(0, 3).toUpperCase()
    const r = await sql(`SELECT asset_tag FROM assets WHERE asset_tag LIKE ? ORDER BY asset_tag DESC LIMIT 1`, [`MPS-${prefix}-%`])
    const latest = r.rows[0] as unknown as { asset_tag: string } | undefined
    if (!latest) return `MPS-${prefix}-001`
    const num = parseInt((latest.asset_tag as string).split('-').pop() ?? '0', 10)
    return `MPS-${prefix}-${String(num + 1).padStart(3, '0')}`
  },

  // Allocations
  async getCurrentAllocation(assetId: number): Promise<AllocationWithDetails | null> {
    const r = await sql(`
      SELECT al.*, u.name AS allocated_by_name, l.name AS location_name,
             a.name AS asset_name, a.asset_tag, a.type AS asset_type
      FROM allocations al
      LEFT JOIN users u ON al.allocated_by_id = u.id
      LEFT JOIN locations l ON al.location_id = l.id
      LEFT JOIN assets a ON al.asset_id = a.id
      WHERE al.asset_id = ? AND al.returned_at IS NULL
      ORDER BY al.allocated_at DESC LIMIT 1
    `, [assetId])
    return (r.rows[0] as unknown as AllocationWithDetails) ?? null
  },

  async getAllocationHistory(assetId: number): Promise<AllocationWithDetails[]> {
    const r = await sql(`
      SELECT al.*, u.name AS allocated_by_name, l.name AS location_name,
             a.name AS asset_name, a.asset_tag, a.type AS asset_type
      FROM allocations al
      LEFT JOIN users u ON al.allocated_by_id = u.id
      LEFT JOIN locations l ON al.location_id = l.id
      LEFT JOIN assets a ON al.asset_id = a.id
      WHERE al.asset_id = ?
      ORDER BY al.allocated_at DESC
    `, [assetId])
    return r.rows as unknown as AllocationWithDetails[]
  },

  async getAllAllocations(): Promise<AllocationWithDetails[]> {
    const r = await sql(`
      SELECT al.*, u.name AS allocated_by_name, l.name AS location_name,
             a.name AS asset_name, a.asset_tag, a.type AS asset_type
      FROM allocations al
      LEFT JOIN users u ON al.allocated_by_id = u.id
      LEFT JOIN locations l ON al.location_id = l.id
      LEFT JOIN assets a ON al.asset_id = a.id
      ORDER BY al.allocated_at DESC
    `)
    return r.rows as unknown as AllocationWithDetails[]
  },

  async createAllocation(data: {
    asset_id: number; allocated_to: string; allocated_to_role?: string
    allocated_by_id?: number; location_id?: number; purpose?: string
    is_temporary?: boolean; expected_return?: string; notes?: string
  }): Promise<number> {
    const r = await sql(`
      INSERT INTO allocations
        (asset_id, allocated_to, allocated_to_role, allocated_by_id, location_id, purpose, is_temporary, expected_return, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [data.asset_id, data.allocated_to, data.allocated_to_role ?? null,
        data.allocated_by_id ?? null, data.location_id ?? null, data.purpose ?? null,
        data.is_temporary ? 1 : 0, data.expected_return ?? null, data.notes ?? null])
    await sql(`UPDATE assets SET status = 'allocated', updated_at = datetime('now') WHERE id = ?`, [data.asset_id])
    return r.lastInsertRowid!
  },

  async returnAllocation(allocationId: number, assetId: number): Promise<void> {
    await sql(`UPDATE allocations SET returned_at = datetime('now') WHERE id = ?`, [allocationId])
    await sql(`UPDATE assets SET status = 'available', updated_at = datetime('now') WHERE id = ?`, [assetId])
  },

  // Requests
  async getAllRequests(): Promise<RequestWithDetails[]> {
    const r = await sql(`
      SELECT r.*, a.name AS asset_name, a.asset_tag, a.type AS asset_type,
             fl.name AS from_location_name, tl.name AS to_location_name, u.name AS handled_by_name
      FROM requests r
      LEFT JOIN assets a ON r.asset_id = a.id
      LEFT JOIN locations fl ON r.from_location_id = fl.id
      LEFT JOIN locations tl ON r.to_location_id = tl.id
      LEFT JOIN users u ON r.handled_by_id = u.id
      ORDER BY r.created_at DESC
    `)
    return r.rows as unknown as RequestWithDetails[]
  },

  async getPendingRequests(): Promise<RequestWithDetails[]> {
    const r = await sql(`
      SELECT r.*, a.name AS asset_name, a.asset_tag, a.type AS asset_type,
             fl.name AS from_location_name, tl.name AS to_location_name, u.name AS handled_by_name
      FROM requests r
      LEFT JOIN assets a ON r.asset_id = a.id
      LEFT JOIN locations fl ON r.from_location_id = fl.id
      LEFT JOIN locations tl ON r.to_location_id = tl.id
      LEFT JOIN users u ON r.handled_by_id = u.id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
    `)
    return r.rows as unknown as RequestWithDetails[]
  },

  async getRequestsByAsset(assetId: number): Promise<RequestWithDetails[]> {
    const r = await sql(`
      SELECT r.*, a.name AS asset_name, a.asset_tag, a.type AS asset_type,
             fl.name AS from_location_name, tl.name AS to_location_name, u.name AS handled_by_name
      FROM requests r
      LEFT JOIN assets a ON r.asset_id = a.id
      LEFT JOIN locations fl ON r.from_location_id = fl.id
      LEFT JOIN locations tl ON r.to_location_id = tl.id
      LEFT JOIN users u ON r.handled_by_id = u.id
      WHERE r.asset_id = ?
      ORDER BY r.created_at DESC
    `, [assetId])
    return r.rows as unknown as RequestWithDetails[]
  },

  async createRequest(data: {
    asset_id: number; request_type: string; priority?: string
    requester_name: string; requester_email?: string; requester_phone?: string
    requester_class?: string; from_location_id?: number; to_location_id?: number
    reason?: string; duration?: string
  }): Promise<number> {
    const r = await sql(`
      INSERT INTO requests
        (asset_id, request_type, priority, requester_name, requester_email, requester_phone,
         requester_class, from_location_id, to_location_id, reason, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [data.asset_id, data.request_type, data.priority ?? 'medium', data.requester_name,
        data.requester_email ?? null, data.requester_phone ?? null, data.requester_class ?? null,
        data.from_location_id ?? null, data.to_location_id ?? null, data.reason ?? null, data.duration ?? null])
    return r.lastInsertRowid!
  },

  async updateRequestStatus(id: number, status: string, handledById?: number, handlerNotes?: string): Promise<void> {
    await sql(`
      UPDATE requests SET status = ?, handled_by_id = ?, handled_at = datetime('now'), handler_notes = ?
      WHERE id = ?
    `, [status, handledById ?? null, handlerNotes ?? null, id])
  },

  // Stats
  async getStats(): Promise<{ total: number; available: number; allocated: number; maintenance: number; retired: number; pendingRequests: number }> {
    const countsR = await sql(`SELECT status, COUNT(*) as count FROM assets GROUP BY status`)
    const counts = countsR.rows as unknown as { status: string; count: number }[]
    const map: Record<string, number> = {}
    counts.forEach(r => { map[r.status] = Number(r.count) })
    const total = counts.reduce((s, r) => s + Number(r.count), 0)
    const pendingR = await sql(`SELECT COUNT(*) as c FROM requests WHERE status = 'pending'`)
    const pendingRequests = Number((pendingR.rows[0] as unknown as { c: number }).c)
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
