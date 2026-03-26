import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.TURSO_DATABASE_URL ?? 'NOT SET'
  const token = process.env.TURSO_AUTH_TOKEN ?? 'NOT SET'
  return NextResponse.json({
    url_prefix: url.substring(0, 15),
    url_length: url.length,
    token_prefix: token.substring(0, 10),
    token_length: token.length,
    token_char6: token.charCodeAt(6),
  })
}
