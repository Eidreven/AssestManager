import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { sendHandoverAdminSummary, sendHandoverCollectedReceipt } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sessionId = Number(params.id)
  if (isNaN(sessionId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const { item_ids, admin_notes } = await req.json()
  const itemIds = Array.isArray(item_ids) ? item_ids.map(Number).filter(Boolean) : []
  if (itemIds.length === 0) return NextResponse.json({ error: 'Select at least one device to collect' }, { status: 400 })

  const session = await db.getHandoverSessionById(sessionId)
  if (!session) return NextResponse.json({ error: 'Handover session not found' }, { status: 404 })
  if (session.status === 'closed') return NextResponse.json({ error: 'This handover session is closed' }, { status: 400 })

  const allItems = await db.getHandoverItems(sessionId)
  const selected = allItems.filter(item => itemIds.includes(item.id))
  if (selected.length === 0) return NextResponse.json({ error: 'Selected devices were not found in this session' }, { status: 404 })

  const groupKeys = new Set(selected.map(item => `${item.holder_name}::${item.set_id ?? 'single'}`))
  if (groupKeys.size > 1) {
    return NextResponse.json({ error: 'Collect devices for one holder/set group at a time' }, { status: 400 })
  }

  for (const item of selected) {
    await db.updateHandoverItem(item.id, {
      status: 'collected',
      admin_notes: admin_notes?.trim() || item.admin_notes,
    })
  }

  const emailItems = selected.map(item => ({
    assetTag: item.asset_tag ?? '',
    assetName: item.asset_name ?? '',
    assetType: item.asset_type,
    setName: item.set_name,
    status: 'Collected',
  }))
  const first = selected[0]

  try {
    await sendHandoverAdminSummary({
      sessionTitle: session.title,
      holderName: first.holder_name,
      subjectPrefix: 'Devices collected',
      items: emailItems,
    })
  } catch (err) { console.error('Batch collected admin email error:', err) }

  if (first.holder_email) {
    try {
      await sendHandoverCollectedReceipt({
        toEmail: first.holder_email,
        holderName: first.holder_name,
        sessionTitle: session.title,
        items: emailItems,
      })
    } catch (err) { console.error('Batch collected holder email error:', err) }
  }

  return NextResponse.json({ ok: true, collected: selected.length })
}
