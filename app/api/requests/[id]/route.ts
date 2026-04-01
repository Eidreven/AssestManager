import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { sendRequestStatusUpdate } from '@/lib/email'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status, handler_notes } = await req.json()

  if (!['approved', 'rejected', 'completed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const requestId = Number(params.id)

  // Fetch request details before updating (to get requester email + asset info)
  const requests = await db.getAllRequests()
  const request = requests.find(r => r.id === requestId)

  await db.updateRequestStatus(requestId, status, auth.userId, handler_notes)

  // Log the action on the asset
  if (request) {
    const eventType = `request_${status}` // request_approved / request_rejected / request_completed
    const typeLabel = request.request_type === 'borrow' ? 'Borrow' : request.request_type === 'issue' ? 'Fault' : 'Relocation'
    db.logAssetEvent(request.asset_id, eventType, auth.name, auth.userId,
      `${typeLabel} request #${requestId} by ${request.requester_name} ${status}${handler_notes ? ` — "${handler_notes}"` : ''}`).catch(() => {})
    db.logActivity(auth.userId, auth.name, eventType,
      `${status} request #${requestId} for ${request.asset_tag ?? 'asset'}`).catch(() => {})
  }

  // Email requester if they provided an email
  if (request?.requester_email) {
    try {
      await sendRequestStatusUpdate({
        requesterName: request.requester_name,
        requesterEmail: request.requester_email,
        assetTag: request.asset_tag ?? '',
        assetName: request.asset_name ?? '',
        requestType: request.request_type,
        status,
        handlerNotes: handler_notes,
      })
    } catch (err) { console.error('Status update email error:', err) }
  }

  return NextResponse.json({ ok: true })
}
