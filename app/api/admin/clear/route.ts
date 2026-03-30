import { NextResponse } from 'next/server'
import { getAuthFromCookies, isSuperAdmin } from '@/lib/auth'
import { rawSql } from '@/lib/db'

export async function DELETE() {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(auth)) return NextResponse.json({ error: 'Forbidden – Super Admin only' }, { status: 403 })

  // Delete all data except user accounts
  await rawSql('DELETE FROM requests')
  await rawSql('DELETE FROM allocations')
  await rawSql('DELETE FROM assets')
  await rawSql('DELETE FROM locations')

  return NextResponse.json({ ok: true })
}
