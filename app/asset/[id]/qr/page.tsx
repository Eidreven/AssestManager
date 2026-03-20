import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'
import { notFound } from 'next/navigation'
import QRPrintClient from './QRPrintClient'

export default function QRPage({ params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) notFound()
  const asset = db.getAssetById(Number(params.id))
  if (!asset) notFound()

  return <QRPrintClient asset={asset} />
}
