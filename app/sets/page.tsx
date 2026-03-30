export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import AppShell from '@/components/AppShell'
import SetsClient from './SetsClient'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

export default async function SetsPage() {
  const auth = getAuthFromCookies()
  const isAdminUser = isAdmin(auth)

  const [sets, locations, users] = await Promise.all([
    db.getAllSets(),
    db.getAllLocations(),
    db.getAllUsers(),
  ])

  return (
    <AppShell>
      <SetsClient
        initialSets={sets}
        locations={locations}
        users={users.map(u => u.name)}
        isAdmin={isAdminUser}
      />
    </AppShell>
  )
}
