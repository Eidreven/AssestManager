import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'
import os from 'os'

function getLocalIP(): string {
  const nets = os.networkInterfaces()
  for (const iface of Object.values(nets)) {
    for (const net of iface ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return 'localhost'
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const asset = db.getAssetById(Number(params.id))
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Use the machine's local network IP so iPads/phones on the same WiFi can open it
  const port = req.nextUrl.port || '3000'
  const localIP = getLocalIP()
  const url = `http://${localIP}:${port}/scan/${asset.id}`

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
