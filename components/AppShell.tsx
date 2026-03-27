import { getAuthFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from './Navbar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const auth = getAuthFromCookies()
  if (!auth) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={{ name: auth.name, email: auth.email, role: auth.role }} />
      <main className="lg:pl-60 pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
        <div className="lg:pl-0 px-4 sm:px-6 lg:px-8 pb-6 text-center">
          <p className="text-xs text-gray-300">MPS Asset Manager · v1.0-beta</p>
        </div>
      </main>
    </div>
  )
}
