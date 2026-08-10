export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'
import ReportsClient from './ReportsClient'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function ReportsPage() {
  const auth = getAuthFromCookies()
  if (!isAdmin(auth)) redirect('/dashboard')
  const [teachers, assets, locations] = await Promise.all([db.getTeachers(), db.getAllAssets(), db.getAllLocations()])
  const types = Array.from(new Set(assets.map(asset => asset.type))).sort()
  const holders = Array.from(new Set([
    ...teachers.map(teacher => teacher.name),
    ...assets.flatMap(asset => asset.current_allocation ? [asset.current_allocation.allocated_to] : []),
  ])).sort()
  return (
    <AppShell>
      <ReportsClient
        holders={holders}
        types={types}
        locations={locations.map(location => ({ id: location.id, name: location.name, type: location.location_type }))}
      />
    </AppShell>
  )
}
