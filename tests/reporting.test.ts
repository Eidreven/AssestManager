import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import type { AssetWithDetails } from '../lib/db'
import { createCsv, createWorkbookBuffer, safeSpreadsheetValue } from '../lib/report-export'
import {
  DEFAULT_REPORT_FILTERS,
  generateReport,
  parseReportFilters,
  REPORT_CATALOG,
  type ReportData,
} from '../lib/reporting'

function asset(overrides: Partial<AssetWithDetails> = {}): AssetWithDetails {
  return {
    id: 1,
    asset_tag: 'MPS-IPA-001',
    name: 'Class iPad',
    type: 'iPad',
    model: '10th generation',
    serial_number: 'SERIAL-1',
    status: 'allocated',
    location_id: 1,
    set_id: null,
    created_by_id: 1,
    notes: null,
    purchase_date: '2021-01-10',
    warranty_expiry: '2026-08-20',
    asset_class: 'it',
    tracking_mode: 'individual',
    quantity_total: 1,
    condition: 'good',
    quantity_good: 1,
    quantity_fair: 0,
    quantity_damaged: 0,
    quantity_missing: 0,
    purchase_cost: 500,
    supplier: 'School Supplier',
    created_at: '2021-01-10T00:00:00',
    updated_at: '2026-08-01T00:00:00',
    location_name: 'ICT Store',
    set_name: null,
    created_by_name: 'Admin',
    current_allocation: {
      id: 10,
      asset_id: 1,
      allocated_to: 'Mrs Brown',
      allocated_to_role: 'Teacher',
      allocated_by_id: 1,
      allocated_by_name: 'Admin',
      location_id: 2,
      location_name: 'Year 3 Classroom',
      purpose: 'Daily teaching',
      is_temporary: 1,
      allocated_at: '2026-07-01T00:00:00',
      expected_return: '2026-08-01',
      returned_at: null,
      notes: null,
      asset_name: 'Class iPad',
      asset_tag: 'MPS-IPA-001',
      asset_type: 'iPad',
    },
    ...overrides,
  }
}

function reportData(assets = [asset()]): ReportData {
  return {
    assets,
    allocations: assets.flatMap(item => item.current_allocation ? [item.current_allocation] : []),
    requests: [],
    maintenance: [],
    locations: [
      { id: 1, name: 'ICT Store', description: null, location_type: 'other', created_at: '2024-01-01' },
      { id: 2, name: 'Year 3 Classroom', description: null, location_type: 'classroom', created_at: '2024-01-01' },
    ],
    sets: [],
    handovers: [],
    handoverItems: [],
  }
}

test('report catalogue exposes a comprehensive set of unique reports', () => {
  assert.equal(REPORT_CATALOG.length, 16)
  assert.equal(new Set(REPORT_CATALOG.map(report => report.id)).size, REPORT_CATALOG.length)
})

test('report filters reject invalid enums, dates and unsafe numeric ranges', () => {
  const filters = parseReportFilters(new URLSearchParams({
    asset_class: 'invalid',
    status: 'deleted',
    condition: 'broken',
    location_id: '-2',
    warranty_days: '99999',
    lifecycle_years: '0',
    date_from: 'not-a-date',
    include_retired: 'true',
  }))
  assert.equal(filters.assetClass, 'all')
  assert.equal(filters.status, 'all')
  assert.equal(filters.condition, 'all')
  assert.equal(filters.locationId, null)
  assert.equal(filters.warrantyDays, 90)
  assert.equal(filters.lifecycleYears, 4)
  assert.equal(filters.dateFrom, '')
  assert.equal(filters.includeRetired, true)
})

test('stocktake uses the active allocation room and includes verification columns', () => {
  const report = generateReport('stocktake', reportData(), DEFAULT_REPORT_FILTERS, new Date('2026-08-10T00:00:00Z'))
  assert.equal(report.sheets[0].rows[0].Location, 'Year 3 Classroom')
  assert.ok(report.sheets[0].columns.includes('Sighted'))
  assert.ok(report.sheets[0].columns.includes('Officer Initials'))
  assert.ok(report.sheets[0].columns.includes('Serial Confirmed'))
})

test('warranty and replacement reports calculate actionable horizons', () => {
  const data = reportData()
  const now = new Date('2026-08-10T00:00:00Z')
  const warranty = generateReport('warranty', data, { ...DEFAULT_REPORT_FILTERS, warrantyDays: 30 }, now)
  const replacement = generateReport('replacement', data, { ...DEFAULT_REPORT_FILTERS, lifecycleYears: 4 }, now)
  assert.equal(warranty.sheets[0].rows[0]['Days Until Expiry'], 10)
  assert.equal(replacement.sheets[0].rows[0]['Age (Years)'], 5.6)
  assert.equal(replacement.sheets[0].rows[0]['Years Past Planning Point'], 1.6)
})

test('financial report preserves recorded cost without assuming a unit cost', () => {
  const grouped = asset({ asset_class: 'classroom', tracking_mode: 'quantity', quantity_total: 24, purchase_cost: 600 })
  const report = generateReport('financial-value', reportData([grouped]), DEFAULT_REPORT_FILTERS)
  assert.equal(report.sheets[0].rows[0]['Recorded Purchase Cost'], 600)
  assert.equal(report.sheets[0].rows[0].Quantity, 24)
})

test('allocation location filters use the allocation room', () => {
  const report = generateReport('allocation-history', reportData(), { ...DEFAULT_REPORT_FILTERS, locationId: 2 })
  const excluded = generateReport('allocation-history', reportData(), { ...DEFAULT_REPORT_FILTERS, locationId: 1 })
  assert.equal(report.sheets[0].rows.length, 1)
  assert.equal(excluded.sheets[0].rows.length, 0)
})

test('spreadsheet exports neutralize formula-like user values', () => {
  assert.equal(safeSpreadsheetValue('=HYPERLINK("bad")'), "'=HYPERLINK(\"bad\")")
  assert.equal(safeSpreadsheetValue('+SUM(1,2)'), "'+SUM(1,2)")
  assert.equal(safeSpreadsheetValue('Normal text'), 'Normal text')

  const report = generateReport('complete-inventory', reportData([asset({ name: '=2+2' })]), DEFAULT_REPORT_FILTERS)
  assert.match(createCsv(report), /'=2\+2/)
})

test('executive pack creates a readable multi-sheet workbook', () => {
  const report = generateReport('executive-pack', reportData(), DEFAULT_REPORT_FILTERS, new Date('2026-08-10T00:00:00Z'))
  const workbook = XLSX.read(createWorkbookBuffer(report, DEFAULT_REPORT_FILTERS, new Date('2026-08-10T00:00:00Z')), { type: 'buffer' })
  assert.equal(workbook.SheetNames.length, 11)
  assert.ok(workbook.SheetNames.includes('Executive Summary'))
  assert.ok(workbook.SheetNames.includes('Stocktake'))
  assert.ok(workbook.SheetNames.includes('Data Quality'))
  assert.equal(workbook.Sheets['Executive Summary'].A1.v, 'Executive report pack')
})
