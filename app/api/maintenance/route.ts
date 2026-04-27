import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

export async function GET() {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jobs = isAdmin(auth)
    ? await db.getAllMaintenanceJobs()
    : await db.getMaintenanceJobsForUser(auth.userId, auth.email)

  return NextResponse.json(jobs)
}
