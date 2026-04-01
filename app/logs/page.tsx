export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LogsClient from './LogsClient'

export default async function LogsPage() {
  const auth = getAuthFromCookies()
  if (!auth) redirect('/login')
  if (!isAdmin(auth)) redirect('/dashboard')

  const [allocations, activityLogs] = await Promise.all([
    db.getAllAllocations(),
    db.getRecentActivity(500),
  ])

  // Auto-purge activity logs older than 30 days (silently)
  db.purgeActivityLogsOlderThan(30).catch(() => {})

  return (
    <AppShell>
      <LogsClient allocations={allocations} activityLogs={activityLogs} />
    </AppShell>
  )
}
