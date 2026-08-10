import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { getDb } from '@/lib/db'

type BackupValue = string | number | null
type BackupRow = Record<string, BackupValue>

const TABLES = {
  locations: ['id', 'name', 'description', 'location_type', 'created_at'],
  asset_sets: ['id', 'name', 'description', 'responsible_teacher', 'location_id', 'created_at'],
  assets: [
    'id', 'asset_tag', 'name', 'type', 'model', 'serial_number', 'status', 'location_id', 'notes',
    'purchase_date', 'warranty_expiry', 'created_at', 'updated_at', 'set_id', 'created_by_id',
    'asset_class', 'tracking_mode', 'quantity_total', 'condition', 'quantity_good', 'quantity_fair',
    'quantity_damaged', 'quantity_missing', 'purchase_cost', 'supplier',
  ],
  allocations: [
    'id', 'asset_id', 'allocated_to', 'allocated_to_role', 'allocated_by_id', 'location_id',
    'purpose', 'is_temporary', 'allocated_at', 'expected_return', 'returned_at', 'notes',
  ],
  requests: [
    'id', 'asset_id', 'request_type', 'priority', 'requester_name', 'requester_email',
    'requester_phone', 'requester_class', 'from_location_id', 'to_location_id', 'reason', 'duration',
    'status', 'handled_by_id', 'handled_at', 'handler_notes', 'created_at',
  ],
  asset_logs: ['id', 'asset_id', 'event_type', 'actor_name', 'actor_id', 'detail', 'created_at'],
  maintenance_jobs: [
    'id', 'asset_id', 'request_id', 'reported_by_name', 'reported_by_email', 'fault_description',
    'priority', 'status', 'approved_by_id', 'assigned_to_id', 'started_at', 'held_at', 'completed_at',
    'latest_note', 'resolution_note', 'return_location_id', 'return_set_id', 'previous_state_json',
    'created_at', 'updated_at',
  ],
  handover_sessions: ['id', 'title', 'notes', 'status', 'created_by_id', 'created_at', 'sent_at', 'closed_at'],
  handover_items: [
    'id', 'session_id', 'asset_id', 'allocation_id', 'set_id', 'holder_name', 'holder_email',
    'status', 'admin_notes', 'created_at', 'updated_at',
  ],
  activity_logs: ['id', 'user_id', 'user_name', 'action', 'detail', 'created_at'],
} as const

type TableName = keyof typeof TABLES
const RESTORE_ORDER = Object.keys(TABLES) as TableName[]
const DELETE_ORDER = [...RESTORE_ORDER].reverse()

interface BackupFile {
  version: number
  exported_at?: string
  tables: Partial<Record<TableName, BackupRow[]>>
}

async function readCurrentData(): Promise<BackupFile> {
  const db = getDb()
  const entries = await Promise.all(RESTORE_ORDER.map(async table => {
    const result = await db.execute(`SELECT * FROM ${table} ORDER BY id`)
    return [table, result.rows as unknown as BackupRow[]] as const
  }))
  return { version: 2, exported_at: new Date().toISOString(), tables: Object.fromEntries(entries) }
}

function validateBackup(value: unknown): BackupFile {
  if (!value || typeof value !== 'object') throw new Error('Invalid backup file')
  const backup = value as Partial<BackupFile>
  if (backup.version !== 2 || !backup.tables || typeof backup.tables !== 'object') {
    throw new Error('Only complete version 2 backups can be restored')
  }
  for (const table of RESTORE_ORDER) {
    const rows = backup.tables[table]
    if (!Array.isArray(rows)) throw new Error(`Backup is missing table: ${table}`)
    for (const row of rows) {
      if (!row || typeof row !== 'object') throw new Error(`Invalid row in table: ${table}`)
      for (const value of Object.values(row)) {
        if (value !== null && typeof value !== 'string' && typeof value !== 'number') {
          throw new Error(`Invalid value in table: ${table}`)
        }
      }
    }
  }
  return backup as BackupFile
}

async function replaceData(backup: BackupFile): Promise<void> {
  const db = getDb()
  for (const table of DELETE_ORDER) await db.execute(`DELETE FROM ${table}`)
  for (const table of RESTORE_ORDER) {
    const allowed = new Set<string>(TABLES[table])
    for (const row of backup.tables[table] ?? []) {
      const columns = Object.keys(row).filter(column => allowed.has(column))
      if (columns.length === 0) continue
      const placeholders = columns.map(() => '?').join(', ')
      const values = columns.map(column => row[column] ?? null)
      await db.execute(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values)
    }
  }
}

export async function GET(req: NextRequest) {
  const token = getAuthFromRequest(req)
  if (!token || (token.role !== 'admin' && token.role !== 'superadmin')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }
  const backup = await readCurrentData()
  const filename = `assets-backup-${new Date().toISOString().slice(0, 10)}.json`
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${filename}"` },
  })
}

export async function POST(req: NextRequest) {
  const token = getAuthFromRequest(req)
  if (!token || token.role !== 'superadmin') {
    return NextResponse.json({ error: 'Super Admin only' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file || !file.name.endsWith('.json')) {
    return NextResponse.json({ error: 'Select a JSON backup file' }, { status: 400 })
  }

  try {
    const incoming = validateBackup(JSON.parse(await file.text()))
    const safetyBackup = await readCurrentData()
    try {
      await replaceData(incoming)
    } catch (restoreError) {
      await replaceData(safetyBackup)
      throw restoreError
    }
    return NextResponse.json({ message: 'Database restored successfully from a complete backup.' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Restore failed' }, { status: 400 })
  }
}
