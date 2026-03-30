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
export async function rawSql(query: string, args: SqlValue[] = []) { return sql(query, args) }

async function initSchema() {
  await sql(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
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
  // Asset sets
  await sql(`CREATE TABLE IF NOT EXISTS asset_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    responsible_teacher TEXT,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`)
  try { await sql(`ALTER TABLE assets ADD COLUMN set_id INTEGER REFERENCES asset_sets(id) ON DELETE SET NULL`) } catch {}
  // Migrate old role names: admin→superadmin, staff→admin
  try { await sql(`UPDATE users SET role = 'superadmin' WHERE role = 'admin'`) } catch {}
  try { await sql(`UPDATE users SET role = 'admin' WHERE role = 'staff'`) } catch {}
  // Indexes for common lookups
  try { await sql(`CREATE INDEX IF NOT EXISTS idx_alloc_asset ON allocations(asset_id)`) } catch {}
  try { await sql(`CREATE INDEX IF NOT EXISTS idx_alloc_returned ON allocations(returned_at)`) } catch {}
  try { await sql(`CREATE INDEX IF NOT EXISTS idx_alloc_active ON allocations(asset_id, returned_at)`) } catch {}
  try { await sql(`CREATE INDEX IF NOT EXISTS idx_assets_tag ON assets(asset_tag)`) } catch {}
  try { await sql(`CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type)`) } catch {}
  try { await sql(`CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status)`) } catch {}
  try { await sql(`CREATE INDEX IF NOT EXISTS idx_requests_asset ON requests(asset_id)`) } catch {}
  try { await sql(`CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)`) } catch {}
  await sql(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`)
}

// Store promise so db methods can await it — ensures migration runs before queries
const schemaReady = initSchema().catch(err => console.error('Schema init error:', err))

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  name: string
  email: string
  password_hash: string
  role: 'superadmin' | 'admin' | 'teacher'
  created_at: string
}

export interface Location {
  id: number
  name: string
  description: string | null
  created_at: string
}

export interface AssetSet {
  id: number
  name: string
  description: string | null
  responsible_teacher: string | null
  location_id: number | null
  location_name: string | null
  created_at: string
  asset_count: number
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
  set_id: number | null
  notes: string | null
  purchase_date: string | null
  warranty_expiry: string | null
  created_at: string
  updated_at: string
}

export interface AssetWithDetails extends Asset {
  location_name: string | null
  set_name: string | null
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

// ─── Asset row mapping (eliminates N+1 allocation queries) ───────────────────

interface RawAssetRow extends Asset {
  location_name: string | null
  set_name: string | null
  al_id: number | null
  allocated_to: string | null
  allocated_to_role: string | null
  allocated_by_id: number | null
  al_location_id: number | null
  purpose: string | null
  is_temporary: number | null
  allocated_at: string | null
  expected_return: string | null
  returned_at: string | null
  al_notes: string | null
  al_by_name: string | null
  al_loc_name: string | null
}

function mapAssetRow(row: RawAssetRow): AssetWithDetails {
  return {
    id: row.id, asset_tag: row.asset_tag, name: row.name, type: row.type,
    model: row.model, serial_number: row.serial_number, status: row.status,
    location_id: row.location_id, set_id: row.set_id, notes: row.notes,
    purchase_date: row.purchase_date, warranty_expiry: row.warranty_expiry,
    created_at: row.created_at, updated_at: row.updated_at,
    location_name: row.location_name, set_name: row.set_name,
    current_allocation: row.al_id ? {
      id: row.al_id,
      asset_id: row.id,
      allocated_to: row.allocated_to!,
      allocated_to_role: row.allocated_to_role,
      allocated_by_id: row.allocated_by_id,
      location_id: row.al_location_id,
      purpose: row.purpose,
      is_temporary: row.is_temporary ?? 0,
      allocated_at: row.allocated_at!,
      expected_return: row.expected_return,
      returned_at: row.returned_at,
      notes: row.al_notes,
      allocated_by_name: row.al_by_name,
      location_name: row.al_loc_name,
      asset_name: row.name,
      asset_tag: row.asset_tag,
      asset_type: row.type,
    } : null,
  }
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
  async updateUserPassword(id: number, passwordHash: string): Promise<void> {
    await sql('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id])
  },
  async updateUser(id: number, name: string, email: string, role: string): Promise<void> {
    await sql('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?', [name, email, role, id])
  },
  async deleteUser(id: number): Promise<void> {
    await sql('DELETE FROM users WHERE id = ?', [id])
  },
  async createPasswordResetToken(userId: number, token: string, expiresAt: string): Promise<void> {
    // Invalidate any existing tokens for this user
    await sql('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?', [userId])
    await sql('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [userId, token, expiresAt])
  },
  async getPasswordResetToken(token: string): Promise<{ id: number; user_id: number; expires_at: string; used: number } | undefined> {
    const r = await sql('SELECT * FROM password_reset_tokens WHERE token = ?', [token])
    return r.rows[0] as unknown as { id: number; user_id: number; expires_at: string; used: number } | undefined
  },
  async markTokenUsed(token: string): Promise<void> {
    await sql('UPDATE password_reset_tokens SET used = 1 WHERE token = ?', [token])
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

  // Asset Sets
  async getAllSets(): Promise<AssetSet[]> {
    const r = await sql(`
      SELECT s.*, l.name AS location_name,
             COUNT(a.id) AS asset_count
      FROM asset_sets s
      LEFT JOIN locations l ON s.location_id = l.id
      LEFT JOIN assets a ON a.set_id = s.id
      GROUP BY s.id ORDER BY s.name
    `)
    return r.rows as unknown as AssetSet[]
  },
  async getSetById(id: number): Promise<AssetSet | undefined> {
    const r = await sql(`
      SELECT s.*, l.name AS location_name,
             COUNT(a.id) AS asset_count
      FROM asset_sets s
      LEFT JOIN locations l ON s.location_id = l.id
      LEFT JOIN assets a ON a.set_id = s.id
      WHERE s.id = ?
      GROUP BY s.id
    `, [id])
    return r.rows[0] as unknown as AssetSet | undefined
  },
  async createSet(name: string, description: string | null, responsibleTeacher: string | null, locationId: number | null): Promise<number> {
    const r = await sql(`INSERT INTO asset_sets (name, description, responsible_teacher, location_id) VALUES (?, ?, ?, ?)`,
      [name, description, responsibleTeacher, locationId])
    return r.lastInsertRowid!
  },
  async updateSet(id: number, name: string, description: string | null, responsibleTeacher: string | null, locationId: number | null): Promise<void> {
    await sql(`UPDATE asset_sets SET name = ?, description = ?, responsible_teacher = ?, location_id = ? WHERE id = ?`,
      [name, description, responsibleTeacher, locationId, id])
  },
  async deleteSet(id: number): Promise<void> {
    await sql(`UPDATE assets SET set_id = NULL WHERE set_id = ?`, [id])
    await sql(`DELETE FROM asset_sets WHERE id = ?`, [id])
  },
  async getAssetsInSet(setId: number): Promise<AssetWithDetails[]> {
    const r = await sql(`
      SELECT a.*, l.name AS location_name, s.name AS set_name,
             al.id AS al_id, al.allocated_to, al.allocated_to_role,
             al.allocated_by_id, al.location_id AS al_location_id,
             al.purpose, al.is_temporary, al.allocated_at,
             al.expected_return, al.returned_at, al.notes AS al_notes,
             u.name AS al_by_name, al_loc.name AS al_loc_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN asset_sets s ON a.set_id = s.id
      LEFT JOIN allocations al ON al.asset_id = a.id AND al.returned_at IS NULL
        AND al.id = (SELECT id FROM allocations WHERE asset_id = a.id AND returned_at IS NULL ORDER BY allocated_at DESC LIMIT 1)
      LEFT JOIN users u ON al.allocated_by_id = u.id
      LEFT JOIN locations al_loc ON al.location_id = al_loc.id
      WHERE a.set_id = ?
      ORDER BY a.asset_tag ASC
    `, [setId])
    return (r.rows as unknown as RawAssetRow[]).map(mapAssetRow)
  },
  async addAssetToSet(assetId: number, setId: number): Promise<void> {
    await sql(`UPDATE assets SET set_id = ? WHERE id = ?`, [setId, assetId])
  },
  async removeAssetFromSet(assetId: number): Promise<void> {
    await sql(`UPDATE assets SET set_id = NULL WHERE id = ?`, [assetId])
  },

  // Assets
  async getAllAssets(): Promise<AssetWithDetails[]> {
    await schemaReady
    const r = await sql(`
      SELECT a.*, l.name AS location_name, s.name AS set_name,
             al.id AS al_id, al.allocated_to, al.allocated_to_role,
             al.allocated_by_id, al.location_id AS al_location_id,
             al.purpose, al.is_temporary, al.allocated_at,
             al.expected_return, al.returned_at, al.notes AS al_notes,
             u.name AS al_by_name, al_loc.name AS al_loc_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN asset_sets s ON a.set_id = s.id
      LEFT JOIN allocations al ON al.asset_id = a.id AND al.returned_at IS NULL
        AND al.id = (SELECT id FROM allocations WHERE asset_id = a.id AND returned_at IS NULL ORDER BY allocated_at DESC LIMIT 1)
      LEFT JOIN users u ON al.allocated_by_id = u.id
      LEFT JOIN locations al_loc ON al.location_id = al_loc.id
      ORDER BY a.asset_tag ASC
    `)
    return (r.rows as unknown as RawAssetRow[]).map(mapAssetRow)
  },

  async getAssetById(id: number): Promise<AssetWithDetails | undefined> {
    await schemaReady
    const r = await sql(`
      SELECT a.*, l.name AS location_name, s.name AS set_name,
             al.id AS al_id, al.allocated_to, al.allocated_to_role,
             al.allocated_by_id, al.location_id AS al_location_id,
             al.purpose, al.is_temporary, al.allocated_at,
             al.expected_return, al.returned_at, al.notes AS al_notes,
             u.name AS al_by_name, al_loc.name AS al_loc_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN asset_sets s ON a.set_id = s.id
      LEFT JOIN allocations al ON al.asset_id = a.id AND al.returned_at IS NULL
        AND al.id = (SELECT id FROM allocations WHERE asset_id = a.id AND returned_at IS NULL ORDER BY allocated_at DESC LIMIT 1)
      LEFT JOIN users u ON al.allocated_by_id = u.id
      LEFT JOIN locations al_loc ON al.location_id = al_loc.id
      WHERE a.id = ?
    `, [id])
    return r.rows[0] ? mapAssetRow(r.rows[0] as unknown as RawAssetRow) : undefined
  },

  async getAssetByTag(tag: string): Promise<AssetWithDetails | undefined> {
    await schemaReady
    const r = await sql(`
      SELECT a.*, l.name AS location_name, s.name AS set_name,
             al.id AS al_id, al.allocated_to, al.allocated_to_role,
             al.allocated_by_id, al.location_id AS al_location_id,
             al.purpose, al.is_temporary, al.allocated_at,
             al.expected_return, al.returned_at, al.notes AS al_notes,
             u.name AS al_by_name, al_loc.name AS al_loc_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN asset_sets s ON a.set_id = s.id
      LEFT JOIN allocations al ON al.asset_id = a.id AND al.returned_at IS NULL
        AND al.id = (SELECT id FROM allocations WHERE asset_id = a.id AND returned_at IS NULL ORDER BY allocated_at DESC LIMIT 1)
      LEFT JOIN users u ON al.allocated_by_id = u.id
      LEFT JOIN locations al_loc ON al.location_id = al_loc.id
      WHERE a.asset_tag = ?
    `, [tag])
    return r.rows[0] ? mapAssetRow(r.rows[0] as unknown as RawAssetRow) : undefined
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
    // Cast the trailing numeric part to integer for correct numeric sort (not lexicographic)
    const r = await sql(
      `SELECT asset_tag FROM assets WHERE asset_tag LIKE ?
       ORDER BY CAST(SUBSTR(asset_tag, LENGTH(?)+1) AS INTEGER) DESC LIMIT 1`,
      [`MPS-${prefix}-%`, `MPS-${prefix}-`]
    )
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
