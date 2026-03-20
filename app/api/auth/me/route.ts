import { NextResponse } from 'next/server'
import { getAuthFromCookies } from '@/lib/auth'

export async function GET() {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ user: null })
  return NextResponse.json({ user: auth })
}
