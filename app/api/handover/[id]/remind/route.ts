import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { sendHandoverAdminSummary, sendHandoverMissingReminder } from '@/lib/email'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const [session, items] = await Promise.all([
    db.getHandoverSessionById(id),
    db.getHandoverItems(id),
  ])
  if (!session) return NextResponse.json({ error: 'Handover session not found' }, { status: 404 })

  const outstanding = items.filter(item => item.status === 'pending' || item.status === 'missing' || item.status === 'damaged')
  const grouped = new Map<string, typeof outstanding>()
  for (const item of outstanding) {
    const key = `${item.holder_name}::${item.holder_email ?? ''}`
    grouped.set(key, [...(grouped.get(key) ?? []), item])
  }

  let emailsSent = 0
  for (const holderItems of Array.from(grouped.values())) {
    const first = holderItems[0]
    const emailItems = holderItems.map((item) => ({
      assetTag: item.asset_tag ?? '',
      assetName: item.asset_name ?? '',
      assetType: item.asset_type,
      setName: item.set_name,
      status: item.status,
      notes: item.admin_notes,
    }))
    if (first.holder_email) {
      try {
        await sendHandoverMissingReminder({
          toEmail: first.holder_email,
          holderName: first.holder_name,
          sessionTitle: session.title,
          items: emailItems,
        })
        emailsSent += 1
      } catch (err) { console.error('Missing reminder holder email error:', err) }
    }
    try {
      await sendHandoverAdminSummary({
        sessionTitle: session.title,
        holderName: first.holder_name,
        subjectPrefix: 'Missing handover reminder',
        items: emailItems,
      })
    } catch (err) { console.error('Missing reminder admin email error:', err) }
  }

  return NextResponse.json({ ok: true, emailsSent, outstanding: outstanding.length })
}
