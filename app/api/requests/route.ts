import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'
import { sendNewRequestNotification, sendRequestConfirmation } from '@/lib/email'

export async function GET() {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requests = auth.role === 'admin' ? await db.getAllRequests() : await db.getPendingRequests()
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  // Allow both authenticated staff and unauthenticated guests
  try {
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

    const auth = getAuthFromCookies()
    const typeLabel = request_type === 'borrow' ? 'Borrow' : request_type === 'issue' ? 'Fault report' : 'Relocation'
    db.logAssetEvent(Number(asset_id), 'request_created', requester_name, auth?.userId ?? null,
      `${typeLabel} requested by ${requester_name}${requester_class ? ` (${requester_class})` : ''}${reason ? ` — "${reason}"` : ''}`).catch(() => {})

    // Await emails so Vercel doesn't kill the function before they send
    try {
      await sendNewRequestNotification({
        requestId: id,
        assetTag: asset.asset_tag,
        assetName: asset.name,
        requestType: request_type,
        priority: priority ?? 'medium',
        requesterName: requester_name,
        requesterEmail: requester_email,
        requesterPhone: requester_phone,
        reason,
      })
    } catch (err) { console.error('Admin notification email error:', err) }

    if (requester_email) {
      try {
        await sendRequestConfirmation({
          requesterName: requester_name,
          requesterEmail: requester_email,
          assetTag: asset.asset_tag,
          assetName: asset.name,
          requestType: request_type,
        })
      } catch (err) { console.error('Requester confirmation email error:', err) }
    }

    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error('POST /api/requests error:', err)
    return NextResponse.json({ error: 'Failed to submit request. Please try again.' }, { status: 500 })
  }
}
