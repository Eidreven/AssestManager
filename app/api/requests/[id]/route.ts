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
