import type {
  AllocationWithDetails,
  AssetSet,
  AssetWithDetails,
  HandoverItemWithDetails,
  HandoverSessionWithCounts,
  Location,
  MaintenanceJobWithDetails,
  RequestWithDetails,
} from './db'
import { getEffectiveLocationId } from './asset-location'

export const REPORT_CATALOG = [
  { id: 'executive-pack', category: 'Overview', title: 'Executive report pack', description: 'A multi-sheet management pack with headline metrics and every key exception list.', badge: 'Recommended' },
  { id: 'complete-inventory', category: 'Inventory', title: 'Complete asset register', description: 'Full IT and classroom register with identity, quantity, location, allocation and purchase details.' },
  { id: 'stocktake', category: 'Inventory', title: 'Stocktake by location', description: 'Verification sheets grouped by room with blank sighting, quantity, serial and discrepancy fields.' },
  { id: 'classroom-inventory', category: 'Inventory', title: 'Classroom inventory', description: 'IT equipment, furniture and other classroom assets grouped by classroom.' },
  { id: 'condition-loss', category: 'Risk', title: 'Condition, damage and loss', description: 'Fair, damaged and missing assets or quantities requiring reconciliation or action.' },
  { id: 'financial-value', category: 'Finance', title: 'Recorded asset value', description: 'Purchase-cost totals by asset, register, type and location. This is not a depreciation schedule.' },
  { id: 'warranty', category: 'Lifecycle', title: 'Warranty expiry', description: 'Expired warranties and warranties approaching expiry within the selected horizon.' },
  { id: 'replacement', category: 'Lifecycle', title: 'Replacement planning', description: 'Age-based planning list using a configurable lifecycle assumption, not an accounting useful life.' },
  { id: 'active-allocations', category: 'Custody', title: 'Active allocations', description: 'Current holders, rooms, purposes and expected return dates.' },
  { id: 'overdue-returns', category: 'Custody', title: 'Overdue returns', description: 'Temporary allocations past their expected return date, ranked by days overdue.' },
  { id: 'allocation-history', category: 'Custody', title: 'Allocation and return history', description: 'Complete custody movement history, including returned and active allocations.' },
  { id: 'maintenance', category: 'Operations', title: 'Maintenance performance', description: 'Open and completed jobs with priority, ownership, age and resolution details.' },
  { id: 'requests', category: 'Operations', title: 'Request performance', description: 'Borrow, relocation and fault requests with status, priority and handling details.' },
  { id: 'class-sets', category: 'Inventory', title: 'Class set register', description: 'Class set ownership, responsible teacher, location and membership totals.' },
  { id: 'handover', category: 'Custody', title: 'Handover reconciliation', description: 'Handover sessions and item-level pending, collected, damaged and missing outcomes.' },
  { id: 'data-quality', category: 'Audit', title: 'Data quality audit', description: 'Missing identifiers, locations, purchase data, costs, suppliers and inconsistent records.' },
] as const

export type ReportId = typeof REPORT_CATALOG[number]['id']
export type ReportRow = Record<string, string | number | boolean | null>

export interface ReportFilters {
  assetClass: 'all' | 'it' | 'classroom'
  type: string
  status: 'all' | 'available' | 'allocated' | 'maintenance' | 'retired'
  locationId: number | null
  teacher: string
  condition: 'all' | 'good' | 'fair' | 'damaged' | 'missing'
  dateFrom: string
  dateTo: string
  warrantyDays: number
  lifecycleYears: number
  includeRetired: boolean
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  assetClass: 'all',
  type: '',
  status: 'all',
  locationId: null,
  teacher: '',
  condition: 'all',
  dateFrom: '',
  dateTo: '',
  warrantyDays: 90,
  lifecycleYears: 4,
  includeRetired: false,
}

const ASSET_CLASSES = ['all', 'it', 'classroom'] as const
const STATUSES = ['all', 'available', 'allocated', 'maintenance', 'retired'] as const
const CONDITIONS = ['all', 'good', 'fair', 'damaged', 'missing'] as const

function oneOf<T extends readonly string[]>(value: string | null, allowed: T, fallback: T[number]): T[number] {
  return value && allowed.includes(value) ? value as T[number] : fallback
}

function validDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  return Number.isNaN(new Date(`${value}T00:00:00`).getTime()) ? '' : value
}

function boundedInteger(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

export function parseReportFilters(searchParams: URLSearchParams): ReportFilters {
  const location = Number(searchParams.get('location_id'))
  return {
    ...DEFAULT_REPORT_FILTERS,
    assetClass: oneOf(searchParams.get('asset_class'), ASSET_CLASSES, 'all'),
    type: (searchParams.get('type') ?? '').trim().slice(0, 100),
    status: oneOf(searchParams.get('status'), STATUSES, 'all'),
    locationId: Number.isInteger(location) && location > 0 ? location : null,
    teacher: (searchParams.get('teacher') ?? '').trim().slice(0, 150),
    condition: oneOf(searchParams.get('condition'), CONDITIONS, 'all'),
    dateFrom: validDate(searchParams.get('date_from')),
    dateTo: validDate(searchParams.get('date_to')),
    warrantyDays: boundedInteger(searchParams.get('warranty_days'), 90, 1, 730),
    lifecycleYears: boundedInteger(searchParams.get('lifecycle_years'), 4, 1, 30),
    includeRetired: searchParams.get('include_retired') === 'true',
  }
}

export interface ReportData {
  assets: AssetWithDetails[]
  allocations: AllocationWithDetails[]
  requests: RequestWithDetails[]
  maintenance: MaintenanceJobWithDetails[]
  locations: Location[]
  sets: AssetSet[]
  handovers: HandoverSessionWithCounts[]
  handoverItems: Array<HandoverItemWithDetails & { session_title: string }>
}

export interface ReportSheet {
  name: string
  columns: string[]
  rows: ReportRow[]
}

export interface GeneratedReport {
  id: ReportId
  title: string
  description: string
  sheets: ReportSheet[]
}

const INVENTORY_COLUMNS = [
  'Asset Tag', 'Name', 'Type', 'Register', 'Tracking Mode', 'Total Quantity', 'Condition',
  'Good', 'Fair', 'Damaged', 'Missing', 'Status', 'Location', 'Class Set', 'Model',
  'Serial Number', 'Allocated To', 'Expected Return', 'Purchase Date', 'Warranty Expiry',
  'Purchase Cost', 'Supplier', 'Notes',
]

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function calendarToday(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Darwin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)))
}

function dateOnly(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : ''
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

function ageYears(value: string | null, now: Date): number | null {
  const purchased = asDate(value)
  if (!purchased) return null
  return Math.max(0, Math.round((daysBetween(purchased, calendarToday(now)) / 365.25) * 10) / 10)
}

function locationMap(data: ReportData): Map<number, string> {
  return new Map(data.locations.map(location => [location.id, location.name]))
}

function effectiveLocation(asset: AssetWithDetails, locations: Map<number, string>): string {
  const id = getEffectiveLocationId(asset)
  return id === null ? '' : locations.get(id) ?? asset.current_allocation?.location_name ?? asset.location_name ?? ''
}

function filteredAssets(data: ReportData, filters: ReportFilters): AssetWithDetails[] {
  return data.assets.filter(asset => {
    const effectiveId = getEffectiveLocationId(asset)
    if (!filters.includeRetired && asset.status === 'retired') return false
    if (filters.assetClass !== 'all' && asset.asset_class !== filters.assetClass) return false
    if (filters.type && asset.type !== filters.type) return false
    if (filters.status !== 'all' && asset.status !== filters.status) return false
    if (filters.locationId !== null && effectiveId !== filters.locationId) return false
    if (filters.teacher && asset.current_allocation?.allocated_to !== filters.teacher) return false
    if (filters.condition !== 'all') {
      const quantityField = `quantity_${filters.condition}` as keyof AssetWithDetails
      if (asset.condition !== filters.condition && Number(asset[quantityField] ?? 0) === 0) return false
    }
    return true
  })
}

function inDateRange(value: string | null, filters: ReportFilters): boolean {
  if (!value) return !filters.dateFrom && !filters.dateTo
  const day = value.slice(0, 10)
  return (!filters.dateFrom || day >= filters.dateFrom) && (!filters.dateTo || day <= filters.dateTo)
}

function inventoryRows(assets: AssetWithDetails[], data: ReportData): ReportRow[] {
  const locations = locationMap(data)
  return assets.map(asset => ({
    'Asset Tag': asset.asset_tag,
    'Name': asset.name,
    'Type': asset.type,
    'Register': asset.asset_class === 'it' ? 'IT' : 'Classroom',
    'Tracking Mode': asset.tracking_mode,
    'Total Quantity': asset.quantity_total,
    'Condition': asset.condition,
    'Good': asset.quantity_good,
    'Fair': asset.quantity_fair,
    'Damaged': asset.quantity_damaged,
    'Missing': asset.quantity_missing,
    'Status': asset.status,
    'Location': effectiveLocation(asset, locations),
    'Class Set': asset.set_name ?? '',
    'Model': asset.model ?? '',
    'Serial Number': asset.serial_number ?? '',
    'Allocated To': asset.current_allocation?.allocated_to ?? '',
    'Expected Return': dateOnly(asset.current_allocation?.expected_return),
    'Purchase Date': dateOnly(asset.purchase_date),
    'Warranty Expiry': dateOnly(asset.warranty_expiry),
    'Purchase Cost': asset.purchase_cost,
    'Supplier': asset.supplier ?? '',
    'Notes': asset.notes ?? '',
  }))
}

function stocktakeRows(assets: AssetWithDetails[], data: ReportData): ReportRow[] {
  return inventoryRows(assets, data).map(row => ({
    'Location': row['Location'],
    'Asset Tag': row['Asset Tag'],
    'Name': row['Name'],
    'Type': row['Type'],
    'Register': row['Register'],
    'Expected Quantity': row['Total Quantity'],
    'Serial / Identifier': row['Serial Number'],
    'Recorded Condition': row['Condition'],
    'Sighted': '',
    'Verified Quantity': '',
    'Serial Confirmed': '',
    'Observed Condition': '',
    'Discrepancy / Action': '',
    'Officer Initials': '',
    'Verification Date': '',
  })).sort((a, b) => String(a.Location).localeCompare(String(b.Location)) || String(a['Asset Tag']).localeCompare(String(b['Asset Tag'])))
}

function conditionRows(assets: AssetWithDetails[], data: ReportData): ReportRow[] {
  const locations = locationMap(data)
  return assets.filter(asset => asset.condition !== 'good' || asset.quantity_fair + asset.quantity_damaged + asset.quantity_missing > 0).map(asset => ({
    'Asset Tag': asset.asset_tag,
    'Name': asset.name,
    'Type': asset.type,
    'Register': asset.asset_class,
    'Location': effectiveLocation(asset, locations),
    'Condition': asset.condition,
    'Total Quantity': asset.quantity_total,
    'Fair': asset.quantity_fair,
    'Damaged': asset.quantity_damaged,
    'Missing': asset.quantity_missing,
    'Affected Quantity': asset.quantity_fair + asset.quantity_damaged + asset.quantity_missing,
    'Status': asset.status,
    'Notes': asset.notes ?? '',
  }))
}

function financialRows(assets: AssetWithDetails[], data: ReportData): ReportRow[] {
  const locations = locationMap(data)
  return assets.map(asset => ({
    'Asset Tag': asset.asset_tag,
    'Name': asset.name,
    'Type': asset.type,
    'Register': asset.asset_class,
    'Location': effectiveLocation(asset, locations),
    'Quantity': asset.quantity_total,
    'Recorded Purchase Cost': asset.purchase_cost,
    'Purchase Date': dateOnly(asset.purchase_date),
    'Supplier': asset.supplier ?? '',
    'Status': asset.status,
  }))
}

function warrantyRows(assets: AssetWithDetails[], data: ReportData, filters: ReportFilters, now: Date): ReportRow[] {
  const locations = locationMap(data)
  const today = calendarToday(now)
  return assets.flatMap(asset => {
    const expiry = asDate(asset.warranty_expiry)
    if (!expiry) return []
    const days = daysBetween(today, expiry)
    if (days > filters.warrantyDays) return []
    return [{
      'Asset Tag': asset.asset_tag,
      'Name': asset.name,
      'Type': asset.type,
      'Location': effectiveLocation(asset, locations),
      'Supplier': asset.supplier ?? '',
      'Purchase Date': dateOnly(asset.purchase_date),
      'Warranty Expiry': dateOnly(asset.warranty_expiry),
      'Days Until Expiry': days,
      'Warranty State': days < 0 ? 'Expired' : days === 0 ? 'Expires today' : `Due within ${filters.warrantyDays} days`,
      'Status': asset.status,
    }]
  }).sort((a, b) => Number(a['Days Until Expiry']) - Number(b['Days Until Expiry']))
}

function replacementRows(assets: AssetWithDetails[], data: ReportData, filters: ReportFilters, now: Date): ReportRow[] {
  const locations = locationMap(data)
  return assets.flatMap(asset => {
    const age = ageYears(asset.purchase_date, now)
    if (age === null || age < filters.lifecycleYears) return []
    return [{
      'Asset Tag': asset.asset_tag,
      'Name': asset.name,
      'Type': asset.type,
      'Register': asset.asset_class,
      'Location': effectiveLocation(asset, locations),
      'Purchase Date': dateOnly(asset.purchase_date),
      'Age (Years)': age,
      'Planning Lifecycle (Years)': filters.lifecycleYears,
      'Years Past Planning Point': Math.round((age - filters.lifecycleYears) * 10) / 10,
      'Condition': asset.condition,
      'Status': asset.status,
      'Recorded Cost': asset.purchase_cost,
      'Planning Note': 'Age-based indicator only; confirm school policy, condition and operational need.',
    }]
  }).sort((a, b) => Number(b['Years Past Planning Point']) - Number(a['Years Past Planning Point']))
}

function allocationRows(allocations: AllocationWithDetails[], activeOnly = false): ReportRow[] {
  return allocations.filter(allocation => !activeOnly || !allocation.returned_at).map(allocation => ({
    'Asset Tag': allocation.asset_tag ?? '',
    'Asset Name': allocation.asset_name ?? '',
    'Type': allocation.asset_type ?? '',
    'Allocated To': allocation.allocated_to,
    'Role': allocation.allocated_to_role ?? '',
    'Location': allocation.location_name ?? '',
    'Purpose': allocation.purpose ?? '',
    'Temporary': allocation.is_temporary ? 'Yes' : 'No',
    'Allocated At': allocation.allocated_at,
    'Expected Return': dateOnly(allocation.expected_return),
    'Returned At': allocation.returned_at ?? '',
    'Allocated By': allocation.allocated_by_name ?? '',
    'Notes': allocation.notes ?? '',
  }))
}

function overdueRows(allocations: AllocationWithDetails[], now: Date): ReportRow[] {
  const today = calendarToday(now)
  return allocations.filter(allocation => !allocation.returned_at && asDate(allocation.expected_return) && asDate(allocation.expected_return)!.getTime() < today.getTime()).map(allocation => {
    const due = asDate(allocation.expected_return)!
    return {
      'Asset Tag': allocation.asset_tag ?? '',
      'Asset Name': allocation.asset_name ?? '',
      'Type': allocation.asset_type ?? '',
      'Allocated To': allocation.allocated_to,
      'Role': allocation.allocated_to_role ?? '',
      'Location': allocation.location_name ?? '',
      'Expected Return': dateOnly(allocation.expected_return),
      'Days Overdue': Math.max(1, daysBetween(due, today)),
      'Allocated At': allocation.allocated_at,
      'Purpose': allocation.purpose ?? '',
    }
  }).sort((a, b) => Number(b['Days Overdue']) - Number(a['Days Overdue']))
}

function maintenanceRows(jobs: MaintenanceJobWithDetails[], filters: ReportFilters, now: Date): ReportRow[] {
  return jobs.filter(job => inDateRange(job.created_at, filters)).map(job => {
    const opened = asDate(job.created_at) ?? now
    const closed = asDate(job.completed_at)
    return {
      'Job ID': job.id,
      'Asset Tag': job.asset_tag ?? '',
      'Asset Name': job.asset_name ?? '',
      'Type': job.asset_type ?? '',
      'Location': job.location_name ?? '',
      'Priority': job.priority,
      'Status': job.status,
      'Reported By': job.reported_by_name ?? '',
      'Assigned To': job.assigned_to_name ?? '',
      'Fault': job.fault_description ?? '',
      'Opened At': job.created_at,
      'Age / Resolution Days': daysBetween(opened, closed ?? now),
      'Completed At': job.completed_at ?? '',
      'Latest Note': job.latest_note ?? '',
      'Resolution': job.resolution_note ?? '',
      'Return Location': job.return_location_name ?? '',
    }
  })
}

function requestRows(requests: RequestWithDetails[], filters: ReportFilters): ReportRow[] {
  return requests.filter(request => inDateRange(request.created_at, filters)).map(request => ({
    'Request ID': request.id,
    'Created At': request.created_at,
    'Type': request.request_type,
    'Priority': request.priority,
    'Status': request.status,
    'Asset Tag': request.asset_tag ?? '',
    'Asset Name': request.asset_name ?? '',
    'Asset Type': request.asset_type ?? '',
    'Requester': request.requester_name,
    'Requester Class': request.requester_class ?? '',
    'From Location': request.from_location_name ?? '',
    'To Location': request.to_location_name ?? '',
    'Reason': request.reason ?? '',
    'Duration': request.duration ?? '',
    'Handled By': request.handled_by_name ?? '',
    'Handled At': request.handled_at ?? '',
    'Handler Notes': request.handler_notes ?? '',
  }))
}

function setRows(sets: AssetSet[]): ReportRow[] {
  return sets.map(set => ({
    'Set ID': set.id,
    'Set Name': set.name,
    'Description': set.description ?? '',
    'Responsible Teacher': set.responsible_teacher ?? '',
    'Location': set.location_name ?? '',
    'Asset Records': set.asset_count,
    'Created At': set.created_at,
  }))
}

function handoverRows(items: ReportData['handoverItems']): ReportRow[] {
  return items.map(item => ({
    'Session': item.session_title,
    'Holder': item.holder_name,
    'Holder Email': item.holder_email ?? '',
    'Asset Tag': item.asset_tag ?? '',
    'Asset Name': item.asset_name ?? '',
    'Type': item.asset_type ?? '',
    'Class Set': item.set_name ?? '',
    'Location': item.location_name ?? '',
    'Status': item.status,
    'Admin Notes': item.admin_notes ?? '',
    'Updated At': item.updated_at,
  }))
}

function dataQualityRows(assets: AssetWithDetails[], data: ReportData): ReportRow[] {
  const locations = locationMap(data)
  return assets.flatMap(asset => {
    const issues: string[] = []
    if (!asset.location_id && !asset.current_allocation?.location_id) issues.push('Missing location')
    if (asset.tracking_mode === 'individual' && !asset.serial_number) issues.push('Missing serial number')
    if (!asset.model) issues.push('Missing model')
    if (!asset.purchase_date) issues.push('Missing purchase date')
    if (asset.purchase_cost === null) issues.push('Missing purchase cost')
    if (!asset.supplier) issues.push('Missing supplier')
    if (!asset.warranty_expiry) issues.push('Missing warranty expiry')
    const quantitySum = asset.quantity_good + asset.quantity_fair + asset.quantity_damaged + asset.quantity_missing
    if (quantitySum !== asset.quantity_total) issues.push('Condition quantities do not equal total')
    if (issues.length === 0) return []
    return [{
      'Asset Tag': asset.asset_tag,
      'Name': asset.name,
      'Type': asset.type,
      'Register': asset.asset_class,
      'Location': effectiveLocation(asset, locations),
      'Issue Count': issues.length,
      'Completeness Score': `${Math.max(0, 100 - issues.length * 12)}%`,
      'Data Issues': issues.join('; '),
      'Last Updated': asset.updated_at,
    }]
  }).sort((a, b) => Number(b['Issue Count']) - Number(a['Issue Count']))
}

function summaryRows(assets: AssetWithDetails[], data: ReportData, filters: ReportFilters, now: Date): ReportRow[] {
  const assetIds = new Set(assets.map(asset => asset.id))
  const totalUnits = assets.reduce((sum, asset) => sum + asset.quantity_total, 0)
  const recordedCost = assets.reduce((sum, asset) => sum + (asset.purchase_cost ?? 0), 0)
  const condition = conditionRows(assets, data)
  const quality = dataQualityRows(assets, data)
  const active = data.allocations.filter(allocation => assetIds.has(allocation.asset_id) && !allocation.returned_at)
  const overdue = overdueRows(data.allocations.filter(allocation => assetIds.has(allocation.asset_id)), now)
  return [
    { 'Metric': 'Asset records', 'Value': assets.length, 'Notes': 'Filtered register records' },
    { 'Metric': 'Physical items', 'Value': totalUnits, 'Notes': 'Quantity total across records' },
    { 'Metric': 'IT records', 'Value': assets.filter(asset => asset.asset_class === 'it').length, 'Notes': '' },
    { 'Metric': 'Classroom records', 'Value': assets.filter(asset => asset.asset_class === 'classroom').length, 'Notes': '' },
    { 'Metric': 'Recorded purchase cost', 'Value': Math.round(recordedCost * 100) / 100, 'Notes': 'Not carrying value or depreciation' },
    { 'Metric': 'Active allocations', 'Value': active.length, 'Notes': '' },
    { 'Metric': 'Overdue returns', 'Value': overdue.length, 'Notes': '' },
    { 'Metric': 'Condition / loss exceptions', 'Value': condition.length, 'Notes': 'Records with fair, damaged or missing quantities' },
    { 'Metric': 'Open maintenance jobs', 'Value': data.maintenance.filter(job => assetIds.has(job.asset_id) && job.status !== 'completed').length, 'Notes': '' },
    { 'Metric': 'Pending requests', 'Value': data.requests.filter(request => assetIds.has(request.asset_id) && request.status === 'pending').length, 'Notes': '' },
    { 'Metric': 'Data quality exceptions', 'Value': quality.length, 'Notes': '' },
    { 'Metric': 'Warranty horizon', 'Value': filters.warrantyDays, 'Notes': 'Days' },
    { 'Metric': 'Replacement planning lifecycle', 'Value': filters.lifecycleYears, 'Notes': 'Years; planning assumption only' },
  ]
}

function sheet(name: string, columns: string[], rows: ReportRow[]): ReportSheet {
  return { name, columns, rows }
}

export function isReportId(value: string): value is ReportId {
  return REPORT_CATALOG.some(report => report.id === value)
}

export function generateReport(id: ReportId, data: ReportData, filters: ReportFilters, now = new Date()): GeneratedReport {
  const definition = REPORT_CATALOG.find(report => report.id === id)!
  const assets = filteredAssets(data, filters)
  const inventory = inventoryRows(assets, data)
  const stocktake = stocktakeRows(assets, data)
  const classroomLocationIds = new Set(data.locations.filter(location => location.location_type === 'classroom').map(location => location.id))
  const classroomAssets = assets.filter(asset => {
    const id = getEffectiveLocationId(asset)
    return id !== null && classroomLocationIds.has(id)
  })
  const relatedAssetIds = new Set(filteredAssets(data, { ...filters, locationId: null }).map(asset => asset.id))
  const allocations = data.allocations.filter(allocation =>
    relatedAssetIds.has(allocation.asset_id) &&
    (filters.locationId === null || allocation.location_id === filters.locationId) &&
    (!filters.type || allocation.asset_type === filters.type) &&
    (!filters.teacher || allocation.allocated_to === filters.teacher) &&
    inDateRange(allocation.allocated_at, filters)
  )
  const assetIds = new Set(assets.map(asset => asset.id))
  const maintenance = data.maintenance.filter(job => assetIds.has(job.asset_id))
  const requests = data.requests.filter(request => assetIds.has(request.asset_id))
  const handoverItems = data.handoverItems.filter(item => assetIds.has(item.asset_id))

  const reports: Record<ReportId, () => ReportSheet[]> = {
    'executive-pack': () => [
      sheet('Executive Summary', ['Metric', 'Value', 'Notes'], summaryRows(assets, data, filters, now)),
      sheet('Complete Inventory', INVENTORY_COLUMNS, inventory),
      sheet('Stocktake', ['Location', 'Asset Tag', 'Name', 'Type', 'Register', 'Expected Quantity', 'Serial / Identifier', 'Recorded Condition', 'Sighted', 'Verified Quantity', 'Serial Confirmed', 'Observed Condition', 'Discrepancy / Action', 'Officer Initials', 'Verification Date'], stocktake),
      sheet('Condition and Loss', ['Asset Tag', 'Name', 'Type', 'Register', 'Location', 'Condition', 'Total Quantity', 'Fair', 'Damaged', 'Missing', 'Affected Quantity', 'Status', 'Notes'], conditionRows(assets, data)),
      sheet('Recorded Value', ['Asset Tag', 'Name', 'Type', 'Register', 'Location', 'Quantity', 'Recorded Purchase Cost', 'Purchase Date', 'Supplier', 'Status'], financialRows(assets, data)),
      sheet('Warranty', ['Asset Tag', 'Name', 'Type', 'Location', 'Supplier', 'Purchase Date', 'Warranty Expiry', 'Days Until Expiry', 'Warranty State', 'Status'], warrantyRows(assets, data, filters, now)),
      sheet('Replacement Planning', ['Asset Tag', 'Name', 'Type', 'Register', 'Location', 'Purchase Date', 'Age (Years)', 'Planning Lifecycle (Years)', 'Years Past Planning Point', 'Condition', 'Status', 'Recorded Cost', 'Planning Note'], replacementRows(assets, data, filters, now)),
      sheet('Active Allocations', ['Asset Tag', 'Asset Name', 'Type', 'Allocated To', 'Role', 'Location', 'Purpose', 'Temporary', 'Allocated At', 'Expected Return', 'Returned At', 'Allocated By', 'Notes'], allocationRows(allocations, true)),
      sheet('Overdue Returns', ['Asset Tag', 'Asset Name', 'Type', 'Allocated To', 'Role', 'Location', 'Expected Return', 'Days Overdue', 'Allocated At', 'Purpose'], overdueRows(allocations, now)),
      sheet('Maintenance', ['Job ID', 'Asset Tag', 'Asset Name', 'Type', 'Location', 'Priority', 'Status', 'Reported By', 'Assigned To', 'Fault', 'Opened At', 'Age / Resolution Days', 'Completed At', 'Latest Note', 'Resolution', 'Return Location'], maintenanceRows(maintenance, filters, now)),
      sheet('Data Quality', ['Asset Tag', 'Name', 'Type', 'Register', 'Location', 'Issue Count', 'Completeness Score', 'Data Issues', 'Last Updated'], dataQualityRows(assets, data)),
    ],
    'complete-inventory': () => [sheet('Complete Inventory', INVENTORY_COLUMNS, inventory)],
    'stocktake': () => [sheet('Stocktake', ['Location', 'Asset Tag', 'Name', 'Type', 'Register', 'Expected Quantity', 'Serial / Identifier', 'Recorded Condition', 'Sighted', 'Verified Quantity', 'Serial Confirmed', 'Observed Condition', 'Discrepancy / Action', 'Officer Initials', 'Verification Date'], stocktake)],
    'classroom-inventory': () => [sheet('Classroom Inventory', INVENTORY_COLUMNS, inventoryRows(classroomAssets, data))],
    'condition-loss': () => [sheet('Condition and Loss', ['Asset Tag', 'Name', 'Type', 'Register', 'Location', 'Condition', 'Total Quantity', 'Fair', 'Damaged', 'Missing', 'Affected Quantity', 'Status', 'Notes'], conditionRows(assets, data))],
    'financial-value': () => [sheet('Recorded Value', ['Asset Tag', 'Name', 'Type', 'Register', 'Location', 'Quantity', 'Recorded Purchase Cost', 'Purchase Date', 'Supplier', 'Status'], financialRows(assets, data))],
    'warranty': () => [sheet('Warranty', ['Asset Tag', 'Name', 'Type', 'Location', 'Supplier', 'Purchase Date', 'Warranty Expiry', 'Days Until Expiry', 'Warranty State', 'Status'], warrantyRows(assets, data, filters, now))],
    'replacement': () => [sheet('Replacement Planning', ['Asset Tag', 'Name', 'Type', 'Register', 'Location', 'Purchase Date', 'Age (Years)', 'Planning Lifecycle (Years)', 'Years Past Planning Point', 'Condition', 'Status', 'Recorded Cost', 'Planning Note'], replacementRows(assets, data, filters, now))],
    'active-allocations': () => [sheet('Active Allocations', ['Asset Tag', 'Asset Name', 'Type', 'Allocated To', 'Role', 'Location', 'Purpose', 'Temporary', 'Allocated At', 'Expected Return', 'Returned At', 'Allocated By', 'Notes'], allocationRows(allocations, true))],
    'overdue-returns': () => [sheet('Overdue Returns', ['Asset Tag', 'Asset Name', 'Type', 'Allocated To', 'Role', 'Location', 'Expected Return', 'Days Overdue', 'Allocated At', 'Purpose'], overdueRows(allocations, now))],
    'allocation-history': () => [sheet('Allocation History', ['Asset Tag', 'Asset Name', 'Type', 'Allocated To', 'Role', 'Location', 'Purpose', 'Temporary', 'Allocated At', 'Expected Return', 'Returned At', 'Allocated By', 'Notes'], allocationRows(allocations))],
    'maintenance': () => [sheet('Maintenance', ['Job ID', 'Asset Tag', 'Asset Name', 'Type', 'Location', 'Priority', 'Status', 'Reported By', 'Assigned To', 'Fault', 'Opened At', 'Age / Resolution Days', 'Completed At', 'Latest Note', 'Resolution', 'Return Location'], maintenanceRows(maintenance, filters, now))],
    'requests': () => [sheet('Requests', ['Request ID', 'Created At', 'Type', 'Priority', 'Status', 'Asset Tag', 'Asset Name', 'Asset Type', 'Requester', 'Requester Class', 'From Location', 'To Location', 'Reason', 'Duration', 'Handled By', 'Handled At', 'Handler Notes'], requestRows(requests, filters))],
    'class-sets': () => [sheet('Class Sets', ['Set ID', 'Set Name', 'Description', 'Responsible Teacher', 'Location', 'Asset Records', 'Created At'], setRows(data.sets))],
    'handover': () => [
      sheet('Handover Sessions', ['Session', 'Status', 'Created By', 'Created At', 'Sent At', 'Closed At', 'Total', 'Pending', 'Collected', 'Damaged', 'Missing', 'Notes'], data.handovers.map(session => ({
        'Session': session.title, 'Status': session.status, 'Created By': session.created_by_name ?? '', 'Created At': session.created_at,
        'Sent At': session.sent_at ?? '', 'Closed At': session.closed_at ?? '', 'Total': session.total_items, 'Pending': session.pending_items,
        'Collected': session.collected_items, 'Damaged': session.damaged_items, 'Missing': session.missing_items, 'Notes': session.notes ?? '',
      }))),
      sheet('Handover Items', ['Session', 'Holder', 'Holder Email', 'Asset Tag', 'Asset Name', 'Type', 'Class Set', 'Location', 'Status', 'Admin Notes', 'Updated At'], handoverRows(handoverItems)),
    ],
    'data-quality': () => [sheet('Data Quality', ['Asset Tag', 'Name', 'Type', 'Register', 'Location', 'Issue Count', 'Completeness Score', 'Data Issues', 'Last Updated'], dataQualityRows(assets, data))],
  }

  return { id, title: definition.title, description: definition.description, sheets: reports[id]() }
}
