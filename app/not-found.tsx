import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-blue-900">404</p>
        <h1 className="text-xl font-semibold text-gray-900 mt-2">Page not found</h1>
        <p className="text-gray-500 mt-1">The page or asset you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/dashboard" className="btn-primary mt-6 inline-flex">Go to Dashboard</Link>
      </div>
    </div>
  )
}
