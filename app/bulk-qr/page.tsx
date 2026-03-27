export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import AppShell from '@/components/AppShell'
import { getAuthFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import BulkQrClient from './BulkQrClient'

export default async function BulkQrPage() {
  const auth = getAuthFromCookies()
  if (!auth || auth.role !== 'admin') redirect('/dashboard')

  const assets = await db.getAllAssets()
  const teachers = await db.getTeachers()

  const assetData = assets.map(a => ({
    id: a.id,
    asset_tag: a.asset_tag,
    name: a.name,
    type: a.type,
    model: a.model,
    status: a.status,
    allocated_to: a.current_allocation?.allocated_to ?? null,
    allocated_to_role: a.current_allocation?.allocated_to_role ?? null,
  }))

  return (
    <AppShell>
      <BulkQrClient assets={assetData} teachers={teachers.map(t => t.name)} />
    </AppShell>
  )
}
