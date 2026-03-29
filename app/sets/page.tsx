export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import AppShell from '@/components/AppShell'
import SetsClient from './SetsClient'

export default async function SetsPage() {
  const [sets, locations, teachers] = await Promise.all([
    db.getAllSets(),
    db.getAllLocations(),
    db.getTeachers(),
  ])

  return (
    <AppShell>
      <SetsClient
        initialSets={sets}
        locations={locations}
        teachers={teachers.map(t => t.name)}
      />
    </AppShell>
  )
}
