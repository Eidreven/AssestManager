import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const token = getAuthFromRequest(req)
  if (!token || token.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Exit the process — npm run dev will automatically restart it
  setTimeout(() => process.exit(0), 300)

  return NextResponse.json({ message: 'Server is restarting…' })
}
