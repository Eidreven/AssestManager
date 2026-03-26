import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function GET() {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requests = auth.role === 'admin' ? await db.getAllRequests() : await db.getPendingRequests()
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  // Allow both authenticated staff and unauthenticated guests
  const body = await req.json()
  const {
    asset_id, request_type, priority, requester_name, requester_email,
    requester_phone, requester_class, from_location_id, to_location_id, reason, duration,
  } = body

  if (!asset_id || !request_type || !requester_name) {
    return NextResponse.json({ error: 'asset_id, request_type, and requester_name are required' }, { status: 400 })
  }

  const asset = await db.getAssetById(Number(asset_id))
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  const id = await db.createRequest({
    asset_id: Number(asset_id),
    request_type,
    priority: priority ?? 'medium',
    requester_name,
    requester_email,
    requester_phone,
    requester_class,
    from_location_id: from_location_id ? Number(from_location_id) : undefined,
    to_location_id: to_location_id ? Number(to_location_id) : undefined,
    reason,
    duration,
  })

  return NextResponse.json({ id }, { status: 201 })
}
