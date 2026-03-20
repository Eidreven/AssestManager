import { redirect } from 'next/navigation'
import { getAuthFromCookies } from '@/lib/auth'

export default function Home() {
  const auth = getAuthFromCookies()
  if (!auth) redirect('/login')
  redirect('/dashboard')
}
