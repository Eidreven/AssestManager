export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import AppShell from '@/components/AppShell'
import { notFound } from 'next/navigation'
import SetDetailClient from './SetDetailClient'
import { getAuthFromCookies } from '@/lib/auth'

export default async function SetDetailPage({ params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  const isAdmin = auth?.role === 'admin'

  const setId = Number(params.id)
  const [set, setAssets, allAssets, locations, teachers] = await Promise.all([
    db.getSetById(setId),
    db.getAssetsInSet(setId),
    db.getAllAssets(),
    db.getAllLocations(),
    db.getTeachers(),
  ])

  if (!set) notFound()

  // Assets not already in a set (available to add)
  const unassigned = allAssets.filter(a => !a.set_id)

  return (
    <AppShell>
      <SetDetailClient
        set={set}
        isAdmin={isAdmin}
        setAssets={setAssets.map(a => ({
          id: a.id,
          asset_tag: a.asset_tag,
          name: a.name,
          type: a.type,
          status: a.status,
          allocated_to: a.current_allocation?.allocated_to ?? null,
        }))}
        unassigned={unassigned.map(a => ({ id: a.id, asset_tag: a.asset_tag, name: a.name, type: a.type }))}
        locations={locations}
        teachers={teachers.map(t => t.name)}
      />
    </AppShell>
  )
}
