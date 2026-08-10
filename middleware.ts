import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE_NAME = 'mps_auth_token'

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

async function tokenMatchesCurrentUser(userId: number, role: string, authVersion: number): Promise<boolean> {
  const databaseUrl = process.env.TURSO_DATABASE_URL?.replace('libsql://', 'https://')
  const databaseToken = process.env.TURSO_AUTH_TOKEN
  if (process.env.NODE_ENV !== 'production' && process.env.TURSO_DATABASE_URL?.startsWith('file:')) return true
  if (!databaseUrl || !databaseToken || !Number.isInteger(userId) || !Number.isInteger(authVersion)) return false

  const response = await fetch(`${databaseUrl}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${databaseToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: {
      sql: 'SELECT role, auth_version FROM users WHERE id = ? LIMIT 1',
      args: [{ type: 'integer', value: String(userId) }],
    } }] }),
    cache: 'no-store',
  })
  if (!response.ok) return false
  const data = await response.json() as {
    results?: { type: string; response?: { result?: { rows?: { type: string; value: string }[][] } } }[]
  }
  const row = data.results?.[0]?.response?.result?.rows?.[0]
  if (!row) return false
  return row[0]?.value === role && Number(row[1]?.value) === authVersion
}

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/api/auth/login', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/debug', '/scan', '/api/requests']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow Next.js internals and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('returnUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    const current = await tokenMatchesCurrentUser(
      Number(payload.userId),
      String(payload.role),
      Number(payload.authVersion),
    )
    if (!current) throw new Error('Session is no longer current')
    return NextResponse.next()
  } catch {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('returnUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
