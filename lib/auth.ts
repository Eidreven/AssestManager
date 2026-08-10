import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters')
  }
  return secret
}
const COOKIE_NAME = 'mps_auth_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface TokenPayload {
  userId: number
  email: string
  name: string
  role: 'superadmin' | 'admin' | 'teacher'
  authVersion: number
  mustChangePassword?: boolean
  impersonatedBy?: number
  impersonatedByName?: string
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload
  } catch {
    return null
  }
}

export function setAuthCookie(token: string): void {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export function clearAuthCookie(): void {
  cookies().delete(COOKIE_NAME)
}

export function getAuthFromCookies(): TokenPayload | null {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export function getAuthFromRequest(req: NextRequest): TokenPayload | null {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

/** True for both 'admin' and 'superadmin' */
export function isAdmin(auth: TokenPayload | null): boolean {
  return auth?.role === 'admin' || auth?.role === 'superadmin'
}

/** True only for 'superadmin' */
export function isSuperAdmin(auth: TokenPayload | null): boolean {
  return auth?.role === 'superadmin'
}

/** @deprecated use isAdmin() */
export function requireAdmin(auth: TokenPayload | null): boolean {
  return isAdmin(auth)
}
