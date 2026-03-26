import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const asset = db.getAssetById(Number(params.id))
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Use the Host header so the QR code points to the correct IP/hostname
  const host = req.headers.get('host') ?? req.nextUrl.host
  const protocol = req.headers.get('x-forwarded-proto') ?? 'http'
  const url = `${protocol}://${host}/scan/${asset.id}`

  const format = req.nextUrl.searchParams.get('format') ?? 'png'

  if (format === 'svg') {
    const svg = await QRCode.toString(url, {
      type: 'svg',
      width: 300,
      margin: 2,
      color: { dark: '#1e3a8a', light: '#ffffff' },
    })
    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml' },
    })
  }

  // PNG (default)
  const buffer = await QRCode.toBuffer(url, {
    type: 'png',
    width: 400,
    margin: 2,
    color: { dark: '#1e3a8a', light: '#ffffff' },
  })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${asset.asset_tag}-qr.png"`,
    },
  })
}
