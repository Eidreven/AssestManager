import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { getDb, resetDb } from '@/lib/db'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'assets.db')
const WAL_PATH = DB_PATH + '-wal'
const SHM_PATH = DB_PATH + '-shm'

export async function GET(req: NextRequest) {
  const token = getAuthFromRequest(req)
  if (!token || token.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  if (!fs.existsSync(DB_PATH)) {
    return NextResponse.json({ error: 'Database not found' }, { status: 404 })
  }

  // Checkpoint WAL so all data is flushed into the main .db file before backup
  try {
    getDb().pragma('wal_checkpoint(FULL)')
  } catch {}

  const fileBuffer = fs.readFileSync(DB_PATH)
  const date = new Date().toISOString().slice(0, 10)
  const filename = `assets-backup-${date}.db`

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
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

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!file.name.endsWith('.db')) {
    return NextResponse.json({ error: 'File must be a .db file' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Verify it's a valid SQLite file
  if (buffer.length < 16 || buffer.toString('ascii', 0, 6) !== 'SQLite') {
    return NextResponse.json({ error: 'Invalid SQLite database file' }, { status: 400 })
  }

  // Close the current DB connection first
  resetDb()

  // Delete WAL and SHM files — these override the main db file and will corrupt the restore
  try { if (fs.existsSync(WAL_PATH)) fs.unlinkSync(WAL_PATH) } catch {}
  try { if (fs.existsSync(SHM_PATH)) fs.unlinkSync(SHM_PATH) } catch {}

  // Backup current db before overwriting
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, DB_PATH + '.bak')
  }

  // Write the restored database
  fs.writeFileSync(DB_PATH, buffer)

  return NextResponse.json({ message: 'Database restored successfully.' })
}
