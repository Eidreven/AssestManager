export const dynamic = 'force-dynamic'

import AppShell from '@/components/AppShell'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import AssetActions from './AssetActions'
import AssetHistory, { type TimelineEntry } from './AssetHistory'

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()!
  const assetId = Number(params.id)

  // Fetch everything in parallel — asset id is known from params
  const [asset, locations, teachers, sets, history, requests, assetLogs] = await Promise.all([
    db.getAssetById(assetId),
    db.getAllLocations(),
    db.getTeachers(),
    db.getAllSets(),
    db.getAllocationHistory(assetId),
    db.getRequestsByAsset(assetId),
    db.getAssetLogs(assetId),
  ])
  if (!asset) notFound()

  // Build unified timeline from allocations + asset_logs
  const timeline: TimelineEntry[] = []

  // Convert allocations → timeline entries
  for (const a of history) {
    timeline.push({
      id: `alloc-${a.id}`,
      type: 'allocated',
      timestamp: a.allocated_at,
      actorName: a.allocated_by_name ?? null,
      summary: `Allocated to ${a.allocated_to}${a.allocated_to_role ? ` (${a.allocated_to_role})` : ''}`,
      detail: [
        a.location_name ? `Location: ${a.location_name}` : null,
        a.purpose ?? null,
        a.is_temporary ? 'Temporary allocation' : null,
        a.expected_return ? `Expected return: ${new Date(a.expected_return).toLocaleDateString('en-GB')}` : null,
      ].filter(Boolean).join(' · ') || null,
    })
    if (a.returned_at) {
      timeline.push({
        id: `return-${a.id}`,
        type: 'returned',
        timestamp: a.returned_at,
        actorName: null,
        summary: `Returned from ${a.allocated_to}`,
      })
    }
  }

  // Convert asset_logs → timeline entries
  for (const log of assetLogs) {
    const type = log.event_type as TimelineEntry['type']
    // Skip if not a recognised type
    if (!['registered','allocated','returned','request_created','request_approved','request_rejected','request_completed','status_changed','edited'].includes(type)) continue
    // Skip allocation/return duplicates (already built from allocations table)
    if (type === 'allocated' || type === 'returned') continue
    timeline.push({
      id: `log-${log.id}`,
      type,
      timestamp: log.created_at,
      actorName: log.actor_name,
      summary: log.detail ?? type,
    })
  }

  // Sort newest first
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const alloc = asset.current_allocation

  function formatDate(s: string | null | undefined) {
    if (!s) return null
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const STATUS_COLORS: Record<string, string> = {
    available: 'bg-green-100 text-green-800 border-green-200',
    allocated: 'bg-blue-100 text-blue-800 border-blue-200',
    maintenance: 'bg-amber-100 text-amber-800 border-amber-200',
    retired: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  const DEVICE_ICONS: Record<string, string> = {
    iPad: '📱', Laptop: '💻', Chromebook: '💻', Desktop: '🖥️',
    Printer: '🖨️', Projector: '📽️', Camera: '📷', Monitor: '🖥️', Tablet: '📱',
  }
  const icon = DEVICE_ICONS[asset.type] ?? '🔧'

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/assets" className="hover:text-blue-600">Assets</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{asset.asset_tag}</span>
        </nav>

        {/* Main card */}
        <div className="card overflow-hidden">
          {/* Header band */}
          <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl">{icon}</div>
                <div>
                  <p className="font-mono text-blue-200 text-sm">{asset.asset_tag}</p>
                  <h1 className="text-xl font-bold">{asset.name}</h1>
                  <p className="text-blue-200 text-sm">{asset.type}{asset.model ? ` — ${asset.model}` : ''}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`badge border ${STATUS_COLORS[asset.status] ?? 'bg-gray-100 text-gray-600'} capitalize`}>
                  {asset.status}
                </span>
                {/* QR buttons (admin only) */}
                {(auth.role === 'admin' || auth.role === 'superadmin') && (
                  <div className="flex gap-2">
                    <a
                      href={`/api/assets/${asset.id}/qr`}
                      download={`${asset.asset_tag}-qr.png`}
                      className="text-xs bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                    <Link
                      href={`/asset/${asset.id}/qr`}
                      target="_blank"
                      className="text-xs bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Print
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details grid + QR */}
          <div className="p-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-1 grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <Detail label="Serial Number" value={asset.serial_number} />
                <Detail label="Location" value={asset.location_name} />
                {asset.set_name && (
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Class Set</p>
                    <a href={`/sets/${asset.set_id}`} className="text-blue-600 hover:underline font-medium text-sm">
                      📦 {asset.set_name}
                    </a>
                  </div>
                )}
                <Detail label="Purchase Date" value={formatDate(asset.purchase_date)} />
                <Detail label="Warranty Expiry" value={formatDate(asset.warranty_expiry)} />
                {asset.notes && (
                  <div className="sm:col-span-2">
                    <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-gray-700">{asset.notes}</p>
                  </div>
                )}
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/assets/${asset.id}/qr?format=svg`}
                  alt={`QR code for ${asset.asset_tag}`}
                  width={120}
                  height={120}
                  className="block rounded-lg"
                />
                <p className="text-xs text-gray-400 text-center">Scan to report issue</p>
              </div>
            </div>
          </div>
        </div>

        {/* Current Allocation */}
        {alloc ? (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                Currently Allocated
              </h2>
              {(auth.role === 'admin' || auth.role === 'superadmin') && (
                <AssetActions
                  assetId={asset.id}
                  assetStatus={asset.status}
                  allocationId={alloc.id}
                  locations={locations}
                  teachers={teachers}
                  sets={sets}
                  mode="return"
                />
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Detail label="Allocated To" value={alloc.allocated_to} bold />
              <Detail label="Role" value={alloc.allocated_to_role} />
              <Detail label="Since" value={formatDate(alloc.allocated_at)} />
              <Detail label="Location" value={alloc.location_name} />
              <Detail label="Purpose" value={alloc.purpose} />
              {alloc.is_temporary ? (
                <Detail label="Type" value="Temporary Borrow" />
              ) : null}
              {alloc.expected_return && (
                <Detail label="Expected Return" value={formatDate(alloc.expected_return)} />
              )}
              {alloc.notes && (
                <div className="sm:col-span-2">
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-gray-700">{alloc.notes}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <span className="font-semibold text-gray-900">Not Currently Allocated</span>
              </div>
              {(auth.role === 'admin' || auth.role === 'superadmin') && (
                <AssetActions
                  assetId={asset.id}
                  assetStatus={asset.status}
                  allocationId={null}
                  locations={locations}
                  teachers={teachers}
                  sets={sets}
                  mode="allocate"
                />
              )}
            </div>
          </div>
        )}

        {/* Request buttons — available to all logged-in users */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Submit a Request</h2>
          <p className="text-sm text-gray-500 mb-4">
            Need to borrow or relocate this device? Submit a request and a member of staff will review it.
          </p>
          <AssetActions
            assetId={asset.id}
            assetStatus={asset.status}
            allocationId={alloc?.id ?? null}
            locations={locations}
            teachers={teachers}
            sets={sets}
            mode="request"
          />
        </div>

        {/* Pending requests for this asset */}
        {requests.filter(r => r.status === 'pending').length > 0 && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Open Requests</h2>
            <div className="space-y-3">
              {requests.filter(r => r.status === 'pending').map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm">
                  <div>
                    <p className="font-medium">{r.request_type === 'borrow' ? 'Borrow Request' : 'Relocation Request'}</p>
                    <p className="text-gray-500 text-xs mt-0.5">by {r.requester_name}{r.requester_class ? ` (${r.requester_class})` : ''} on {formatDate(r.created_at)}</p>
                    {r.reason && <p className="text-gray-600 text-xs mt-1">{r.reason}</p>}
                  </div>
                  <span className="badge-pending">Pending</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        <AssetHistory timeline={timeline} />

        {/* Admin edit link */}
        {(auth.role === 'admin' || auth.role === 'superadmin') && (
          <div className="flex justify-end gap-3">
            <Link href={`/assets/${asset.id}/edit`} className="btn-secondary">
              Edit Asset Details
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function Detail({ label, value, bold }: { label: string; value: string | null | undefined; bold?: boolean }) {
  if (!value) return null
  return (
    <div>
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-gray-900 ${bold ? 'font-semibold text-base' : ''}`}>{value}</p>
    </div>
  )
}
