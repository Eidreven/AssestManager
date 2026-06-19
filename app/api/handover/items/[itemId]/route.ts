import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { sendHandoverAdminSummary } from '@/lib/email'

const STATUSES = ['pending', 'collected', 'missing', 'damaged'] as const

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.itemId)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const before = await db.getHandoverItemById(id)
  if (!before) return NextResponse.json({ error: 'Handover item not found' }, { status: 404 })

  const { status, admin_notes } = await req.json()
  if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  await db.updateHandoverItem(id, {
    status,
    admin_notes: admin_notes?.trim() || null,
  })

  const updated = await db.getHandoverItemById(id)
  const session = updated ? await db.getHandoverSessionById(updated.session_id) : null

  if (updated && session && before.status !== 'collected' && updated.status === 'collected') {
    try {
      await sendHandoverAdminSummary({
        sessionTitle: session.title,
        holderName: updated.holder_name,
        subjectPrefix: 'Device collected',
        items: [{
          assetTag: updated.asset_tag ?? '',
          assetName: updated.asset_name ?? '',
          assetType: updated.asset_type,
          setName: updated.set_name,
          status: 'Collected',
        }],
      })
    } catch (err) { console.error('Collected admin email error:', err) }
  }

  return NextResponse.json(updated)
}
