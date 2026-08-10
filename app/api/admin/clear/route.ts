import { NextResponse } from 'next/server'
import { getAuthFromCookies, isSuperAdmin } from '@/lib/auth'
import { rawSql } from '@/lib/db'

export async function DELETE() {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(auth)) return NextResponse.json({ error: 'Forbidden – Super Admin only' }, { status: 403 })

  // Delete all data except user accounts
  await rawSql('DELETE FROM handover_items')
  await rawSql('DELETE FROM handover_sessions')
  await rawSql('DELETE FROM maintenance_jobs')
  await rawSql('DELETE FROM asset_logs')
  await rawSql('DELETE FROM requests')
  await rawSql('DELETE FROM allocations')
  await rawSql('DELETE FROM assets')
  await rawSql('DELETE FROM asset_sets')
  await rawSql('DELETE FROM locations')
  await rawSql('DELETE FROM activity_logs')

  return NextResponse.json({ ok: true })
}
