import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { resetDb } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function POST(req: NextRequest) {
  const token = getAuthFromRequest(req)
  if (!token || token.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Reset DB connection so next request picks up the restored database
  resetDb()

  // Touch next.config.js to trigger Next.js hot reload without killing the process
  const configPath = path.join(process.cwd(), 'next.config.js')
  const now = new Date()
  fs.utimesSync(configPath, now, now)

  return NextResponse.json({ message: 'Server reloaded successfully.' })
}
