import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { resetDb } from '@/lib/db'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'assets.db')

export async function GET(req: NextRequest) {
  const token = getAuthFromRequest(req)
  if (!token || token.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  if (!fs.existsSync(DB_PATH)) {
    return NextResponse.json({ error: 'Database not found' }, { status: 404 })
  }

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

  // Verify it's a valid SQLite file (starts with SQLite magic bytes)
  if (buffer.length < 16 || buffer.toString('ascii', 0, 6) !== 'SQLite') {
    return NextResponse.json({ error: 'Invalid SQLite database file' }, { status: 400 })
  }

  // Create a backup of current db before restoring
  const backupPath = DB_PATH + '.bak'
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, backupPath)
  }

  fs.writeFileSync(DB_PATH, buffer)
  resetDb()

  return NextResponse.json({ message: 'Database restored successfully.' })
}
