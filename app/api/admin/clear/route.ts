import { NextResponse } from 'next/server'
import { getAuthFromCookies } from '@/lib/auth'
import { rawSql } from '@/lib/db'

export async function DELETE() {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Delete all data except user accounts
  await rawSql('DELETE FROM requests')
  await rawSql('DELETE FROM allocations')
  await rawSql('DELETE FROM assets')
  await rawSql('DELETE FROM locations')

  return NextResponse.json({ ok: true })
}
