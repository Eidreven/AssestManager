import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const type = req.nextUrl.searchParams.get('type')
  if (!type) return NextResponse.json({ error: 'type is required' }, { status: 400 })

  const tag = await db.nextAssetTag(type)
  return NextResponse.json({ tag })
}
