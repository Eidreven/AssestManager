import * as XLSX from 'xlsx'
import type { GeneratedReport, ReportFilters, ReportRow, ReportSheet } from './reporting'

const FORMULA_PREFIX = /^[=+\-@\t\r]/

export function safeSpreadsheetValue(value: ReportRow[string]): ReportRow[string] {
  if (typeof value !== 'string') return value
  return FORMULA_PREFIX.test(value) ? `'${value}` : value
}

function safeRows(sheet: ReportSheet): ReportRow[] {
  return sheet.rows.map(row => Object.fromEntries(
    sheet.columns.map(column => [column, safeSpreadsheetValue(row[column] ?? '')])
  ))
}

function excelColumnName(index: number): string {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

function filterSummary(filters: ReportFilters): string {
  const values = [
    filters.assetClass !== 'all' ? `register=${filters.assetClass}` : '',
    filters.type ? `type=${filters.type}` : '',
    filters.status !== 'all' ? `status=${filters.status}` : '',
    filters.locationId !== null ? `location=${filters.locationId}` : '',
    filters.teacher ? `holder=${filters.teacher}` : '',
    filters.condition !== 'all' ? `condition=${filters.condition}` : '',
    filters.dateFrom ? `from=${filters.dateFrom}` : '',
    filters.dateTo ? `to=${filters.dateTo}` : '',
    filters.includeRetired ? 'include retired' : 'exclude retired',
  ].filter(Boolean)
  return values.join(', ')
}

function worksheetFor(report: GeneratedReport, sheet: ReportSheet, filters: ReportFilters, generatedAt: Date) {
  const rows = safeRows(sheet)
  const metadata = [
    [report.title],
    [report.description],
    ['Generated', generatedAt.toLocaleString('en-AU', { timeZone: 'Australia/Darwin' })],
    ['Filters', filterSummary(filters)],
    [],
    sheet.columns,
    ...rows.map(row => sheet.columns.map(column => row[column] ?? '')),
  ]
  const worksheet = XLSX.utils.aoa_to_sheet(metadata)
  const lastColumn = excelColumnName(Math.max(0, sheet.columns.length - 1))
  worksheet['!autofilter'] = { ref: `A6:${lastColumn}${Math.max(6, rows.length + 6)}` }
  worksheet['!cols'] = sheet.columns.map((column, index) => ({
    wch: Math.min(48, Math.max(column.length + 2, ...rows.map(row => String(row[column] ?? '').length + 2), index === 0 ? report.title.length : 0)),
  }))
  return worksheet
}

export function createWorkbookBuffer(report: GeneratedReport, filters: ReportFilters, generatedAt = new Date()): Buffer {
  const workbook = XLSX.utils.book_new()
  report.sheets.forEach(sheet => XLSX.utils.book_append_sheet(workbook, worksheetFor(report, sheet, filters, generatedAt), sheet.name.slice(0, 31)))
  workbook.Props = {
    Title: report.title,
    Subject: report.description,
    Author: 'MPS School Asset Register',
    CreatedDate: generatedAt,
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer
}

function csvCell(value: ReportRow[string]): string {
  const safe = String(safeSpreadsheetValue(value) ?? '')
  return `"${safe.replace(/"/g, '""')}"`
}

export function createCsv(report: GeneratedReport): string {
  const sheet = report.sheets[0]
  return [
    sheet.columns.map(csvCell).join(','),
    ...sheet.rows.map(row => sheet.columns.map(column => csvCell(row[column] ?? '')).join(',')),
  ].join('\r\n')
}
