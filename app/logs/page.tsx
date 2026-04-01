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

  const [allocations, requests] = await Promise.all([
    db.getAllAllocations(),
    db.getAllRequests(),
  ])

  return (
    <AppShell>
      <LogsClient allocations={allocations} requests={requests} />
    </AppShell>
  )
}
