import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest, isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { createCsv, createWorkbookBuffer } from '@/lib/report-export'
import {
  generateReport,
  isReportId,
  parseReportFilters,
  type ReportData,
} from '@/lib/reporting'

async function loadReportData(): Promise<ReportData> {
  const [assets, allocations, requests, maintenance, locations, sets, handovers] = await Promise.all([
    db.getAllAssets(),
    db.getAllAllocations(),
    db.getAllRequests(),
    db.getAllMaintenanceJobs(),
    db.getAllLocations(),
    db.getAllSets(),
    db.getAllHandoverSessions(),
  ])
  const itemGroups = await Promise.all(handovers.map(async session =>
    (await db.getHandoverItems(session.id)).map(item => ({ ...item, session_title: session.title }))
  ))
  return { assets, allocations, requests, maintenance, locations, sets, handovers, handoverItems: itemGroups.flat() }
}

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Reports are available to administrators only' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const reportId = searchParams.get('report') ?? 'executive-pack'
  if (!isReportId(reportId)) return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })

  const format = searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'
  if (format === 'csv' && (reportId === 'executive-pack' || reportId === 'handover')) {
    return NextResponse.json({ error: 'This multi-sheet report is available as Excel only' }, { status: 400 })
  }

  const filters = parseReportFilters(searchParams)
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
  }

  const data = await loadReportData()
  const report = generateReport(reportId, data, filters)
  const date = new Date().toISOString().slice(0, 10)
  const filename = `mps-${reportId}-${date}.${format}`

  if (format === 'csv') {
    const csv = `\uFEFF${createCsv(report)}`
    await db.logActivity(auth.userId, auth.name, 'report_export', `${report.title} (CSV)`)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  }

  const workbook = Uint8Array.from(createWorkbookBuffer(report, filters)).buffer
  await db.logActivity(auth.userId, auth.name, 'report_export', `${report.title} (XLSX)`)
  return new NextResponse(workbook, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
