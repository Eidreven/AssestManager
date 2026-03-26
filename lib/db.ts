import { createClient } from '@libsql/client'

const rawClient = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'file:data/assets.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// Proxy that auto-initializes schema on first use (avoids build-time errors on Vercel)
let schemaReady = false
const client = new Proxy(rawClient, {
  get(target, prop) {
    const val = target[prop as keyof typeof target]
    if (prop === 'execute' && typeof val === 'function') {
      return async (...args: Parameters<typeof target.execute>) => {
        if (!schemaReady) {
          await initSchema()
          schemaReady = true
        }
        return (val as typeof target.execute).apply(target, args)
      }
    }
    return typeof val === 'function' ? val.bind(target) : val
  },
})

export function resetDb(): void {
  // No-op: Turso manages connections
}

export function getDb() {
  return client
}

async function initSchema() {
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  await rawClient.execute(`
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

  await rawClient.execute(`
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

  await rawClient.execute(`
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

  // Migrations: add columns if missing (ignore errors if already exist)
  try { await rawClient.execute(`ALTER TABLE requests ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'`) } catch {}
  try { await rawClient.execute(`ALTER TABLE requests ADD COLUMN requester_phone TEXT`) } catch {}
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
    const result = await client.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] })
    return result.rows[0] as unknown as User | undefined
  },
  async getUserById(id: number): Promise<User | undefined> {
    const result = await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] })
    return result.rows[0] as unknown as User | undefined
  },
  async createUser(name: string, email: string, passwordHash: string, role: string = 'staff'): Promise<number> {
    const result = await client.execute({
      sql: 'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      args: [name, email, passwordHash, role],
    })
    return Number(result.lastInsertRowid)
  },
  async getAllUsers(): Promise<Omit<User, 'password_hash'>[]> {
    const result = await client.execute('SELECT id, name, email, role, created_at FROM users ORDER BY name')
    return result.rows as unknown as Omit<User, 'password_hash'>[]
  },

  // Locations
  async getAllLocations(): Promise<Location[]> {
    const result = await client.execute('SELECT * FROM locations ORDER BY name')
    return result.rows as unknown as Location[]
  },
  async createLocation(name: string, description?: string): Promise<number> {
    const result = await client.execute({
      sql: 'INSERT INTO locations (name, description) VALUES (?, ?)',
      args: [name, description ?? null],
    })
    return Number(result.lastInsertRowid)
  },
  async updateLocation(id: number, name: string, description: string | null): Promise<void> {
    await client.execute({
      sql: 'UPDATE locations SET name = ?, description = ? WHERE id = ?',
      args: [name, description, id],
    })
  },
  async deleteLocation(id: number): Promise<void> {
    await client.execute({ sql: 'DELETE FROM locations WHERE id = ?', args: [id] })
  },

  // Assets
  async getAllAssets(): Promise<AssetWithDetails[]> {
    const result = await client.execute(`
      SELECT
        a.*,
        l.name AS location_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      ORDER BY a.asset_tag ASC
    `)
    const rows = result.rows as unknown as (Asset & { location_name: string | null })[]

    return Promise.all(rows.map(async row => ({
      ...row,
      current_allocation: await db.getCurrentAllocation(row.id),
    })))
  },

  async getAssetById(id: number): Promise<AssetWithDetails | undefined> {
    const result = await client.execute({
      sql: `
        SELECT a.*, l.name AS location_name
        FROM assets a
        LEFT JOIN locations l ON a.location_id = l.id
        WHERE a.id = ?
      `,
      args: [id],
    })
    const row = result.rows[0] as unknown as (Asset & { location_name: string | null }) | undefined
    if (!row) return undefined
    return { ...row, current_allocation: await db.getCurrentAllocation(id) }
  },

  async getAssetByTag(tag: string): Promise<AssetWithDetails | undefined> {
    const result = await client.execute({
      sql: `
        SELECT a.*, l.name AS location_name
        FROM assets a
        LEFT JOIN locations l ON a.location_id = l.id
        WHERE a.asset_tag = ?
      `,
      args: [tag],
    })
    const row = result.rows[0] as unknown as (Asset & { location_name: string | null }) | undefined
    if (!row) return undefined
    return { ...row, current_allocation: await db.getCurrentAllocation(row.id) }
  },

  async createAsset(data: {
    asset_tag: string
    name: string
    type: string
    model?: string
    serial_number?: string
    location_id?: number
    notes?: string
    purchase_date?: string
    warranty_expiry?: string
  }): Promise<number> {
    const result = await client.execute({
      sql: `
        INSERT INTO assets (asset_tag, name, type, model, serial_number, location_id, notes, purchase_date, warranty_expiry)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        data.asset_tag, data.name, data.type,
        data.model ?? null, data.serial_number ?? null,
        data.location_id ?? null, data.notes ?? null,
        data.purchase_date ?? null, data.warranty_expiry ?? null,
      ],
    })
    return Number(result.lastInsertRowid)
  },

  async updateAsset(id: number, data: Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
    const values = Object.values(data)
    await client.execute({
      sql: `UPDATE assets SET ${fields}, updated_at = datetime('now') WHERE id = ?`,
      args: [...values, id],
    })
  },

  async deleteAsset(id: number): Promise<void> {
    await client.execute({ sql: 'DELETE FROM assets WHERE id = ?', args: [id] })
  },

  async nextAssetTag(type: string): Promise<string> {
    const prefix = type.substring(0, 3).toUpperCase()
    const result = await client.execute({
      sql: `SELECT asset_tag FROM assets WHERE asset_tag LIKE ? ORDER BY asset_tag DESC LIMIT 1`,
      args: [`MPS-${prefix}-%`],
    })
    const latest = result.rows[0] as unknown as { asset_tag: string } | undefined
    if (!latest) return `MPS-${prefix}-001`
    const num = parseInt((latest.asset_tag as string).split('-').pop() ?? '0', 10)
    return `MPS-${prefix}-${String(num + 1).padStart(3, '0')}`
  },

  // Allocations
  async getCurrentAllocation(assetId: number): Promise<AllocationWithDetails | null> {
    const result = await client.execute({
      sql: `
        SELECT al.*, u.name AS allocated_by_name, l.name AS location_name,
               a.name AS asset_name, a.asset_tag, a.type AS asset_type
        FROM allocations al
        LEFT JOIN users u ON al.allocated_by_id = u.id
        LEFT JOIN locations l ON al.location_id = l.id
        LEFT JOIN assets a ON al.asset_id = a.id
        WHERE al.asset_id = ? AND al.returned_at IS NULL
        ORDER BY al.allocated_at DESC LIMIT 1
      `,
      args: [assetId],
    })
    return (result.rows[0] as unknown as AllocationWithDetails) ?? null
  },

  async getAllocationHistory(assetId: number): Promise<AllocationWithDetails[]> {
    const result = await client.execute({
      sql: `
        SELECT al.*, u.name AS allocated_by_name, l.name AS location_name,
               a.name AS asset_name, a.asset_tag, a.type AS asset_type
        FROM allocations al
        LEFT JOIN users u ON al.allocated_by_id = u.id
        LEFT JOIN locations l ON al.location_id = l.id
        LEFT JOIN assets a ON al.asset_id = a.id
        WHERE al.asset_id = ?
        ORDER BY al.allocated_at DESC
      `,
      args: [assetId],
    })
    return result.rows as unknown as AllocationWithDetails[]
  },

  async getAllAllocations(): Promise<AllocationWithDetails[]> {
    const result = await client.execute(`
      SELECT al.*, u.name AS allocated_by_name, l.name AS location_name,
             a.name AS asset_name, a.asset_tag, a.type AS asset_type
      FROM allocations al
      LEFT JOIN users u ON al.allocated_by_id = u.id
      LEFT JOIN locations l ON al.location_id = l.id
      LEFT JOIN assets a ON al.asset_id = a.id
      ORDER BY al.allocated_at DESC
    `)
    return result.rows as unknown as AllocationWithDetails[]
  },

  async createAllocation(data: {
    asset_id: number
    allocated_to: string
    allocated_to_role?: string
    allocated_by_id?: number
    location_id?: number
    purpose?: string
    is_temporary?: boolean
    expected_return?: string
    notes?: string
  }): Promise<number> {
    const result = await client.execute({
      sql: `
        INSERT INTO allocations
          (asset_id, allocated_to, allocated_to_role, allocated_by_id, location_id, purpose, is_temporary, expected_return, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        data.asset_id, data.allocated_to,
        data.allocated_to_role ?? null,
        data.allocated_by_id ?? null,
        data.location_id ?? null,
        data.purpose ?? null,
        data.is_temporary ? 1 : 0,
        data.expected_return ?? null,
        data.notes ?? null,
      ],
    })

    // Update asset status
    await client.execute({
      sql: `UPDATE assets SET status = 'allocated', updated_at = datetime('now') WHERE id = ?`,
      args: [data.asset_id],
    })

    return Number(result.lastInsertRowid)
  },

  async returnAllocation(allocationId: number, assetId: number): Promise<void> {
    await client.execute({
      sql: `UPDATE allocations SET returned_at = datetime('now') WHERE id = ?`,
      args: [allocationId],
    })
    await client.execute({
      sql: `UPDATE assets SET status = 'available', updated_at = datetime('now') WHERE id = ?`,
      args: [assetId],
    })
  },

  // Requests
  async getAllRequests(): Promise<RequestWithDetails[]> {
    const result = await client.execute(`
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
    `)
    return result.rows as unknown as RequestWithDetails[]
  },

  async getPendingRequests(): Promise<RequestWithDetails[]> {
    const result = await client.execute(`
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
    `)
    return result.rows as unknown as RequestWithDetails[]
  },

  async getRequestsByAsset(assetId: number): Promise<RequestWithDetails[]> {
    const result = await client.execute({
      sql: `
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
      `,
      args: [assetId],
    })
    return result.rows as unknown as RequestWithDetails[]
  },

  async createRequest(data: {
    asset_id: number
    request_type: string
    priority?: string
    requester_name: string
    requester_email?: string
    requester_phone?: string
    requester_class?: string
    from_location_id?: number
    to_location_id?: number
    reason?: string
    duration?: string
  }): Promise<number> {
    const result = await client.execute({
      sql: `
        INSERT INTO requests
          (asset_id, request_type, priority, requester_name, requester_email, requester_phone, requester_class,
           from_location_id, to_location_id, reason, duration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        data.asset_id, data.request_type,
        data.priority ?? 'medium',
        data.requester_name,
        data.requester_email ?? null,
        data.requester_phone ?? null,
        data.requester_class ?? null,
        data.from_location_id ?? null,
        data.to_location_id ?? null,
        data.reason ?? null,
        data.duration ?? null,
      ],
    })
    return Number(result.lastInsertRowid)
  },

  async updateRequestStatus(id: number, status: string, handledById?: number, handlerNotes?: string): Promise<void> {
    await client.execute({
      sql: `
        UPDATE requests
        SET status = ?, handled_by_id = ?, handled_at = datetime('now'), handler_notes = ?
        WHERE id = ?
      `,
      args: [status, handledById ?? null, handlerNotes ?? null, id],
    })
  },

  // Stats
  async getStats(): Promise<{
    total: number
    available: number
    allocated: number
    maintenance: number
    retired: number
    pendingRequests: number
  }> {
    const countsResult = await client.execute(
      `SELECT status, COUNT(*) as count FROM assets GROUP BY status`
    )
    const counts = countsResult.rows as unknown as { status: string; count: number }[]

    const map: Record<string, number> = {}
    counts.forEach(r => { map[r.status] = Number(r.count) })
    const total = counts.reduce((s, r) => s + Number(r.count), 0)

    const pendingResult = await client.execute(`SELECT COUNT(*) as c FROM requests WHERE status = 'pending'`)
    const pendingRequests = Number((pendingResult.rows[0] as unknown as { c: number }).c)

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
