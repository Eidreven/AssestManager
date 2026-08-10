import { createClient } from '@libsql/client'

type SqlValue = string | number | null
interface Row { [col: string]: SqlValue }

const DATABASE_URL = () => process.env.TURSO_DATABASE_URL ?? ''
const TURSO_URL = () => (process.env.TURSO_DATABASE_URL ?? '').replace('libsql://', 'https://')
const TURSO_TOKEN = () => process.env.TURSO_AUTH_TOKEN ?? ''
const localClient = DATABASE_URL().startsWith('file:') ? createClient({ url: DATABASE_URL() }) : null

function encodeArgs(args: SqlValue[]) {
  return args.map(a => {
    if (a === null) return { type: 'null' }
    if (typeof a === 'number') return Number.isInteger(a)
      ? { type: 'integer', value: String(a) }
      : { type: 'float', value: a }
    return { type: 'text', value: a }
  })
}

function decodeRows(cols: { name: string }[], rows: SqlValue[][]): Row[] {
  return rows.map(r => Object.fromEntries(cols.map((c, i) => {
    const cell = r[i] as { type: string; value: unknown } | null
    if (!cell || cell.type === 'null') return [c.name, null]
    if (cell.type === 'integer') return [c.name, Number(cell.value)]
    if (cell.type === 'float') return [c.name, Number(cell.value)]
    return [c.name, cell.value as SqlValue]
  })))
}

async function sql(query: string, args: SqlValue[] = []): Promise<{ rows: Row[]; lastInsertRowid: number | null }> {
  if (localClient) {
    const result = await localClient.execute({ sql: query, args })
    return {
      rows: result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value])) as Row),
      lastInsertRowid: result.lastInsertRowid == null ? null : Number(result.lastInsertRowid),
    }
  }
  const body = { requests: [{ type: 'execute', stmt: { sql: query, args: encodeArgs(args) } }] }
  const res = await fetch(`${TURSO_URL()}/v2/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TURSO_TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Turso HTTP ${res.status}: ${await res.text()}`)
  const data = await res.json() as { results: { type: string; error?: { message: string }; response?: { result: { cols: { name: string }[]; rows: SqlValue[][]; last_insert_rowid: string | null } } }[] }
  const result = data.results[0]
  if (result.type === 'error') throw new Error(result.error!.message)
  const { cols, rows, last_insert_rowid } = result.response!.result
  return { rows: decodeRows(cols, rows), lastInsertRowid: last_insert_rowid ? Number(last_insert_rowid) : null }
}

/** Send multiple SQL statements in ONE HTTP round-trip. Errors per-statement are silently ignored (safe for IF NOT EXISTS / ALTER TABLE). */
async function sqlBatch(statements: string[]): Promise<void> {
  if (statements.length === 0) return
  if (localClient) {
    for (const statement of statements) {
      try {
        await localClient.execute(statement)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!message.toLowerCase().includes('duplicate column name')) throw error
      }
    }
    return
  }
  const body = { requests: statements.map(s => ({ type: 'execute', stmt: { sql: s, args: [] } })) }
  const res = await fetch(`${TURSO_URL()}/v2/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TURSO_TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Turso batch HTTP ${res.status}: ${await res.text()}`)
  const data = await res.json() as { results?: { type: string; error?: { message: string } }[] }
  const unexpected = (data.results ?? [])
    .filter(result => result.type === 'error')
    .map(result => result.error?.message ?? 'Unknown migration error')
    .filter(message => !message.toLowerCase().includes('duplicate column name'))
  if (unexpected.length > 0) throw new Error(`Turso batch failed: ${unexpected.join('; ')}`)
}

export function resetDb(): void { /* no-op for Turso */ }
export function getDb() { return { execute: sql } }
export async function rawSql(query: string, args: SqlValue[] = []) { return sql(query, args) }

async function initSchema() {
  // ── Batch 1: Create all tables (one HTTP call) ────────────────────────────
  await sqlBatch([
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      auth_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS assets (
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
      asset_class TEXT NOT NULL DEFAULT 'it',
      tracking_mode TEXT NOT NULL DEFAULT 'individual',
      quantity_total INTEGER NOT NULL DEFAULT 1,
      condition TEXT NOT NULL DEFAULT 'good',
      quantity_good INTEGER NOT NULL DEFAULT 1,
      quantity_fair INTEGER NOT NULL DEFAULT 0,
      quantity_damaged INTEGER NOT NULL DEFAULT 0,
      quantity_missing INTEGER NOT NULL DEFAULT 0,
      purchase_cost REAL,
      supplier TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS allocations (
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
    )`,
    `CREATE TABLE IF NOT EXISTS requests (
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
    )`,
    `CREATE TABLE IF NOT EXISTS asset_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      responsible_teacher TEXT,
      location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS asset_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      actor_name TEXT,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      detail TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS maintenance_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      request_id INTEGER UNIQUE REFERENCES requests(id) ON DELETE SET NULL,
      reported_by_name TEXT,
      reported_by_email TEXT,
      fault_description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'approved',
      approved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      started_at TEXT,
      held_at TEXT,
      completed_at TEXT,
      latest_note TEXT,
      resolution_note TEXT,
      return_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
      return_set_id INTEGER REFERENCES asset_sets(id) ON DELETE SET NULL,
      previous_state_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS handover_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      sent_at TEXT,
      closed_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS handover_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES handover_sessions(id) ON DELETE CASCADE,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      allocation_id INTEGER REFERENCES allocations(id) ON DELETE SET NULL,
      set_id INTEGER REFERENCES asset_sets(id) ON DELETE SET NULL,
      holder_name TEXT NOT NULL,
      holder_email TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ])

  // ── Batch 2: Migrations — errors expected if columns already exist ─────────
  await sqlBatch([
    `ALTER TABLE requests ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'`,
    `ALTER TABLE requests ADD COLUMN requester_phone TEXT`,
    `ALTER TABLE assets ADD COLUMN set_id INTEGER REFERENCES asset_sets(id) ON DELETE SET NULL`,
    `ALTER TABLE assets ADD COLUMN created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE maintenance_jobs ADD COLUMN previous_state_json TEXT`,
    `ALTER TABLE assets ADD COLUMN asset_class TEXT NOT NULL DEFAULT 'it'`,
    `ALTER TABLE assets ADD COLUMN tracking_mode TEXT NOT NULL DEFAULT 'individual'`,
    `ALTER TABLE assets ADD COLUMN quantity_total INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE assets ADD COLUMN condition TEXT NOT NULL DEFAULT 'good'`,
    `ALTER TABLE assets ADD COLUMN quantity_good INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE assets ADD COLUMN quantity_fair INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE assets ADD COLUMN quantity_damaged INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE assets ADD COLUMN quantity_missing INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE assets ADD COLUMN purchase_cost REAL`,
    `ALTER TABLE assets ADD COLUMN supplier TEXT`,
  ])

  // ── Batch 3: Indexes (one HTTP call) ─────────────────────────────────────
  await sqlBatch([
    `CREATE INDEX IF NOT EXISTS idx_alloc_asset      ON allocations(asset_id)`,
    `CREATE INDEX IF NOT EXISTS idx_alloc_returned   ON allocations(returned_at)`,
    `CREATE INDEX IF NOT EXISTS idx_alloc_active     ON allocations(asset_id, returned_at)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_alloc_one_active ON allocations(asset_id) WHERE returned_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS idx_alloc_at         ON allocations(allocated_at)`,
    `CREATE INDEX IF NOT EXISTS idx_assets_tag       ON assets(asset_tag)`,
    `CREATE INDEX IF NOT EXISTS idx_assets_status    ON assets(status)`,
    `CREATE INDEX IF NOT EXISTS idx_assets_type      ON assets(type)`,
    `CREATE INDEX IF NOT EXISTS idx_assets_class     ON assets(asset_class)`,
    `CREATE INDEX IF NOT EXISTS idx_assets_tracking  ON assets(tracking_mode)`,
    // Legacy registers can contain duplicate serials. API validation prevents new duplicates
    // without making startup fail on data that predates that rule.
    `CREATE INDEX IF NOT EXISTS idx_assets_serial_lookup ON assets(serial_number) WHERE serial_number IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_requests_asset   ON requests(asset_id)`,
    `CREATE INDEX IF NOT EXISTS idx_requests_status  ON requests(status)`,
    `CREATE INDEX IF NOT EXISTS idx_requests_at      ON requests(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_asset_logs_asset ON asset_logs(asset_id)`,
    `CREATE INDEX IF NOT EXISTS idx_maint_asset      ON maintenance_jobs(asset_id)`,
    `CREATE INDEX IF NOT EXISTS idx_maint_status     ON maintenance_jobs(status)`,
    `CREATE INDEX IF NOT EXISTS idx_maint_assigned   ON maintenance_jobs(assigned_to_id)`,
    `CREATE INDEX IF NOT EXISTS idx_handover_session ON handover_items(session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_handover_status  ON handover_items(status)`,
    `CREATE INDEX IF NOT EXISTS idx_handover_holder  ON handover_items(holder_name)`,
    `CREATE INDEX IF NOT EXISTS idx_activity_user    ON activity_logs(user_id)`,
  ])
}

// Store promise so db methods can await it — ensures migration runs before queries
const schemaReady = process.env.SKIP_DB_SCHEMA_INIT === '1' ? Promise.resolve() : initSchema()

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  name: string
  email: string
  password_hash: string
  role: 'superadmin' | 'admin' | 'teacher'
  must_change_password: number
  auth_version: number
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
  created_by_id: number | null
  notes: string | null
  purchase_date: string | null
  warranty_expiry: string | null
  asset_class: 'it' | 'classroom'
  tracking_mode: 'individual' | 'quantity'
  quantity_total: number
  condition: 'good' | 'fair' | 'damaged' | 'missing'
  quantity_good: number
  quantity_fair: number
  quantity_damaged: number
  quantity_missing: number
  purchase_cost: number | null
  supplier: string | null
  created_at: string
  updated_at: string
}

export interface AssetWithDetails extends Asset {
  location_name: string | null
  set_name: string | null
  created_by_name: string | null
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

export type MaintenanceStatus = 'approved' | 'in_progress' | 'on_hold' | 'completed'

export interface MaintenanceJob {
  id: number
  asset_id: number
  request_id: number | null
  reported_by_name: string | null
  reported_by_email: string | null
  fault_description: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: MaintenanceStatus
  approved_by_id: number | null
  assigned_to_id: number | null
  started_at: string | null
  held_at: string | null
  completed_at: string | null
  latest_note: string | null
  resolution_note: string | null
  return_location_id: number | null
  return_set_id: number | null
  previous_state_json: string | null
  created_at: string
  updated_at: string
}

export interface MaintenanceJobWithDetails extends MaintenanceJob {
  asset_name: string | null
  asset_tag: string | null
  asset_type: string | null
  asset_status: string | null
  location_name: string | null
  set_name: string | null
  assigned_to_name: string | null
  assigned_to_email: string | null
  approved_by_name: string | null
  return_location_name: string | null
  return_set_name: string | null
}

export interface HandoverSession {
  id: number
  title: string
  notes: string | null
  status: 'draft' | 'sent' | 'closed'
  created_by_id: number | null
  created_at: string
  sent_at: string | null
  closed_at: string | null
}

export interface HandoverSessionWithCounts extends HandoverSession {
  created_by_name: string | null
  total_items: number
  pending_items: number
  collected_items: number
  missing_items: number
  damaged_items: number
}

export interface HandoverItem {
  id: number
  session_id: number
  asset_id: number
  allocation_id: number | null
  set_id: number | null
  holder_name: string
  holder_email: string | null
  status: 'pending' | 'collected' | 'missing' | 'damaged'
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export interface HandoverItemWithDetails extends HandoverItem {
  asset_tag: string | null
  asset_name: string | null
  asset_type: string | null
  set_name: string | null
  location_name: string | null
}

export interface AssetLog {
  id: number
  asset_id: number
  event_type: string
  actor_name: string | null
  actor_id: number | null
  detail: string | null
  created_at: string
}

export interface ActivityLog {
  id: number
  user_id: number | null
  user_name: string
  action: string
  detail: string | null
  created_at: string
}

// ─── Asset row mapping (eliminates N+1 allocation queries) ───────────────────

interface RawAssetRow extends Asset {
  location_name: string | null
  set_name: string | null
  created_by_name: string | null
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
    location_id: row.location_id, set_id: row.set_id, created_by_id: row.created_by_id,
    notes: row.notes, purchase_date: row.purchase_date, warranty_expiry: row.warranty_expiry,
    asset_class: row.asset_class, tracking_mode: row.tracking_mode, quantity_total: row.quantity_total,
    condition: row.condition, quantity_good: row.quantity_good, quantity_fair: row.quantity_fair,
    quantity_damaged: row.quantity_damaged, quantity_missing: row.quantity_missing,
    purchase_cost: row.purchase_cost, supplier: row.supplier,
    created_at: row.created_at, updated_at: row.updated_at,
    location_name: row.location_name, set_name: row.set_name, created_by_name: row.created_by_name,
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
  async updateUserPassword(id: number, passwordHash: string, mustChangePassword = false): Promise<void> {
    await sql('UPDATE users SET password_hash = ?, must_change_password = ?, auth_version = auth_version + 1 WHERE id = ?', [passwordHash, mustChangePassword ? 1 : 0, id])
  },
  async updateUser(id: number, name: string, email: string, role: string): Promise<void> {
    await sql('UPDATE users SET name = ?, email = ?, role = ?, auth_version = auth_version + 1 WHERE id = ?', [name, email, role, id])
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
    const r = await sql('SELECT id, name, email, role, must_change_password, auth_version, created_at FROM users ORDER BY name')
    return r.rows as unknown as Omit<User, 'password_hash'>[]
  },
  async getUserByName(name: string): Promise<Omit<User, 'password_hash'> | undefined> {
    const r = await sql('SELECT id, name, email, role, must_change_password, auth_version, created_at FROM users WHERE name = ? LIMIT 1', [name])
    return r.rows[0] as unknown as Omit<User, 'password_hash'> | undefined
  },
  async getTeachers(): Promise<Omit<User, 'password_hash'>[]> {
    const r = await sql("SELECT id, name, email, role, must_change_password, auth_version, created_at FROM users WHERE role = 'teacher' ORDER BY name")
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
             creator.name AS created_by_name,
             al.id AS al_id, al.allocated_to, al.allocated_to_role,
             al.allocated_by_id, al.location_id AS al_location_id,
             al.purpose, al.is_temporary, al.allocated_at,
             al.expected_return, al.returned_at, al.notes AS al_notes,
             u.name AS al_by_name, al_loc.name AS al_loc_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN asset_sets s ON a.set_id = s.id
      LEFT JOIN users creator ON a.created_by_id = creator.id
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
             creator.name AS created_by_name,
             al.id AS al_id, al.allocated_to, al.allocated_to_role,
             al.allocated_by_id, al.location_id AS al_location_id,
             al.purpose, al.is_temporary, al.allocated_at,
             al.expected_return, al.returned_at, al.notes AS al_notes,
             u.name AS al_by_name, al_loc.name AS al_loc_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN asset_sets s ON a.set_id = s.id
      LEFT JOIN users creator ON a.created_by_id = creator.id
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
             creator.name AS created_by_name,
             al.id AS al_id, al.allocated_to, al.allocated_to_role,
             al.allocated_by_id, al.location_id AS al_location_id,
             al.purpose, al.is_temporary, al.allocated_at,
             al.expected_return, al.returned_at, al.notes AS al_notes,
             u.name AS al_by_name, al_loc.name AS al_loc_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN asset_sets s ON a.set_id = s.id
      LEFT JOIN users creator ON a.created_by_id = creator.id
      LEFT JOIN allocations al ON al.asset_id = a.id AND al.returned_at IS NULL
        AND al.id = (SELECT id FROM allocations WHERE asset_id = a.id AND returned_at IS NULL ORDER BY allocated_at DESC LIMIT 1)
      LEFT JOIN users u ON al.allocated_by_id = u.id
      LEFT JOIN locations al_loc ON al.location_id = al_loc.id
      WHERE a.id = ?
    `, [id])
    return r.rows[0] ? mapAssetRow(r.rows[0] as unknown as RawAssetRow) : undefined
  },

  async getAssetBySerial(serial: string): Promise<{ id: number; asset_tag: string } | undefined> {
    const r = await sql('SELECT id, asset_tag FROM assets WHERE serial_number = ? LIMIT 1', [serial])
    return r.rows[0] as unknown as { id: number; asset_tag: string } | undefined
  },

  async getAssetByTag(tag: string): Promise<AssetWithDetails | undefined> {
    await schemaReady
    const r = await sql(`
      SELECT a.*, l.name AS location_name, s.name AS set_name,
             creator.name AS created_by_name,
             al.id AS al_id, al.allocated_to, al.allocated_to_role,
             al.allocated_by_id, al.location_id AS al_location_id,
             al.purpose, al.is_temporary, al.allocated_at,
             al.expected_return, al.returned_at, al.notes AS al_notes,
             u.name AS al_by_name, al_loc.name AS al_loc_name
      FROM assets a
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN asset_sets s ON a.set_id = s.id
      LEFT JOIN users creator ON a.created_by_id = creator.id
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
    purchase_date?: string; warranty_expiry?: string; created_by_id?: number
    asset_class?: 'it' | 'classroom'; tracking_mode?: 'individual' | 'quantity'
    quantity_total?: number; condition?: 'good' | 'fair' | 'damaged' | 'missing'
    quantity_good?: number; quantity_fair?: number; quantity_damaged?: number; quantity_missing?: number
    purchase_cost?: number; supplier?: string
  }): Promise<number> {
    const r = await sql(`
      INSERT INTO assets (
        asset_tag, name, type, model, serial_number, location_id, notes, purchase_date,
        warranty_expiry, created_by_id, asset_class, tracking_mode, quantity_total,
        condition, quantity_good, quantity_fair, quantity_damaged, quantity_missing,
        purchase_cost, supplier
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [data.asset_tag, data.name, data.type, data.model ?? null, data.serial_number ?? null,
        data.location_id ?? null, data.notes ?? null, data.purchase_date ?? null, data.warranty_expiry ?? null,
        data.created_by_id ?? null, data.asset_class ?? 'it', data.tracking_mode ?? 'individual',
        data.quantity_total ?? 1, data.condition ?? 'good', data.quantity_good ?? 1,
        data.quantity_fair ?? 0, data.quantity_damaged ?? 0, data.quantity_missing ?? 0,
        data.purchase_cost ?? null, data.supplier ?? null])
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
    try {
      await sql(`UPDATE assets SET status = 'allocated', updated_at = datetime('now') WHERE id = ?`, [data.asset_id])
    } catch (error) {
      await sql(`DELETE FROM allocations WHERE id = ?`, [r.lastInsertRowid])
      throw error
    }
    return r.lastInsertRowid!
  },

  async returnAllocation(allocationId: number, assetId: number): Promise<void> {
    await sql(`UPDATE allocations SET returned_at = datetime('now') WHERE id = ?`, [allocationId])
    try {
      await sql(`UPDATE assets SET status = 'available', updated_at = datetime('now') WHERE id = ?`, [assetId])
    } catch (error) {
      await sql(`UPDATE allocations SET returned_at = NULL WHERE id = ?`, [allocationId])
      throw error
    }
  },

  async restoreAllocation(allocationId: number, assetId: number): Promise<void> {
    await sql(`UPDATE allocations SET returned_at = NULL WHERE id = ?`, [allocationId])
    await sql(`UPDATE assets SET status = 'allocated', updated_at = datetime('now') WHERE id = ?`, [assetId])
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

  // Maintenance
  async getAllMaintenanceJobs(): Promise<MaintenanceJobWithDetails[]> {
    await schemaReady
    const r = await sql(`
      SELECT m.*, a.name AS asset_name, a.asset_tag, a.type AS asset_type, a.status AS asset_status,
             l.name AS location_name, s.name AS set_name,
             assignee.name AS assigned_to_name, assignee.email AS assigned_to_email,
             approver.name AS approved_by_name,
             rl.name AS return_location_name, rs.name AS return_set_name
      FROM maintenance_jobs m
      LEFT JOIN assets a ON m.asset_id = a.id
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN asset_sets s ON a.set_id = s.id
      LEFT JOIN users assignee ON m.assigned_to_id = assignee.id
      LEFT JOIN users approver ON m.approved_by_id = approver.id
      LEFT JOIN locations rl ON m.return_location_id = rl.id
      LEFT JOIN asset_sets rs ON m.return_set_id = rs.id
      ORDER BY
        CASE m.status
          WHEN 'in_progress' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'on_hold' THEN 3
          ELSE 4
        END,
        m.updated_at DESC
    `)
    return r.rows as unknown as MaintenanceJobWithDetails[]
  },

  async getMaintenanceJobsForUser(userId: number, email: string): Promise<MaintenanceJobWithDetails[]> {
    await schemaReady
    const r = await sql(`
      SELECT m.*, a.name AS asset_name, a.asset_tag, a.type AS asset_type, a.status AS asset_status,
             l.name AS location_name, s.name AS set_name,
             assignee.name AS assigned_to_name, assignee.email AS assigned_to_email,
             approver.name AS approved_by_name,
             rl.name AS return_location_name, rs.name AS return_set_name
      FROM maintenance_jobs m
      LEFT JOIN assets a ON m.asset_id = a.id
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN asset_sets s ON a.set_id = s.id
      LEFT JOIN users assignee ON m.assigned_to_id = assignee.id
      LEFT JOIN users approver ON m.approved_by_id = approver.id
      LEFT JOIN locations rl ON m.return_location_id = rl.id
      LEFT JOIN asset_sets rs ON m.return_set_id = rs.id
      WHERE m.assigned_to_id = ? OR lower(m.reported_by_email) = lower(?)
      ORDER BY m.updated_at DESC
    `, [userId, email])
    return r.rows as unknown as MaintenanceJobWithDetails[]
  },

  async getMaintenanceJobById(id: number): Promise<MaintenanceJobWithDetails | undefined> {
    await schemaReady
    const r = await sql(`
      SELECT m.*, a.name AS asset_name, a.asset_tag, a.type AS asset_type, a.status AS asset_status,
             l.name AS location_name, s.name AS set_name,
             assignee.name AS assigned_to_name, assignee.email AS assigned_to_email,
             approver.name AS approved_by_name,
             rl.name AS return_location_name, rs.name AS return_set_name
      FROM maintenance_jobs m
      LEFT JOIN assets a ON m.asset_id = a.id
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN asset_sets s ON a.set_id = s.id
      LEFT JOIN users assignee ON m.assigned_to_id = assignee.id
      LEFT JOIN users approver ON m.approved_by_id = approver.id
      LEFT JOIN locations rl ON m.return_location_id = rl.id
      LEFT JOIN asset_sets rs ON m.return_set_id = rs.id
      WHERE m.id = ?
    `, [id])
    return r.rows[0] as unknown as MaintenanceJobWithDetails | undefined
  },

  async getMaintenanceJobsByAsset(assetId: number): Promise<MaintenanceJobWithDetails[]> {
    await schemaReady
    const r = await sql(`
      SELECT m.*, a.name AS asset_name, a.asset_tag, a.type AS asset_type, a.status AS asset_status,
             l.name AS location_name, s.name AS set_name,
             assignee.name AS assigned_to_name, assignee.email AS assigned_to_email,
             approver.name AS approved_by_name,
             rl.name AS return_location_name, rs.name AS return_set_name
      FROM maintenance_jobs m
      LEFT JOIN assets a ON m.asset_id = a.id
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN asset_sets s ON a.set_id = s.id
      LEFT JOIN users assignee ON m.assigned_to_id = assignee.id
      LEFT JOIN users approver ON m.approved_by_id = approver.id
      LEFT JOIN locations rl ON m.return_location_id = rl.id
      LEFT JOIN asset_sets rs ON m.return_set_id = rs.id
      WHERE m.asset_id = ?
      ORDER BY m.created_at DESC
    `, [assetId])
    return r.rows as unknown as MaintenanceJobWithDetails[]
  },

  async getOpenMaintenanceJobForAsset(assetId: number): Promise<MaintenanceJobWithDetails | undefined> {
    const jobs = await this.getMaintenanceJobsByAsset(assetId)
    return jobs.find(j => j.status !== 'completed')
  },

  async createMaintenanceJob(data: {
    asset_id: number; request_id?: number | null; reported_by_name?: string | null
    reported_by_email?: string | null; fault_description?: string | null; priority?: string
    approved_by_id?: number | null; assigned_to_id?: number | null; latest_note?: string | null
    previous_state_json?: string | null
  }): Promise<number> {
    await schemaReady
    const r = await sql(`
      INSERT INTO maintenance_jobs
        (asset_id, request_id, reported_by_name, reported_by_email, fault_description,
         priority, approved_by_id, assigned_to_id, latest_note, previous_state_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [data.asset_id, data.request_id ?? null, data.reported_by_name ?? null,
        data.reported_by_email ?? null, data.fault_description ?? null, data.priority ?? 'medium',
        data.approved_by_id ?? null, data.assigned_to_id ?? null, data.latest_note ?? null,
        data.previous_state_json ?? null])
    return r.lastInsertRowid!
  },

  async updateMaintenanceJob(id: number, data: Partial<Omit<MaintenanceJob, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    await schemaReady
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
    const values = Object.values(data) as SqlValue[]
    if (!fields) return
    await sql(`UPDATE maintenance_jobs SET ${fields}, updated_at = datetime('now') WHERE id = ?`, [...values, id])
  },

  // Handover
  async getAllHandoverSessions(): Promise<HandoverSessionWithCounts[]> {
    await schemaReady
    const r = await sql(`
      SELECT hs.*, u.name AS created_by_name,
             COUNT(hi.id) AS total_items,
             SUM(CASE WHEN hi.status = 'pending' THEN 1 ELSE 0 END) AS pending_items,
             SUM(CASE WHEN hi.status = 'collected' THEN 1 ELSE 0 END) AS collected_items,
             SUM(CASE WHEN hi.status = 'missing' THEN 1 ELSE 0 END) AS missing_items,
             SUM(CASE WHEN hi.status = 'damaged' THEN 1 ELSE 0 END) AS damaged_items
      FROM handover_sessions hs
      LEFT JOIN users u ON hs.created_by_id = u.id
      LEFT JOIN handover_items hi ON hi.session_id = hs.id
      GROUP BY hs.id
      ORDER BY hs.created_at DESC
    `)
    return r.rows as unknown as HandoverSessionWithCounts[]
  },

  async getHandoverSessionById(id: number): Promise<HandoverSessionWithCounts | undefined> {
    await schemaReady
    const r = await sql(`
      SELECT hs.*, u.name AS created_by_name,
             COUNT(hi.id) AS total_items,
             SUM(CASE WHEN hi.status = 'pending' THEN 1 ELSE 0 END) AS pending_items,
             SUM(CASE WHEN hi.status = 'collected' THEN 1 ELSE 0 END) AS collected_items,
             SUM(CASE WHEN hi.status = 'missing' THEN 1 ELSE 0 END) AS missing_items,
             SUM(CASE WHEN hi.status = 'damaged' THEN 1 ELSE 0 END) AS damaged_items
      FROM handover_sessions hs
      LEFT JOIN users u ON hs.created_by_id = u.id
      LEFT JOIN handover_items hi ON hi.session_id = hs.id
      WHERE hs.id = ?
      GROUP BY hs.id
    `, [id])
    return r.rows[0] as unknown as HandoverSessionWithCounts | undefined
  },

  async createHandoverSession(title: string, notes: string | null, createdById: number): Promise<number> {
    await schemaReady
    const r = await sql(`
      INSERT INTO handover_sessions (title, notes, created_by_id)
      VALUES (?, ?, ?)
    `, [title, notes, createdById])
    return r.lastInsertRowid!
  },

  async updateHandoverSession(id: number, data: Partial<Pick<HandoverSession, 'status' | 'sent_at' | 'closed_at' | 'notes'>>): Promise<void> {
    await schemaReady
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
    const values = Object.values(data) as SqlValue[]
    if (!fields) return
    await sql(`UPDATE handover_sessions SET ${fields} WHERE id = ?`, [...values, id])
  },

  async getHandoverItems(sessionId: number): Promise<HandoverItemWithDetails[]> {
    await schemaReady
    const r = await sql(`
      SELECT hi.*, a.asset_tag, a.name AS asset_name, a.type AS asset_type,
             s.name AS set_name, l.name AS location_name
      FROM handover_items hi
      LEFT JOIN assets a ON hi.asset_id = a.id
      LEFT JOIN asset_sets s ON hi.set_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE hi.session_id = ?
      ORDER BY hi.holder_name, s.name, a.asset_tag
    `, [sessionId])
    return r.rows as unknown as HandoverItemWithDetails[]
  },

  async getHandoverItemById(id: number): Promise<HandoverItemWithDetails | undefined> {
    await schemaReady
    const r = await sql(`
      SELECT hi.*, a.asset_tag, a.name AS asset_name, a.type AS asset_type,
             s.name AS set_name, l.name AS location_name
      FROM handover_items hi
      LEFT JOIN assets a ON hi.asset_id = a.id
      LEFT JOIN asset_sets s ON hi.set_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE hi.id = ?
    `, [id])
    return r.rows[0] as unknown as HandoverItemWithDetails | undefined
  },

  async createHandoverItem(data: {
    session_id: number; asset_id: number; allocation_id?: number | null; set_id?: number | null
    holder_name: string; holder_email?: string | null
  }): Promise<number> {
    await schemaReady
    const r = await sql(`
      INSERT INTO handover_items
        (session_id, asset_id, allocation_id, set_id, holder_name, holder_email)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [data.session_id, data.asset_id, data.allocation_id ?? null, data.set_id ?? null,
        data.holder_name, data.holder_email ?? null])
    return r.lastInsertRowid!
  },

  async updateHandoverItem(id: number, data: Partial<Pick<HandoverItem, 'status' | 'admin_notes'>>): Promise<void> {
    await schemaReady
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
    const values = Object.values(data) as SqlValue[]
    if (!fields) return
    await sql(`UPDATE handover_items SET ${fields}, updated_at = datetime('now') WHERE id = ?`, [...values, id])
  },

  async deleteHandoverItem(id: number): Promise<void> {
    await schemaReady
    await sql(`DELETE FROM handover_items WHERE id = ?`, [id])
  },

  async deleteHandoverItemsForSet(sessionId: number, setId: number): Promise<void> {
    await schemaReady
    await sql(`DELETE FROM handover_items WHERE session_id = ? AND set_id = ?`, [sessionId, setId])
  },

  // Asset Logs
  async logAssetEvent(assetId: number, eventType: string, actorName: string | null, actorId: number | null, detail: string | null): Promise<void> {
    await schemaReady
    await sql(`INSERT INTO asset_logs (asset_id, event_type, actor_name, actor_id, detail) VALUES (?, ?, ?, ?, ?)`,
      [assetId, eventType, actorName, actorId, detail])
  },
  async getAssetLogs(assetId: number): Promise<AssetLog[]> {
    await schemaReady
    const r = await sql(`SELECT * FROM asset_logs WHERE asset_id = ? ORDER BY created_at DESC`, [assetId])
    return r.rows as unknown as AssetLog[]
  },

  // Activity Logs
  async logActivity(userId: number | null, userName: string, action: string, detail: string | null): Promise<void> {
    await schemaReady
    await sql(`INSERT INTO activity_logs (user_id, user_name, action, detail) VALUES (?, ?, ?, ?)`,
      [userId, userName, action, detail])
  },
  /** Login-specific logger — deduplicates: skips insert if same user logged in within last 30 seconds */
  async logLogin(userId: number, userName: string, role: string): Promise<void> {
    await schemaReady
    await sql(`
      INSERT INTO activity_logs (user_id, user_name, action, detail)
      SELECT ?, ?, 'login', ?
      WHERE NOT EXISTS (
        SELECT 1 FROM activity_logs
        WHERE user_id = ? AND action = 'login'
        AND created_at > datetime('now', '-30 seconds')
      )
    `, [userId, userName, `Signed in as ${role}`, userId])
  },
  async getRecentActivity(limit = 200): Promise<ActivityLog[]> {
    await schemaReady
    const r = await sql(`SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?`, [limit])
    return r.rows as unknown as ActivityLog[]
  },
  async getActivityLogsOlderThan(days: number): Promise<ActivityLog[]> {
    await schemaReady
    const r = await sql(
      `SELECT * FROM activity_logs WHERE created_at < datetime('now', ?) ORDER BY created_at ASC`,
      [`-${days} days`]
    )
    return r.rows as unknown as ActivityLog[]
  },
  async purgeActivityLogsOlderThan(days: number): Promise<number> {
    await schemaReady
    const r = await sql(
      `DELETE FROM activity_logs WHERE created_at < datetime('now', ?)`,
      [`-${days} days`]
    )
    return r.rows.length
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
