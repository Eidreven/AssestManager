import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { getDb } from '@/lib/db'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const token = getAuthFromRequest(req)
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const typeFilter = searchParams.get('type') ?? 'all'
  const statusFilter = searchParams.get('status') ?? 'all'

  const db = getDb()

  let query = `
    SELECT
      a.asset_tag AS "Asset Tag",
      a.name AS "Name",
      a.type AS "Type",
      a.model AS "Model",
      a.serial_number AS "Serial Number",
      a.status AS "Status",
      l.name AS "Location",
      a.purchase_date AS "Purchase Date",
      a.warranty_expiry AS "Warranty Expiry",
      al.allocated_to AS "Allocated To",
      al.allocated_to_role AS "Role",
      al.purpose AS "Purpose",
      al.allocated_at AS "Allocated At",
      al.expected_return AS "Expected Return",
      a.notes AS "Notes"
    FROM assets a
    LEFT JOIN locations l ON a.location_id = l.id
    LEFT JOIN allocations al ON al.asset_id = a.id AND al.returned_at IS NULL
    WHERE 1=1
  `

  const params: string[] = []

  if (typeFilter !== 'all') {
    query += ` AND LOWER(a.type) LIKE LOWER(?)`
    params.push(`%${typeFilter}%`)
  }

  if (statusFilter !== 'all') {
    query += ` AND a.status = ?`
    params.push(statusFilter)
  }

  query += ` ORDER BY a.asset_tag ASC`

  const rows = db.prepare(query).all(...params) as Record<string, string | null>[]

  // Clean up nulls to empty strings for Excel
  const cleaned = rows.map(row =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v ?? '']))
  )

  const worksheet = XLSX.utils.json_to_sheet(cleaned)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets Report')

  // Auto column widths
  const colWidths = Object.keys(cleaned[0] ?? {}).map(key => ({
    wch: Math.max(key.length, ...cleaned.map(r => String(r[key] ?? '').length)) + 2,
  }))
  worksheet['!cols'] = colWidths

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  const typeLabel = typeFilter === 'all' ? 'All' : typeFilter
  const statusLabel = statusFilter === 'all' ? 'All' : statusFilter
  const date = new Date().toISOString().slice(0, 10)
  const filename = `assets-report-${typeLabel}-${statusLabel}-${date}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
