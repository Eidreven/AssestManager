'use client'

import { useState } from 'react'

export type TimelineEntry = {
  id: string
  type: 'registered' | 'allocated' | 'returned' | 'request_created' | 'request_approved' | 'request_rejected' | 'request_completed' | 'status_changed' | 'edited'
  timestamp: string
  actorName: string | null
  summary: string
  detail?: string | null
}

const EVENT_CONFIG: Record<TimelineEntry['type'], { label: string; dot: string; badge: string }> = {
  registered:         { label: 'Registered',        dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-700' },
  allocated:          { label: 'Allocated',          dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700' },
  returned:           { label: 'Returned',           dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700' },
  request_created:    { label: 'Request submitted',  dot: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700' },
  request_approved:   { label: 'Request approved',   dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700' },
  request_rejected:   { label: 'Request rejected',   dot: 'bg-red-400',    badge: 'bg-red-100 text-red-700' },
  request_completed:  { label: 'Request completed',  dot: 'bg-teal-500',   badge: 'bg-teal-100 text-teal-700' },
  status_changed:     { label: 'Status changed',     dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700' },
  edited:             { label: 'Details updated',    dot: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-600' },
}

function formatDate(s: string) {
  return new Date(s).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Australia/Darwin',
  })
}

export default function AssetHistory({ timeline }: { timeline: TimelineEntry[] }) {
  const [expanded, setExpanded] = useState(false)

  if (timeline.length === 0) return null

  const shown = expanded ? timeline : timeline.slice(0, 5)

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-gray-900 mb-5">Full History ({timeline.length} events)</h2>
      <ol className="relative border-l border-gray-200 space-y-6 ml-2">
        {shown.map(entry => {
          const cfg = EVENT_CONFIG[entry.type] ?? EVENT_CONFIG.edited
          return (
            <li key={entry.id} className="ml-5">
              {/* dot on the line */}
              <span className={`absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white ${cfg.dot}`} />
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                <time className="text-xs text-gray-400">{formatDate(entry.timestamp)}</time>
              </div>
              <p className="text-sm font-medium text-gray-900">{entry.summary}</p>
              {entry.actorName && (
                <p className="text-xs text-gray-500 mt-0.5">By {entry.actorName}</p>
              )}
              {entry.detail && (
                <p className="text-xs text-gray-400 mt-0.5 italic">{entry.detail}</p>
              )}
            </li>
          )
        })}
      </ol>
      {timeline.length > 5 && (
        <button onClick={() => setExpanded(!expanded)} className="mt-5 text-sm text-blue-600 hover:underline">
          {expanded ? 'Show less' : `Show all ${timeline.length} events`}
        </button>
      )}
    </div>
  )
}
