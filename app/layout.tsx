import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MPS Asset Manager',
  description: 'Macfarlane Primary School – Technology Asset Management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
