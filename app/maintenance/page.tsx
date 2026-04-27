export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import MaintenanceClient from './MaintenanceClient'

export default async function MaintenancePage() {
  const auth = getAuthFromCookies()!
  const canManage = isAdmin(auth)
  const [initialJobs, users, locations, sets] = await Promise.all([
    canManage ? db.getAllMaintenanceJobs() : db.getMaintenanceJobsForUser(auth.userId, auth.email),
    canManage ? db.getAllUsers() : Promise.resolve([]),
    db.getAllLocations(),
    db.getAllSets(),
  ])

  return (
    <AppShell>
      <MaintenanceClient
        initialJobs={initialJobs}
        users={users.filter(u => u.role === 'admin' || u.role === 'superadmin')}
        locations={locations}
        sets={sets}
        canManage={canManage}
      />
    </AppShell>
  )
}
