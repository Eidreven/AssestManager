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
  const classFilter = searchParams.get('asset_class') ?? 'all'
  const statusFilter = searchParams.get('status') ?? 'all'
  const teacherFilter = searchParams.get('teacher') ?? 'all'

  const db = getDb()

  let sql = `
    SELECT
      a.asset_tag AS "Asset Tag",
      a.name AS "Name",
      a.type AS "Type",
      a.asset_class AS "Asset Register",
      a.tracking_mode AS "Tracking Mode",
      a.quantity_total AS "Total Quantity",
      a.condition AS "Condition",
      a.quantity_good AS "Good",
      a.quantity_fair AS "Fair",
      a.quantity_damaged AS "Damaged",
      a.quantity_missing AS "Missing",
      a.model AS "Model",
      a.serial_number AS "Serial Number",
      a.status AS "Status",
      l.name AS "Location",
      a.purchase_date AS "Purchase Date",
      a.warranty_expiry AS "Warranty Expiry",
      a.purchase_cost AS "Purchase Cost",
      a.supplier AS "Supplier",
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

  const args: string[] = []

  if (classFilter !== 'all') {
    sql += ` AND a.asset_class = ?`
    args.push(classFilter)
  }

  if (typeFilter !== 'all') {
    sql += ` AND LOWER(a.type) LIKE LOWER(?)`
    args.push(`%${typeFilter}%`)
  }

  if (statusFilter !== 'all') {
    sql += ` AND a.status = ?`
    args.push(statusFilter)
  }

  if (teacherFilter !== 'all') {
    sql += ` AND al.allocated_to = ? AND al.allocated_to_role = 'Teacher'`
    args.push(teacherFilter)
  }

  sql += ` ORDER BY a.asset_tag ASC`

  const result = await db.execute(sql, args)
  const rows = result.rows as unknown as Record<string, string | null>[]

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
  const teacherLabel = teacherFilter === 'all' ? '' : `-${teacherFilter.replace(/\s+/g, '_')}`
  const date = new Date().toISOString().slice(0, 10)
  const filename = `assets-report-${classFilter}-${typeLabel}-${statusLabel}${teacherLabel}-${date}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
