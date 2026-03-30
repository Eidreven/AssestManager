export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'
import RequestsClient from './RequestsClient'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'

export default function RequestsPage() {
  const auth = getAuthFromCookies()
  const canManage = isAdmin(auth)
  return (
    <AppShell>
      <RequestsClient canManage={canManage} />
    </AppShell>
  )
}
