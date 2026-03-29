import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

// POST /api/sets/[id]/members — add asset to set
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const setId = Number(params.id)
  const { asset_id } = await req.json()
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  await db.addAssetToSet(Number(asset_id), setId)
  return NextResponse.json({ ok: true })
}

// DELETE /api/sets/[id]/members?asset_id=X — remove asset from set
export async function DELETE(req: NextRequest) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const assetId = req.nextUrl.searchParams.get('asset_id')
  if (!assetId) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  await db.removeAssetFromSet(Number(assetId))
  return NextResponse.json({ ok: true })
}
