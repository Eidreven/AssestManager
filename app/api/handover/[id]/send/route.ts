import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { sendHandoverAdminSummary, sendHandoverRequestEmail } from '@/lib/email'

function groupByHolder<T extends { holder_name: string; holder_email: string | null }>(items: T[]) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = `${item.holder_name}::${item.holder_email ?? ''}`
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return groups
}

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

  let emailsSent = 0
  for (const holderItems of Array.from(groupByHolder(items).values())) {
    const first = holderItems[0]
    const emailItems = holderItems.map((item) => ({
      assetTag: item.asset_tag ?? '',
      assetName: item.asset_name ?? '',
      assetType: item.asset_type,
      setName: item.set_name,
    }))
    if (first.holder_email) {
      try {
        await sendHandoverRequestEmail({
          toEmail: first.holder_email,
          holderName: first.holder_name,
          sessionTitle: session.title,
          items: emailItems,
        })
        emailsSent += 1
      } catch (err) { console.error('Handover holder email error:', err) }
    }
    try {
      await sendHandoverAdminSummary({
        sessionTitle: session.title,
        holderName: first.holder_name,
        subjectPrefix: 'Handover request sent',
        items: emailItems,
      })
    } catch (err) { console.error('Handover admin copy error:', err) }
  }

  await db.updateHandoverSession(id, { status: 'sent', sent_at: new Date().toISOString() })
  return NextResponse.json({ ok: true, emailsSent })
}
