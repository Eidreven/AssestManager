import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const token = getAuthFromRequest(req)
  if (!token || (token.role !== 'admin' && token.role !== 'superadmin')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // With Turso cloud DB there's no local connection to reset.
  // This endpoint is kept for UI compatibility.
  return NextResponse.json({ message: 'Server reloaded successfully.' })
}
