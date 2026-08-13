'use client'

import type { AssetWithDetails } from '@/lib/db'
import Link from 'next/link'
import { useState } from 'react'

type OpenSection = 'it' | 'classroom' | null

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  allocated: 'Allocated',
  maintenance: 'Maintenance',
  retired: 'Retired',
}

function AssetList({ assets, emptyMessage, classroomAsset }: { assets: AssetWithDetails[]; emptyMessage: string; classroomAsset?: boolean }) {
  if (assets.length === 0) return <div className="px-5 py-10 text-center text-sm text-gray-500">{emptyMessage}</div>

  return (
    <div className="divide-y divide-gray-100">
      {assets.map(asset => (
        <Link key={asset.id} href={`/asset/${asset.id}`} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-gray-50 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-blue-700">{asset.asset_tag}</span>
              <span className={`badge-${asset.status}`}>{STATUS_LABELS[asset.status] ?? asset.status}</span>
            </div>
            <p className="mt-1 font-semibold text-gray-900">{asset.name}</p>
            <p className="text-xs text-gray-500">{asset.type}{asset.model ? ` | ${asset.model}` : ''}</p>
          </div>
          {classroomAsset ? (
            <div className="sm:text-right">
              <p className="font-semibold text-gray-900">{asset.quantity_total} {asset.quantity_total === 1 ? 'item' : 'items'}</p>
              <p className="text-xs text-gray-500">{asset.quantity_good} good | {asset.quantity_fair} fair | {asset.quantity_damaged} damaged | {asset.quantity_missing} missing</p>
            </div>
          ) : (
            <div className="text-xs text-gray-500 sm:text-right">
              <p>{asset.serial_number ? `Serial ${asset.serial_number}` : 'No serial number'}</p>
              <p>{asset.current_allocation ? `Allocated to ${asset.current_allocation.allocated_to}` : 'Not allocated'}</p>
            </div>
          )}
          <svg className="hidden h-5 w-5 text-gray-300 sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </Link>
      ))}
    </div>
  )
}

function SectionButton({ section, openSection, title, subtitle, count, tone, onToggle }: {
  section: Exclude<OpenSection, null>
  openSection: OpenSection
  title: string
  subtitle: string
  count: number
  tone: 'blue' | 'amber'
  onToggle: (section: Exclude<OpenSection, null>) => void
}) {
  const isOpen = openSection === section
  const colors = tone === 'blue'
    ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-950 hover:border-blue-400'
    : 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-950 hover:border-amber-400'

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls="classroom-asset-panel"
      onClick={() => onToggle(section)}
      className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition ${colors} ${isOpen ? 'ring-2 ring-blue-900/10 shadow-sm' : ''}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-lg font-bold shadow-sm">{count}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wider opacity-70">{subtitle}</span>
        <span className="block font-bold">{title}</span>
      </span>
      <svg className={`h-5 w-5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

export default function ClassroomAssetSections({ itAssets, classroomAssets }: { itAssets: AssetWithDetails[]; classroomAssets: AssetWithDetails[] }) {
  const [openSection, setOpenSection] = useState<OpenSection>(null)
  const toggleSection = (section: Exclude<OpenSection, null>) => setOpenSection(current => current === section ? null : section)

  return (
    <section className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <SectionButton section="it" openSection={openSection} title="IT Assets" subtitle="Technology register" count={itAssets.length} tone="blue" onToggle={toggleSection} />
        <SectionButton section="classroom" openSection={openSection} title="Classroom Assets" subtitle="Furniture and equipment" count={classroomAssets.length} tone="amber" onToggle={toggleSection} />
      </div>

      {openSection && (
        <div id="classroom-asset-panel" className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${openSection === 'it' ? 'text-blue-700' : 'text-amber-700'}`}>
                {openSection === 'it' ? 'Technology register' : 'Room register'}
              </p>
              <h2 className="font-bold text-gray-900">{openSection === 'it' ? 'IT Assets' : 'Classroom Assets'}</h2>
            </div>
            <Link href={`/assets?class=${openSection}`} className={`text-xs font-medium ${openSection === 'it' ? 'text-blue-700' : 'text-amber-700'}`}>
              Full register
            </Link>
          </div>
          {openSection === 'it' ? (
            <AssetList assets={itAssets} emptyMessage="No IT assets are assigned to this classroom." />
          ) : (
            <AssetList assets={classroomAssets} emptyMessage="No furniture or classroom equipment is assigned to this room." classroomAsset />
          )}
        </div>
      )}
    </section>
  )
}
