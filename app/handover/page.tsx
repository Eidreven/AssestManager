export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import HandoverClient from './HandoverClient'

export default async function HandoverPage() {
  const auth = getAuthFromCookies()
  if (!isAdmin(auth)) redirect('/dashboard')

  const sessions = await db.getAllHandoverSessions()

  return (
    <AppShell>
      <HandoverClient initialSessions={sessions} />
    </AppShell>
  )
}
