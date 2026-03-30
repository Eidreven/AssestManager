import AppShell from '@/components/AppShell'
import AdminClient from './AdminClient'
import { getAuthFromCookies } from '@/lib/auth'

export default function AdminPage() {
  const auth = getAuthFromCookies()
  const isSuperAdmin = auth?.role === 'superadmin'

  return (
    <AppShell>
      <AdminClient isSuperAdmin={isSuperAdmin} />
    </AppShell>
  )
}
