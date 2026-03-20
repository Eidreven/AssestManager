'use client'

import { useState } from 'react'
import type { AllocationWithDetails } from '@/lib/db'

export default function AssetHistory({ history, assetId }: { history: AllocationWithDetails[]; assetId: number }) {
  const [expanded, setExpanded] = useState(false)

  if (history.length === 0) return null

  const shown = expanded ? history : history.slice(0, 3)

  function formatDate(s: string | null) {
    if (!s) return '—'
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Allocation History ({history.length})</h2>
      <div className="space-y-3">
        {shown.map((a, i) => (
          <div key={a.id} className={`flex items-start gap-4 text-sm ${i > 0 ? 'border-t border-gray-100 pt-3' : ''}`}>
            <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-blue-400" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium text-gray-900">{a.allocated_to}</span>
                {a.allocated_to_role && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{a.allocated_to_role}</span>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-gray-500 text-xs">
                <span>From {formatDate(a.allocated_at)}</span>
                {a.returned_at
                  ? <span>→ {formatDate(a.returned_at)}</span>
                  : <span className="text-blue-600 font-medium">Active</span>
                }
                {a.location_name && <span>📍 {a.location_name}</span>}
                {a.is_temporary ? <span>⏱ Temporary</span> : null}
              </div>
              {a.purpose && <p className="text-xs text-gray-400 mt-0.5">{a.purpose}</p>}
            </div>
          </div>
        ))}
      </div>
      {history.length > 3 && (
        <button onClick={() => setExpanded(!expanded)} className="mt-4 text-sm text-blue-600 hover:underline">
          {expanded ? 'Show less' : `Show all ${history.length} records`}
        </button>
      )}
    </div>
  )
}
