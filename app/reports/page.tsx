export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'
import ReportsClient from './ReportsClient'
import { db } from '@/lib/db'

export default async function ReportsPage() {
  const teachers = await db.getTeachers()
  return (
    <AppShell>
      <ReportsClient teachers={teachers.map(t => t.name)} />
    </AppShell>
  )
}
